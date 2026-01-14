/**
 * Projectile System
 *
 * Handles projectile movement, collision, and effects:
 * - Projectile tracking and movement
 * - Damage application on hit
 * - Status effects (burn, poison, slow, freeze, stun)
 * - Projectile creation for heroes, turrets, fortress
 */

import { FP } from '../fixed.js';
import type {
  GameState,
  SimConfig,
  Enemy,
  ActiveHero,
  ActiveTurret,
  ActiveProjectile,
  FortressClass,
  ProjectileType,
  SkillEffect,
  StatusEffectType,
} from '../types.js';
import { analytics } from '../analytics.js';
import { calculateHeroStoneLifesteal } from './infinity-stones.js';
import {
  PROJECTILE_BASE_SPEED,
  HIT_FLASH_TICKS,
  DEFAULT_EFFECT_DURATION,
} from './constants.js';

/**
 * Update all projectiles - movement and collision
 */
export function updateProjectiles(
  state: GameState,
  _config: SimConfig
): void {
  const toRemove: number[] = [];

  for (const projectile of state.projectiles) {
    // Find target enemy and update tracking position
    const targetEnemy = state.enemies.find(e => e.id === projectile.targetEnemyId);

    if (targetEnemy && targetEnemy.hp > 0) {
      // Update target position to track the moving enemy
      projectile.targetX = targetEnemy.x;
      projectile.targetY = targetEnemy.y;
    } else {
      // Target enemy is dead or gone - remove projectile
      toRemove.push(projectile.id);
      continue;
    }

    const dx = FP.sub(projectile.targetX, projectile.x);
    const dy = FP.sub(projectile.targetY, projectile.y);
    const distSq = FP.lengthSq2D(dx, dy);

    // Prevent division by zero
    if (distSq === 0) {
      // Already at target - apply damage
      applyProjectileDamage(projectile, state);
      toRemove.push(projectile.id);
      continue;
    }

    const dist = FP.sqrt(distSq);
    if (dist <= projectile.speed) {
      // Reached target - apply damage
      applyProjectileDamage(projectile, state);
      toRemove.push(projectile.id);
    } else {
      // Move towards target
      const direction = FP.normalize2D(dx, dy);
      projectile.x = FP.add(projectile.x, FP.mul(direction.x, projectile.speed));
      projectile.y = FP.add(projectile.y, FP.mul(direction.y, projectile.speed));
    }

    // Check timeout (projectile lived too long)
    if (state.tick - projectile.spawnTick > 300) {
      toRemove.push(projectile.id);
    }
  }

  // Remove finished projectiles using Set for O(1) lookup
  const removeSet = new Set(toRemove);
  state.projectiles = state.projectiles.filter(p => !removeSet.has(p.id));
}

/**
 * Apply projectile damage on hit
 */
function applyProjectileDamage(projectile: ActiveProjectile, state: GameState): void {
  // Find target enemy
  const enemy = state.enemies.find(e => e.id === projectile.targetEnemyId);

  if (enemy && enemy.hp > 0) {
    const damageDealt = Math.min(projectile.damage, enemy.hp);
    enemy.hp -= projectile.damage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;

    analytics.trackDamage(
      projectile.sourceType,
      String(projectile.sourceId),
      damageDealt
    );

    // Apply lifesteal for hero projectiles
    if (projectile.sourceType === 'hero') {
      const hero = state.heroes.find(h => h.definitionId === projectile.sourceId);
      if (hero && hero.infinityStone) {
        const lifestealPercent = calculateHeroStoneLifesteal(hero.infinityStone);
        if (lifestealPercent > 0) {
          const healAmount = Math.floor(damageDealt * lifestealPercent);
          hero.currentHp = Math.min(hero.currentHp + healAmount, hero.maxHp);
          analytics.trackHealing(String(projectile.sourceId), healAmount);
        }
      }
    }

    // Apply additional effects
    for (const effect of projectile.effects) {
      applyEffectToEnemy(effect, enemy, state);
    }
  }
}

/**
 * Update all enemy status effects - tick down durations, apply DOT, remove expired
 */
export function updateEnemyStatusEffects(state: GameState): void {
  for (const enemy of state.enemies) {
    if (!enemy.activeEffects || enemy.activeEffects.length === 0) continue;

    // Process each effect
    for (let i = enemy.activeEffects.length - 1; i >= 0; i--) {
      const effect = enemy.activeEffects[i];

      // Tick down duration
      effect.remainingTicks--;

      // Apply DOT for burn/poison (every 30 ticks = 1 second at 30Hz)
      if ((effect.type === 'burn' || effect.type === 'poison') && state.tick % 30 === 0) {
        enemy.hp -= effect.strength;
        enemy.hitFlashTicks = 3; // Visual feedback for DOT
      }

      // Remove expired effects
      if (effect.remainingTicks <= 0) {
        enemy.activeEffects.splice(i, 1);

        // Restore speed for slow/freeze/stun when they expire
        // Note: This is simplified - in a more complex system we'd recalculate
        // the combined slow effect from all remaining slow effects
      }
    }
  }
}

/**
 * Apply skill effect to enemy
 */
