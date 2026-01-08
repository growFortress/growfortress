/**
 * Arena PvP Simulation
 *
 * Main simulation class for 1v1 arena battles.
 * Two fortresses fight each other with heroes and turrets.
 */

import { Xorshift32 } from '../rng.js';
import { FP } from '../fixed.js';
import type { ActiveHero, ActiveTurret, ActiveProjectile, FortressClass } from '../types.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
import { getTurretById, calculateTurretStats } from '../data/turrets.js';
import { TURRET_SLOTS } from '../data/turrets.js';
import { shouldCrit } from '../modifiers.js';
import {
  integratePosition,
  applyFriction,
  clampVelocity,
  HERO_PHYSICS,
} from '../physics.js';
import type {
  ArenaState,
  ArenaSide,
  ArenaConfig,
  ArenaBuildConfig,
  ArenaWinReason,
} from './arena-state.js';
import {
  createArenaState,
  DEFAULT_ARENA_CONFIG,
  getEnemySide,
} from './arena-state.js';
import {
  selectHeroTarget,
  selectTurretTarget,
  selectFortressTarget,
  getHeroMovementDirection,
  type ArenaTarget,
} from './arena-ai.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Replay event for recording the battle
 */
export interface ArenaReplayEvent {
  tick: number;
  type: 'damage' | 'hero_death' | 'fortress_damage' | 'projectile';
  side: 'left' | 'right';
  data: Record<string, unknown>;
}

/**
 * Arena battle result
 */
