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
import { calculateArtifactLifesteal, getArtifactOnHitEffect } from './artifacts.js';
import {
  PROJECTILE_BASE_SPEED,
  HIT_FLASH_TICKS,
  DEFAULT_EFFECT_DURATION,
} from './constants.js';
import { trackDamageHit, getArmorBreakMultiplier, type ComboTrigger } from './combos.js';
import { hasHeroPassive } from '../data/heroes.js';

// Store combo triggers for this tick (for VFX)
let pendingComboTriggers: ComboTrigger[] = [];

/**
 * Get and clear pending combo triggers (for VFX)
 */
export function popComboTriggers(): ComboTrigger[] {
  const triggers = pendingComboTriggers;
  pendingComboTriggers = [];
  return triggers;
}

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
    // Apply armor break multiplier from shatter combo (if active)
    const armorMultiplier = getArmorBreakMultiplier(enemy);
    let baseDamage = Math.floor(projectile.damage * armorMultiplier);

    // Shatter Shot: double damage vs frozen targets
    if (projectile.skillId === 'shatter_shot') {
      const isFrozen = enemy.activeEffects.some(e => e.type === 'freeze' && e.remainingTicks > 0);
      if (isFrozen) {
        baseDamage *= 2;
      }
    }

    const damageDealt = Math.min(baseDamage, enemy.hp);
    enemy.hp -= baseDamage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;

    // Track damage hit for combo system
    if (projectile.class) {
      const comboTrigger = trackDamageHit(enemy, projectile.class, damageDealt, state);
      if (comboTrigger) {
        pendingComboTriggers.push(comboTrigger);
      }
    }

    analytics.trackDamage(
      projectile.sourceType,
      String(projectile.sourceId),
      damageDealt
    );

    // Apply lifesteal for hero projectiles (from infinity stones and artifacts)
    if (projectile.sourceType === 'hero') {
      const hero = state.heroes.find(h => h.definitionId === projectile.sourceId);
      if (hero) {
        // Calculate total lifesteal from both infinity stone and artifact
        const stoneLifesteal = hero.infinityStone ? calculateHeroStoneLifesteal(hero.infinityStone) : 0;
        const artifactLifesteal = calculateArtifactLifesteal(hero.equippedArtifact);
        const totalLifesteal = stoneLifesteal + artifactLifesteal;

        if (totalLifesteal > 0) {
          const healAmount = Math.floor(damageDealt * totalLifesteal);
          hero.currentHp = Math.min(hero.currentHp + healAmount, hero.maxHp);
          analytics.trackHealing(String(projectile.sourceId), healAmount);
        }

        // Apply artifact on-hit effects (slow, freeze, burn)
        // Use deterministic pseudo-random based on projectile id and tick
        const rngSeed = ((projectile.id * 2654435761) ^ state.tick) >>> 0;
        const rngValue = (rngSeed % 10000) / 10000; // 0.0 - 0.9999
        const onHitEffect = getArtifactOnHitEffect(hero.equippedArtifact, rngValue);
        if (onHitEffect) {
          applyEffectToEnemy(onHitEffect, enemy, state);
        }
      }
    }

    // Apply additional effects
    for (const effect of projectile.effects) {
      applyEffectToEnemy(effect, enemy, state);
    }

    // Chain Lightning mechanic for STORM hero
    if (projectile.sourceType === 'hero' && projectile.sourceId === 'storm' && !projectile.isChained) {
      const hero = state.heroes.find(h => h.definitionId === 'storm');
      if (hero) {
        const heroTier = (hero.tier || 1) as 1 | 2 | 3;
        const heroLevel = hero.level || 1;

        // Check passives for chain parameters
        const hasStormPassive = hasHeroPassive('storm', 'storm_passive', heroTier, heroLevel);
        const hasStormLord = hasHeroPassive('storm', 'storm_lord', heroTier, heroLevel);

        if (hasStormPassive) {
          // Base: 2 additional targets, 70% damage decay
          // With storm_lord: 3 additional targets, 80% damage decay
          const maxChainTargets = hasStormLord ? 3 : 2;
          const chainDamageMultiplier = hasStormLord ? 0.80 : 0.70;
          const chainRange = FP.fromInt(4); // 4 units max between chain targets

          // Find nearby enemies to chain to (excluding already hit enemy)
          const nearbyEnemies = state.enemies
            .filter(e => e.id !== enemy.id && e.hp > 0)
            .filter(e => {
              const dx = e.x - enemy.x;
              const dy = e.y - enemy.y;
              const distSq = FP.mul(dx, dx) + FP.mul(dy, dy);
              return distSq <= FP.mul(chainRange, chainRange);
            })
            .slice(0, maxChainTargets);

          // Create chain projectiles with reduced damage
          let currentDamage = baseDamage;
          for (const chainTarget of nearbyEnemies) {
            currentDamage = Math.floor(currentDamage * chainDamageMultiplier);
            if (currentDamage <= 0) break;

            createChainProjectile(enemy, chainTarget, state, currentDamage, projectile.effects);
          }
        }
      }
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
        const expiredType = effect.type;
        enemy.activeEffects.splice(i, 1);

        // Recalculate speed when slow/freeze/stun expire
        if (expiredType === 'slow' || expiredType === 'freeze' || expiredType === 'stun') {
          recalculateEnemySpeed(enemy);
        }
      }
    }
  }
}