export function applyEffectToEnemy(effect: SkillEffect, enemy: Enemy, state: GameState): void {
  const effectDuration = effect.duration || DEFAULT_EFFECT_DURATION;

  switch (effect.type) {
    case 'damage':
      enemy.hp -= effect.amount || 0;
      break;
    case 'slow':
      // Apply slow effect and track it
      addStatusEffect(enemy, 'slow', effectDuration, effect.percent || 0.3, state.tick);
      enemy.speed = FP.mul(enemy.speed, FP.fromFloat(1 - (effect.percent || 0.3)));
      break;
    case 'burn':
      // Track burn DOT effect
      addStatusEffect(enemy, 'burn', effectDuration, effect.damagePerTick || 5, state.tick);
      // Apply initial tick of damage
      enemy.hp -= effect.damagePerTick || 5;
      break;
    case 'poison':
      // Track poison DOT effect
      addStatusEffect(enemy, 'poison', effectDuration, effect.damagePerTick || 5, state.tick);
      // Apply initial tick of damage
      enemy.hp -= effect.damagePerTick || 5;
      break;
    case 'freeze':
      // Track freeze effect
      addStatusEffect(enemy, 'freeze', effectDuration, 1.0, state.tick);
      enemy.speed = 0;
      break;
    case 'stun':
      // Track stun effect
      addStatusEffect(enemy, 'stun', effectDuration, 1.0, state.tick);
      enemy.speed = 0;
      break;
  }
}

/**
 * Add or refresh a status effect on an enemy
 */
function addStatusEffect(
  enemy: Enemy,
  type: StatusEffectType,
  duration: number,
  strength: number,
  currentTick: number
): void {
  // Check if effect already exists - refresh it
  const existingIndex = enemy.activeEffects.findIndex(e => e.type === type);

  if (existingIndex >= 0) {
    // Refresh: keep the stronger effect and reset duration
    const existing = enemy.activeEffects[existingIndex];
    enemy.activeEffects[existingIndex] = {
      type,
      remainingTicks: duration,
      strength: Math.max(existing.strength, strength),
      appliedTick: currentTick,
    };
  } else {
    // Add new effect
    enemy.activeEffects.push({
      type,
      remainingTicks: duration,
      strength,
      appliedTick: currentTick,
    });
  }
}

/**
 * Get projectile type for class
 */
function getProjectileTypeForClass(fortressClass: FortressClass): ProjectileType {
  switch (fortressClass) {
    case 'natural': return 'physical';
    case 'ice': return 'icicle';
    case 'fire': return 'fireball';
    case 'lightning': return 'bolt';
    case 'tech': return 'laser';
    default: return 'physical';
  }
}

/**
 * Create a projectile from hero attack
 */
export function createHeroProjectile(
  hero: ActiveHero,
  target: Enemy,
  state: GameState,
  heroClass: FortressClass,
  damage: number
): void {
  const projectile: ActiveProjectile = {
    id: state.nextProjectileId++,
    type: getProjectileTypeForClass(heroClass),
    sourceType: 'hero',
    sourceId: hero.definitionId,
    targetEnemyId: target.id,
    x: hero.x,
    y: hero.y,
    startX: hero.x,
    startY: hero.y,
    targetX: target.x,
    targetY: target.y,
    speed: PROJECTILE_BASE_SPEED,
    damage: damage,
    effects: [],
    spawnTick: state.tick,
    class: heroClass,
  };

  state.projectiles.push(projectile);
}

/**
 * Create a projectile from turret attack
 */
export function createTurretProjectile(
  turret: ActiveTurret,
  target: Enemy,
  state: GameState,
  turretX: number,
  turretY: number,
  turretClass: FortressClass,
  damage: number
): void {
  const projectile: ActiveProjectile = {
    id: state.nextProjectileId++,
    type: getProjectileTypeForClass(turretClass),
    sourceType: 'turret',
    sourceId: turret.definitionId,
    targetEnemyId: target.id,
    x: turretX,
    y: turretY,
    startX: turretX,
    startY: turretY,
    targetX: target.x,
    targetY: target.y,
    speed: FP.fromFloat(1.2), // Turrets slightly faster than base (1.0)
    damage: damage,
    effects: [],
    spawnTick: state.tick,
    class: turretClass,
  };

  state.projectiles.push(projectile);
}

/**
 * Create a projectile from fortress attack
 */
export function createFortressProjectile(
  target: Enemy,
  state: GameState,
  config: SimConfig,
  damage: number
): void {
  const projectile: ActiveProjectile = {
    id: state.nextProjectileId++,
    type: getProjectileTypeForClass(state.fortressClass),
    sourceType: 'fortress',
    sourceId: 0,
    targetEnemyId: target.id,
    x: config.fortressX,
    y: FP.fromInt(7),
    startX: config.fortressX,
    startY: FP.fromInt(7),
    targetX: target.x,
    targetY: target.y,
    speed: PROJECTILE_BASE_SPEED,
    damage: damage,
    effects: [],
    spawnTick: state.tick,
    class: state.fortressClass,
  };

  state.projectiles.push(projectile);
}
