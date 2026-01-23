/**
 * Arena PvP Simulation
 *
 * Main simulation class for 1v1 arena battles.
 * Two fortresses fight each other with heroes.
 */

import { Xorshift32 } from '../rng.js';
import { FP } from '../fixed.js';
import type { ActiveHero, ActiveProjectile, FortressClass } from '../types.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
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
  FORTRESS_EXCLUSION_RADIUS,
  ARENA_DAMAGE_MULTIPLIER,
} from './arena-state.js';
import {
  selectHeroTarget,
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
const HERO_MAX_SPEED = FP.fromFloat(0.25); // Max hero speed in arena (slower for better visuals)

// ============================================================================
// DAMAGE MITIGATION
// ============================================================================

/** Maximum armor cap - prevents any unit from being unkillable */
const MAX_ARMOR_CAP = 60; // Max 37.5% damage reduction

/**
 * Calculate damage after armor mitigation
 * Uses diminishing returns formula: final = base * (100 / (100 + armor))
 *
 * With MAX_ARMOR_CAP = 60:
 * - 0 armor: 0% reduction
 * - 30 armor: 23% reduction
 * - 60 armor: 37.5% reduction (MAX)
 */
function applyArmorMitigation(baseDamage: number, armor: number): number {
  if (armor <= 0) return baseDamage;
  const cappedArmor = Math.min(armor, MAX_ARMOR_CAP);
  const reduction = 100 / (100 + cappedArmor);
  return Math.max(1, Math.floor(baseDamage * reduction)); // Minimum 1 damage
}

/**
 * Apply arena damage multiplier to reduce overall damage output
 */
function applyArenaDamageMultiplier(damage: number): number {
  return Math.max(1, Math.floor(damage * ARENA_DAMAGE_MULTIPLIER));
}

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

    // Update fortress attack
    this.updateFortressAttack(side, ownSide);
  }

  // ============================================================================
  // HERO UPDATES
  // ============================================================================

  private updateHeroes(side: 'left' | 'right', ownSide: ArenaSide): void {
    const enemySide = getEnemySide(this.state, side);

    for (const hero of ownSide.heroes) {
      if (hero.currentHp <= 0) continue;

      // Get attack target
      const target = selectHeroTarget(hero, side, this.state);

      // Always attack if target in range
      if (target.type === 'fortress' || target.type === 'hero') {
        this.heroAttack(hero, target, side, ownSide);
      }

      // Move towards enemy fortress if not attacking fortress
      if (target.type !== 'fortress') {
        const moveTarget: ArenaTarget = {
          type: 'move',
          x: enemySide.fortress.x,
          y: enemySide.fortress.y,
        };
        this.moveHero(hero, moveTarget);
      }

      // Clamp hero position to field
      hero.x = FP.clamp(hero.x, FP.fromInt(0), this.config.fieldWidth);
      hero.y = FP.clamp(hero.y, FP.fromInt(0), this.config.fieldHeight);

      // Enforce fortress exclusion zones - prevent heroes from entering fortress areas
      this.enforceExclusionZone(hero, this.state.left.fortress);
      this.enforceExclusionZone(hero, this.state.right.fortress);
    }
  }

  /**
   * Push hero out of fortress exclusion zone
   */
  private enforceExclusionZone(hero: ActiveHero, fortress: { x: number; y: number }): void {
    const dx = FP.sub(hero.x, fortress.x);
    const dy = FP.sub(hero.y, fortress.y);
    const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
    const exclusionRadiusSq = FP.mul(FORTRESS_EXCLUSION_RADIUS, FORTRESS_EXCLUSION_RADIUS);

    // Check if distance is very small (below epsilon threshold)
    const epsilonSq = FP.mul(FP.EPSILON, FP.EPSILON);
    if (distSq < exclusionRadiusSq && distSq > epsilonSq) {
      // Hero is inside exclusion zone, push them out
      const dist = FP.sqrt(distSq);
      // Normalize direction away from fortress
      const normX = FP.div(dx, dist);
      const normY = FP.div(dy, dist);
      // Place hero just outside exclusion radius
      hero.x = FP.add(fortress.x, FP.mul(normX, FORTRESS_EXCLUSION_RADIUS));
      hero.y = FP.add(fortress.y, FP.mul(normY, FORTRESS_EXCLUSION_RADIUS));
      // Stop velocity
      hero.vx = 0;
      hero.vy = 0;
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
    const attackSpeedMultiplier =
      (hero.arenaAttackSpeedMultiplier ?? 1) *
      (1 + ownSide.modifiers.attackSpeedBonus);
    const effectiveAttackSpeed = stats.attackSpeed * attackSpeedMultiplier;
    const attackInterval = Math.max(1, Math.floor(30 / effectiveAttackSpeed)); // Convert attacks/sec to ticks

    if (this.state.tick - hero.lastAttackTick < attackInterval) return;

    hero.lastAttackTick = this.state.tick;

    // Calculate damage (additive bonus system)
    const isCrit = shouldCrit(ownSide.modifiers.critChance, this.rng.nextFloat());
    const baseDamage = Math.floor(stats.damage * (1 + ownSide.modifiers.damageBonus));
    const heroDamageMultiplier = hero.arenaDamageMultiplier ?? 1;
    const rawDamage = isCrit
      ? Math.floor(
          baseDamage *
            heroDamageMultiplier *
            (1 + ownSide.modifiers.critDamageBonus)
        )
      : Math.floor(baseDamage * heroDamageMultiplier);

    // Apply arena damage reduction for longer battles
    const damage = applyArenaDamageMultiplier(rawDamage);

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
  // FORTRESS UPDATES
  // ============================================================================

  private updateFortressAttack(side: 'left' | 'right', ownSide: ArenaSide): void {
    const fortress = ownSide.fortress;

    const attackInterval = this.config.fortressAttackInterval;
    if (this.state.tick - fortress.lastAttackTick < attackInterval) return;

    // Get target (fortress attacks enemy heroes or enemy fortress if no heroes)
    const target = selectFortressTarget(fortress, side, this.state, FORTRESS_ATTACK_RANGE);

    if (target.type !== 'hero' && target.type !== 'fortress') return;

    fortress.lastAttackTick = this.state.tick;

    // Calculate damage (additive bonus system)
    const isCrit = shouldCrit(ownSide.modifiers.critChance, this.rng.nextFloat());
    const baseDamage = Math.floor(fortress.damage * (1 + ownSide.modifiers.damageBonus));
    const rawDamage = isCrit
      ? Math.floor(baseDamage * (1 + ownSide.modifiers.critDamageBonus))
      : baseDamage;

    // Apply arena damage reduction for longer battles
    const damage = applyArenaDamageMultiplier(rawDamage);

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
      target.type, // 'hero' or 'fortress'
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

    // Store target type for processing (typed fields)
    projectile.arenaTargetType = targetType;
    projectile.arenaTargetIndex = targetIndex;
    projectile.arenaSide = side;

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

  /**
   * Deterministic ray-circle intersection test
   * Checks if a ray from p0 to p1 intersects a circle at center c with radius r
   * Returns true if the ray intersects the circle
   * 
   * Algorithm: Find closest point on ray to circle center, check if within radius
   */
  private rayIntersectsCircle(
    p0x: number, p0y: number,  // Ray start (fixed-point)
    p1x: number, p1y: number,  // Ray end (fixed-point)
    cx: number, cy: number,    // Circle center (fixed-point)
    r: number                   // Circle radius (fixed-point)
  ): boolean {
    // Ray direction vector
    const rayDx = FP.sub(p1x, p0x);
    const rayDy = FP.sub(p1y, p0y);
    const rayLenSq = FP.lengthSq2D(rayDx, rayDy);
    
    // If ray has zero length, check if start point is in circle
    if (rayLenSq === 0) {
      const distSq = FP.lengthSq2D(FP.sub(cx, p0x), FP.sub(cy, p0y));
      const rSq = FP.mul(r, r);
      return distSq <= rSq;
    }
    
    // Vector from ray start to circle center
    const toCenterDx = FP.sub(cx, p0x);
    const toCenterDy = FP.sub(cy, p0y);
    
    // Project toCenter onto ray direction to find closest point
    // t = dot(toCenter, rayDir) / length(rayDir)^2
    const dot = FP.dot2D(toCenterDx, toCenterDy, rayDx, rayDy);
    const t = FP.div(dot, rayLenSq);
    
    // Clamp t to [0, 1] to stay on ray segment
    const tClamped = FP.clamp(t, 0, FP.ONE);
    
    // Closest point on ray to circle center
    const closestX = FP.add(p0x, FP.mul(rayDx, tClamped));
    const closestY = FP.add(p0y, FP.mul(rayDy, tClamped));
    
    // Distance from closest point to circle center
    const distToCenterDx = FP.sub(cx, closestX);
    const distToCenterDy = FP.sub(cy, closestY);
    const distSq = FP.lengthSq2D(distToCenterDx, distToCenterDy);
    const rSq = FP.mul(r, r);
    
    return distSq <= rSq;
  }

  /**
   * Update projectiles for one side
   * 
   * Uses deterministic ray marching instead of distance checks:
   * - Moves projectile by speed units along direction vector
   * - Checks if ray from old position to new position intersects target's hit circle
   * - This avoids non-deterministic behavior from float rounding in distance calculations
   * 
   * IMPORTANT: This is called AFTER heroes have moved (in updateSide),
   *            ensuring projectiles read target positions from current tick
   */
  private updateProjectiles(side: 'left' | 'right'): void {
    const ownSide = side === 'left' ? this.state.left : this.state.right;
    const enemySide = getEnemySide(this.state, side);
    const toRemove: number[] = [];

    for (const projectile of ownSide.projectiles) {
      // Update target position if target is still alive
      const targetType = projectile.arenaTargetType;
      const targetIndex = projectile.arenaTargetIndex;
      
      let targetX = projectile.targetX;
      let targetY = projectile.targetY;
      let hitRadius: number;
      
      if (targetType === 'fortress') {
        // Fortress target - use fortress position
        targetX = enemySide.fortress.x;
        targetY = enemySide.fortress.y;
        // Fortress hit radius (smaller than hero radius)
        hitRadius = FP.fromFloat(1.0);
      } else if (targetType === 'hero' && targetIndex !== undefined) {
        // Hero target - update position if hero is alive
        const targetHero = enemySide.heroes[targetIndex];
        if (targetHero && targetHero.currentHp > 0) {
          targetX = targetHero.x;
          targetY = targetHero.y;
          // Use hero radius + small tolerance
          hitRadius = FP.add(targetHero.radius, FP.fromFloat(0.1));
        } else {
          // Hero is dead, use last known position with small radius
          hitRadius = FP.fromFloat(0.1);
        }
      } else {
        // Unknown target type, use small fallback radius
        hitRadius = FP.fromFloat(0.1);
      }

      // Store previous position for ray marching
      const prevX = projectile.x;
      const prevY = projectile.y;

      const dx = FP.sub(targetX, projectile.x);
      const dy = FP.sub(targetY, projectile.y);
      const distSq = FP.lengthSq2D(dx, dy);

      // Prevent division by zero
      if (distSq === 0) {
        // Already at target - apply damage
        if (targetType === 'fortress') {
          this.damageFortress(enemySide, projectile.damage, side, ownSide);
        } else if (targetType === 'hero' && targetIndex !== undefined) {
          const targetHero = enemySide.heroes[targetIndex];
          if (targetHero && targetHero.currentHp > 0) {
            this.damageHero(targetHero, projectile.damage, side, ownSide, enemySide);
          }
        }
        toRemove.push(projectile.id);
        continue;
      }

      // Normalize direction vector
      const direction = FP.normalize2D(dx, dy);
      
      // Move projectile by speed units along direction (deterministic ray march)
      const newX = FP.add(projectile.x, FP.mul(direction.x, projectile.speed));
      const newY = FP.add(projectile.y, FP.mul(direction.y, projectile.speed));
      
      // Check if ray from previous position to new position intersects target
      const hitTarget = this.rayIntersectsCircle(
        prevX, prevY,  // Ray start (previous position)
        newX, newY,    // Ray end (new position)
        targetX, targetY,  // Circle center (target position)
        hitRadius      // Circle radius
      );
      
      if (hitTarget) {
        // Ray intersected target - apply damage
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
        // Update position
        projectile.x = newX;
        projectile.y = newY;
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
    // Apply armor mitigation
    const mitigatedDamage = applyArmorMitigation(damage, targetSide.fortress.armor);

    targetSide.fortress.hp -= mitigatedDamage;
    targetSide.stats.damageReceived += mitigatedDamage;
    attackerData.stats.damageDealt += mitigatedDamage;

    // Record replay event
    this.replayEvents.push({
      tick: this.state.tick,
      type: 'fortress_damage',
      side: attackerSide === 'left' ? 'right' : 'left', // Target side
      data: { damage: mitigatedDamage, remainingHp: targetSide.fortress.hp },
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
    if (targetHero.currentHp <= 0) return;

    // Apply armor mitigation
    const heroArmor = targetHero.arenaArmor ?? 0;
    const mitigatedDamage = applyArmorMitigation(damage, heroArmor);

    const prevHp = targetHero.currentHp;
    targetHero.currentHp = Math.max(0, targetHero.currentHp - mitigatedDamage);
    targetSide.stats.damageReceived += mitigatedDamage;
    const killed = targetHero.currentHp <= 0;
    if (killed) {
      targetSide.stats.heroesLost += 1;
      attackerData.stats.heroesKilled += 1;
      this.replayEvents.push({
        tick: this.state.tick,
        type: 'hero_death',
        side: attackerSide === 'left' ? 'right' : 'left',
        data: {
          heroId: targetHero.definitionId,
          damage: mitigatedDamage,
          prevHp,
          remainingHp: 0,
        },
      });
    }
    attackerData.stats.damageDealt += mitigatedDamage;
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