/**
 * Recalculate enemy speed based on baseSpeed and active effects
 */
function recalculateEnemySpeed(enemy: Enemy): void {
  // Start with base speed
  let newSpeed = enemy.baseSpeed;

  // Check for freeze/stun first - they set speed to 0
  const hasHardCC = enemy.activeEffects.some(e => e.type === 'freeze' || e.type === 'stun');
  if (hasHardCC) {
    enemy.speed = 0;
    return;
  }

  // Apply all slow effects multiplicatively
  for (const effect of enemy.activeEffects) {
    if (effect.type === 'slow') {
      // strength is already stored as decimal (e.g. 0.3 for 30% slow)
      newSpeed = FP.mul(newSpeed, FP.fromFloat(1 - effect.strength));
    }
  }

  enemy.speed = newSpeed;
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
    case 'slow': {
      // Convert percent to decimal if needed (30 -> 0.3, 0.3 -> 0.3)
      const slowPercent = (effect.percent || 30) > 1 ? (effect.percent || 30) / 100 : (effect.percent || 0.3);
      // Apply slow effect and track it
      addStatusEffect(enemy, 'slow', effectDuration, slowPercent, state.tick);
      // Recalculate speed from baseSpeed with all active slow effects
      recalculateEnemySpeed(enemy);
      break;
    }
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
      recalculateEnemySpeed(enemy);
      break;
    case 'stun':
      // Track stun effect
      addStatusEffect(enemy, 'stun', effectDuration, 1.0, state.tick);
      recalculateEnemySpeed(enemy);
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
 * Create a chain lightning projectile (for STORM)
 * Originates from the previously hit enemy, marked as chained to prevent infinite chaining
 */
function createChainProjectile(
  fromEnemy: Enemy,
  target: Enemy,
  state: GameState,
  damage: number,
  effects: SkillEffect[]
): void {
  const projectile: ActiveProjectile = {
    id: state.nextProjectileId++,
    type: 'bolt', // Chain lightning uses bolt projectile type
    sourceType: 'hero',
    sourceId: 'storm',
    targetEnemyId: target.id,
    x: fromEnemy.x,
    y: fromEnemy.y,
    startX: fromEnemy.x,
    startY: fromEnemy.y,
    targetX: target.x,
    targetY: target.y,
    speed: PROJECTILE_BASE_SPEED * 1.5, // Chain lightning is faster
    damage: damage,
    effects: effects,
    spawnTick: state.tick,
    class: 'lightning',
    isChained: true, // Mark as chained to prevent infinite recursion
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