export interface ArenaResult {
  winner: 'left' | 'right' | null;
  winReason: ArenaWinReason;
  duration: number; // in ticks
  leftStats: {
    finalHp: number;
    damageDealt: number;
    heroesAlive: number;
  };
  rightStats: {
    finalHp: number;
    damageDealt: number;
    heroesAlive: number;
  };
  replayEvents: ArenaReplayEvent[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const FORTRESS_ATTACK_RANGE = FP.fromInt(15); // Fortress can attack heroes within this range
const PROJECTILE_SPEED = FP.fromFloat(8); // Units per tick
const HERO_MAX_SPEED = FP.fromFloat(3); // Max hero speed in arena

// ============================================================================
// SIMULATION CLASS
// ============================================================================

export class ArenaSimulation {
  state: ArenaState;
  config: ArenaConfig;
  private rng: Xorshift32;
  private replayEvents: ArenaReplayEvent[] = [];
  private nextProjectileId = 1;

  constructor(
    seed: number,
    leftBuild: ArenaBuildConfig,
    rightBuild: ArenaBuildConfig,
    config: ArenaConfig = DEFAULT_ARENA_CONFIG
  ) {
    this.config = config;
    this.state = createArenaState(seed, leftBuild, rightBuild, config);
    this.rng = new Xorshift32(seed);
  }

  /**
   * Run the entire simulation until completion
   */
  run(): ArenaResult {
    while (!this.state.ended) {
      this.step();
    }

    return this.getResult();
  }

  /**
   * Advance simulation by one tick
   */
  step(): void {
    if (this.state.ended) return;

    // Sync RNG state
    this.rng.setState(this.state.rngState);

    // Alternate update order to prevent turn-order bias
    // Even ticks: left first, Odd ticks: right first
    if (this.state.tick % 2 === 0) {
      this.updateSide('left');
      this.updateSide('right');
    } else {
      this.updateSide('right');
      this.updateSide('left');
    }

    // Update projectiles for both sides (order doesn't matter as much)
    this.updateProjectiles('left');
    this.updateProjectiles('right');

    // Check win conditions
    this.checkEndConditions();

    // Store RNG state
    this.state.rngState = this.rng.getState();

    // Advance tick
    this.state.tick++;

    // Safety timeout
    if (this.state.tick >= this.state.maxTicks && !this.state.ended) {
      this.handleTimeout();
    }
  }

  /**
   * Update one side of the arena
   */
  private updateSide(side: 'left' | 'right'): void {
    const ownSide = side === 'left' ? this.state.left : this.state.right;

    // Update heroes
    this.updateHeroes(side, ownSide);

    // Update turrets
    this.updateTurrets(side, ownSide);

    // Update fortress attack
    this.updateFortressAttack(side, ownSide);
  }

  // ============================================================================
  // HERO UPDATES
  // ============================================================================

  private updateHeroes(side: 'left' | 'right', ownSide: ArenaSide): void {
    const enemySide = getEnemySide(this.state, side);

    for (const hero of ownSide.heroes) {
      if (hero.state === 'dead' || hero.currentHp <= 0) continue;

      // Get attack target
      const target = selectHeroTarget(hero, side, this.state);

      // Always attack if target in range
      if (target.type === 'fortress' || target.type === 'hero') {
        this.heroAttack(hero, target, side, ownSide);
      }

      // Always move towards enemy fortress (even while attacking)
      // This ensures heroes don't get stuck fighting in the middle
      const moveTarget: ArenaTarget = {
        type: 'move',
        x: enemySide.fortress.x,
        y: enemySide.fortress.y,
      };
      this.moveHero(hero, moveTarget);

      // Clamp hero position to field
      hero.x = FP.clamp(hero.x, FP.fromInt(0), this.config.fieldWidth);
      hero.y = FP.clamp(hero.y, FP.fromInt(0), this.config.fieldHeight);
    }
  }

  private moveHero(hero: ActiveHero, target: ArenaTarget): void {
    const direction = getHeroMovementDirection(hero, target);

    // Apply movement with physics
    hero.vx = direction.vx;
    hero.vy = direction.vy;

    applyFriction(hero, HERO_PHYSICS.friction);
    clampVelocity(hero, HERO_MAX_SPEED);
    integratePosition(hero);
  }

  private heroAttack(
    hero: ActiveHero,
    target: ArenaTarget,
    side: 'left' | 'right',
    ownSide: ArenaSide
  ): void {
    const def = getHeroById(hero.definitionId);
    if (!def) return;

    const stats = calculateHeroStats(def, hero.tier, hero.level);
    const attackInterval = Math.floor(30 / stats.attackSpeed); // Convert attacks/sec to ticks

    if (this.state.tick - hero.lastAttackTick < attackInterval) return;

    hero.lastAttackTick = this.state.tick;

    // Calculate damage
    const isCrit = shouldCrit(
      ownSide.modifiers.critChance,
      ownSide.modifiers.luckMultiplier,
      this.rng.nextFloat()
    );
    const baseDamage = Math.floor(stats.damage * ownSide.modifiers.damageMultiplier);
    const damage = isCrit
      ? Math.floor(baseDamage * ownSide.modifiers.critDamage)
      : baseDamage;

    // Apply damage
    const enemySide = getEnemySide(this.state, side);

    if (target.type === 'fortress') {
      this.damageFortress(enemySide, damage, side, ownSide);
    } else if (target.type === 'hero' && target.targetIndex !== undefined) {
      const targetHero = enemySide.heroes[target.targetIndex];
      if (targetHero && targetHero.currentHp > 0) {
        this.damageHero(targetHero, damage, side, ownSide, enemySide);
      }
    }
  }

  // ============================================================================
  // TURRET UPDATES
  // ============================================================================

  private updateTurrets(side: 'left' | 'right', ownSide: ArenaSide): void {
    for (const turret of ownSide.turrets) {
      if (turret.currentHp <= 0) continue;

      // Get turret position
      const slot = TURRET_SLOTS.find(s => s.id === turret.slotIndex);
      if (!slot) continue;

      const turretX = FP.add(ownSide.fortress.x, FP.fromFloat(side === 'left' ? slot.offsetX : -slot.offsetX));
      const turretY = FP.fromFloat(7 + slot.offsetY);

      // Get target
      const target = selectTurretTarget(turret, turretX, turretY, side, this.state);

      if (target.type !== 'none') {
        this.turretAttack(turret, turretX, turretY, target, side, ownSide);
      }
    }
  }

  private turretAttack(
    turret: ActiveTurret,
    turretX: number,
    turretY: number,
    target: ArenaTarget,
    side: 'left' | 'right',
    ownSide: ArenaSide
  ): void {
    const def = getTurretById(turret.definitionId);
    if (!def) return;

    const stats = calculateTurretStats(def, turret.currentClass, turret.tier);
    // stats values are in fixed-point, convert for calculations
    const attackSpeed = FP.toFloat(stats.attackSpeed);
    const attackInterval = Math.floor(30 / attackSpeed);

    if (this.state.tick - turret.lastAttackTick < attackInterval) return;

    turret.lastAttackTick = this.state.tick;

    // Calculate damage (stats.damage is fixed-point)
    const isCrit = shouldCrit(
      ownSide.modifiers.critChance,
      ownSide.modifiers.luckMultiplier,
      this.rng.nextFloat()
    );
    const statsDamage = FP.toFloat(stats.damage);
    const baseDamage = Math.floor(statsDamage * ownSide.modifiers.damageMultiplier);
    const damage = isCrit
      ? Math.floor(baseDamage * ownSide.modifiers.critDamage)
      : baseDamage;

    // Create projectile (target.type is guaranteed to be 'hero' or 'fortress' here)
    if (target.type === 'hero' || target.type === 'fortress') {
      this.createProjectile(
        turretX,
        turretY,
        target.x,
        target.y,
        damage,
        'turret',
        turret.currentClass,
        side,
        ownSide,
        target.type,
        target.targetIndex
      );
    }
  }

  // ============================================================================
  // FORTRESS UPDATES
  // ============================================================================

  private updateFortressAttack(side: 'left' | 'right', ownSide: ArenaSide): void {
    const fortress = ownSide.fortress;

    const attackInterval = this.config.fortressAttackInterval;
    if (this.state.tick - fortress.lastAttackTick < attackInterval) return;

    // Get target (fortress attacks enemy heroes)
    const target = selectFortressTarget(fortress, side, this.state, FORTRESS_ATTACK_RANGE);

    if (target.type !== 'hero') return; // Fortress only targets heroes

    fortress.lastAttackTick = this.state.tick;

    // Calculate damage
    const isCrit = shouldCrit(
      ownSide.modifiers.critChance,
      ownSide.modifiers.luckMultiplier,
      this.rng.nextFloat()
    );
    const baseDamage = Math.floor(fortress.damage * ownSide.modifiers.damageMultiplier);
    const damage = isCrit
      ? Math.floor(baseDamage * ownSide.modifiers.critDamage)
      : baseDamage;

    // Create projectile
    this.createProjectile(
      fortress.x,
      fortress.y,
      target.x,
      target.y,
      damage,
      'fortress',
      fortress.class,
      side,
      ownSide,
      'hero',
      target.targetIndex
    );
  }

  // ============================================================================
  // PROJECTILES
  // ============================================================================

  private createProjectile(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    damage: number,
    sourceType: 'fortress' | 'turret' | 'hero',
    fortressClass: FortressClass,
    side: 'left' | 'right',
    ownSide: ArenaSide,
    targetType: 'fortress' | 'hero',
    targetIndex?: number
  ): void {
    const projectile: ActiveProjectile = {
      id: this.nextProjectileId++,
      type: this.getProjectileType(fortressClass),
      sourceType,
      sourceId: sourceType,
      targetEnemyId: targetIndex ?? 0,
      x: startX,
      y: startY,
      startX,
      startY,
      targetX,
      targetY,
      speed: PROJECTILE_SPEED,
      damage,
      effects: [],
      spawnTick: this.state.tick,
      class: fortressClass,
    };

    // Store target type for processing
    (projectile as unknown as Record<string, unknown>)._targetType = targetType;
    (projectile as unknown as Record<string, unknown>)._targetIndex = targetIndex;
    (projectile as unknown as Record<string, unknown>)._side = side;

    ownSide.projectiles.push(projectile);

    // Record replay event
    this.replayEvents.push({
      tick: this.state.tick,
      type: 'projectile',
      side,
      data: { startX, startY, targetX, targetY, damage },
    });
  }

  private getProjectileType(fortressClass: FortressClass): 'physical' | 'icicle' | 'fireball' | 'bolt' | 'laser' {
    switch (fortressClass) {
      case 'ice': return 'icicle';
      case 'fire': return 'fireball';
      case 'lightning': return 'bolt';
      case 'tech': return 'laser';
      default: return 'physical';
    }
  }

  private updateProjectiles(side: 'left' | 'right'): void {
    const ownSide = side === 'left' ? this.state.left : this.state.right;
    const enemySide = getEnemySide(this.state, side);
    const toRemove: number[] = [];

    for (const projectile of ownSide.projectiles) {
      // Move projectile towards target
      const dx = FP.sub(projectile.targetX, projectile.x);
      const dy = FP.sub(projectile.targetY, projectile.y);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      if (distSq <= FP.mul(projectile.speed, projectile.speed)) {
        // Reached target - apply damage
        const targetType = (projectile as unknown as Record<string, unknown>)._targetType as string;
        const targetIndex = (projectile as unknown as Record<string, unknown>)._targetIndex as number | undefined;

        if (targetType === 'fortress') {
          this.damageFortress(enemySide, projectile.damage, side, ownSide);
        } else if (targetType === 'hero' && targetIndex !== undefined) {
          const targetHero = enemySide.heroes[targetIndex];
          if (targetHero && targetHero.currentHp > 0) {
            this.damageHero(targetHero, projectile.damage, side, ownSide, enemySide);
          }
        }

        toRemove.push(projectile.id);
      } else {
        // Move towards target
        const dist = FP.sqrt(distSq);
        if (dist > 0) {
          projectile.x = FP.add(projectile.x, FP.div(FP.mul(dx, projectile.speed), dist));
          projectile.y = FP.add(projectile.y, FP.div(FP.mul(dy, projectile.speed), dist));
        }
      }
    }

    // Remove hit projectiles
    ownSide.projectiles = ownSide.projectiles.filter(p => !toRemove.includes(p.id));
  }

  // ============================================================================
  // DAMAGE APPLICATION
  // ============================================================================

  private damageFortress(
    targetSide: ArenaSide,
    damage: number,
    attackerSide: 'left' | 'right',
    attackerData: ArenaSide
  ): void {
    targetSide.fortress.hp -= damage;
    targetSide.stats.damageReceived += damage;
    attackerData.stats.damageDealt += damage;

    // Record replay event
    this.replayEvents.push({
      tick: this.state.tick,
      type: 'fortress_damage',
      side: attackerSide === 'left' ? 'right' : 'left', // Target side
      data: { damage, remainingHp: targetSide.fortress.hp },
    });

    if (targetSide.fortress.hp <= 0) {
      targetSide.fortress.hp = 0;
    }
  }

  private damageHero(
    targetHero: ActiveHero,
    damage: number,
    attackerSide: 'left' | 'right',
    attackerData: ArenaSide,
    targetSide: ArenaSide
  ): void {
    targetHero.currentHp -= damage;
    targetSide.stats.damageReceived += damage;
    attackerData.stats.damageDealt += damage;

    // Record replay event
    this.replayEvents.push({
      tick: this.state.tick,
      type: 'damage',
      side: attackerSide,
      data: {
        targetHeroId: targetHero.definitionId,
        damage,
        remainingHp: targetHero.currentHp,
      },
    });

    if (targetHero.currentHp <= 0) {
      targetHero.currentHp = 0;
      targetHero.state = 'dead';
      attackerData.stats.heroesKilled++;
      targetSide.stats.heroesLost++;

      // Record death event
      this.replayEvents.push({
        tick: this.state.tick,
        type: 'hero_death',
        side: attackerSide === 'left' ? 'right' : 'left',
        data: { heroId: targetHero.definitionId },
      });
    }
  }

  // ============================================================================
  // END CONDITIONS
  // ============================================================================

  private checkEndConditions(): void {
    const leftFortressDestroyed = this.state.left.fortress.hp <= 0;
    const rightFortressDestroyed = this.state.right.fortress.hp <= 0;

    if (leftFortressDestroyed && rightFortressDestroyed) {
      // Draw - both destroyed in same tick
      this.state.ended = true;
      this.state.winner = null;
      this.state.winReason = 'draw';
    } else if (leftFortressDestroyed) {
      this.state.ended = true;
      this.state.winner = 'right';
      this.state.winReason = 'fortress_destroyed';
    } else if (rightFortressDestroyed) {
      this.state.ended = true;
      this.state.winner = 'left';
      this.state.winReason = 'fortress_destroyed';
    }
  }

  private handleTimeout(): void {
    this.state.ended = true;

    // Determine winner by HP percentage
    const leftHpPercent = this.state.left.fortress.hp / this.state.left.fortress.maxHp;
    const rightHpPercent = this.state.right.fortress.hp / this.state.right.fortress.maxHp;

    if (leftHpPercent > rightHpPercent) {
      this.state.winner = 'left';
      this.state.winReason = 'timeout';
    } else if (rightHpPercent > leftHpPercent) {
      this.state.winner = 'right';
      this.state.winReason = 'timeout';
    } else {
      // Equal HP - draw
      this.state.winner = null;
      this.state.winReason = 'draw';
    }
  }

  // ============================================================================
  // RESULTS
  // ============================================================================

  getResult(): ArenaResult {
    const leftAliveHeroes = this.state.left.heroes.filter(h => h.currentHp > 0).length;
    const rightAliveHeroes = this.state.right.heroes.filter(h => h.currentHp > 0).length;

    return {
      winner: this.state.winner,
      winReason: this.state.winReason ?? 'draw',
      duration: this.state.tick,
      leftStats: {
        finalHp: this.state.left.fortress.hp,
        damageDealt: this.state.left.stats.damageDealt,
        heroesAlive: leftAliveHeroes,
      },
      rightStats: {
        finalHp: this.state.right.fortress.hp,
        damageDealt: this.state.right.stats.damageDealt,
        heroesAlive: rightAliveHeroes,
      },
      replayEvents: this.replayEvents,
    };
  }

  /**
   * Get current state (for rendering)
   */
  getState(): ArenaState {
    return this.state;
  }

  /**
   * Get replay events (for playback)
   */
  getReplayEvents(): ArenaReplayEvent[] {
    return this.replayEvents;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Run a complete arena battle and return the result
 */
export function runArenaBattle(
  seed: number,
  leftBuild: ArenaBuildConfig,
  rightBuild: ArenaBuildConfig,
  config?: ArenaConfig
): ArenaResult {
  const simulation = new ArenaSimulation(seed, leftBuild, rightBuild, config);
  return simulation.run();
}
