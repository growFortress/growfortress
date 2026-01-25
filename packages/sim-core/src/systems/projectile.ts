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
  DamageAttribution,
  DamageOwnerType,
  DamageMechanicType,
  EnemyType,
} from '../types.js';
import { analytics } from '../analytics.js';
import { calculateHeroStoneLifesteal } from './infinity-stones.js';
import { calculateArtifactLifesteal, getArtifactOnHitEffect } from './artifacts.js';
import {
  PROJECTILE_BASE_SPEED,
  HIT_FLASH_TICKS,
  DEFAULT_EFFECT_DURATION,
  PIERCE_HIT_RADIUS,
  PIERCE_DAMAGE_MULTIPLIER,
  PIERCE_DAMAGE_FALLOFF,
  PROJECTILE_CLASS_SPEED,
  FORTRESS_CLASS_DAMAGE,
  FORTRESS_CLASS_PIERCE,
  // New physics constants
  PROJECTILE_CLASS_TRAJECTORY,
  ARC_GRAVITY,
  ARC_LAUNCH_ANGLE,
  PROJECTILE_CLASS_HOMING,
  HOMING_MAX_TURN_RATE,
  PROJECTILE_CLASS_HIT_RADIUS,
  PROJECTILE_BASE_HIT_RADIUS,
} from './constants.js';
import { trackDamageHit, getArmorBreakMultiplier, type ComboTrigger } from './combos.js';
import { hasHeroPassive } from '../data/heroes.js';
import { calculateKnockback } from '../physics.js';

// Store combo triggers for this tick (for VFX)
let pendingComboTriggers: ComboTrigger[] = [];

// Store death physics for this tick (for visual ragdoll system)
let pendingDeathPhysics: DeathPhysicsEvent[] = [];

/**
 * Death physics event for visual ragdoll system
 * Emitted when an enemy dies from projectile damage
 */
export interface DeathPhysicsEvent {
  /** Unique enemy ID */
  enemyId: number;
  /** Enemy type (for visual representation) */
  enemyType: EnemyType;
  /** Whether this was an elite enemy */
  isElite: boolean;
  /** Position at death (fixed-point) */
  x: number;
  y: number;
  /** Knockback velocity X (fixed-point) */
  kbX: number;
  /** Knockback velocity Y (fixed-point) */
  kbY: number;
  /** Angular spin force (radians/sec) */
  spinForce: number;
  /** Whether this was a big kill (for extra VFX) */
  isBigKill: boolean;
  /** Source fortress class (for class-specific VFX) */
  sourceClass: FortressClass;
  /** Damage that killed the enemy */
  damage: number;
}

/**
 * Get and clear pending combo triggers (for VFX)
 */
export function popComboTriggers(): ComboTrigger[] {
  const triggers = pendingComboTriggers;
  pendingComboTriggers = [];
  return triggers;
}

/**
 * Get and clear pending death physics events (for visual ragdoll system)
 */
export function popDeathPhysics(): DeathPhysicsEvent[] {
  const events = pendingDeathPhysics;
  pendingDeathPhysics = [];
  return events;
}

/**
 * Deterministic ray-circle intersection test
 * Checks if a ray from p0 to p1 intersects a circle at center c with radius r
 * Returns true if the ray intersects the circle
 * 
 * Algorithm: Find closest point on ray to circle center, check if within radius
 */
function rayIntersectsCircle(
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
 * Update all projectiles - movement and collision
 *
 * Supports multiple trajectory types:
 * - Linear: straight line towards target (ray marching)
 * - Arc: parabolic trajectory with gravity (for artillery/fire)
 * - Homing: tracks target with turn rate limit (for lightning/tech)
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
      projectile.targetX = targetEnemy.x;
      projectile.targetY = targetEnemy.y;
    }

    // Store previous position for ray marching
    const prevX = projectile.x;
    const prevY = projectile.y;

    let newX: number;
    let newY: number;

    // Handle different trajectory types
    if (projectile.trajectory === 'arc') {
      // Arc trajectory: physics-based with gravity
      newX = FP.add(projectile.x, projectile.vx ?? 0);

      // Apply gravity to vertical velocity
      const currentVy = projectile.vy ?? 0;
      const newVy = FP.add(currentVy, ARC_GRAVITY);
      projectile.vy = newVy;

      newY = FP.add(projectile.y, newVy);

      // Check if projectile has fallen below target Y (ground level hit)
      if (newY >= projectile.targetY && currentVy > 0) {
        // Landed near target area - apply damage to nearest enemy
        applyProjectileDamage(projectile, state);
        toRemove.push(projectile.id);
        continue;
      }
    } else {
      // Linear or homing trajectory
      const dx = FP.sub(projectile.targetX, projectile.x);
      const dy = FP.sub(projectile.targetY, projectile.y);
      const distSq = FP.lengthSq2D(dx, dy);

      if (distSq === 0) {
        applyProjectileDamage(projectile, state);
        toRemove.push(projectile.id);
        continue;
      }

      // Calculate direction to target
      let direction = FP.normalize2D(dx, dy);

      // Apply homing behavior if present
      const homingStrength = projectile.homingStrength ?? 0;
      if (homingStrength > 0 && projectile.vx !== undefined && projectile.vy !== undefined) {
        // Current velocity direction
        const currentDir = FP.normalize2D(projectile.vx, projectile.vy);

        // Blend current direction with target direction based on homing strength
        const blendFactor = FP.fromFloat(Math.min(homingStrength * HOMING_MAX_TURN_RATE, HOMING_MAX_TURN_RATE));
        const newDirX = FP.add(
          FP.mul(currentDir.x, FP.sub(FP.ONE, blendFactor)),
          FP.mul(direction.x, blendFactor)
        );
        const newDirY = FP.add(
          FP.mul(currentDir.y, FP.sub(FP.ONE, blendFactor)),
          FP.mul(direction.y, blendFactor)
        );

        // Normalize blended direction
        direction = FP.normalize2D(newDirX, newDirY);

        // Update velocity for next frame
        projectile.vx = FP.mul(direction.x, projectile.speed);
        projectile.vy = FP.mul(direction.y, projectile.speed);
      }

      // Move projectile
      newX = FP.add(projectile.x, FP.mul(direction.x, projectile.speed));
      newY = FP.add(projectile.y, FP.mul(direction.y, projectile.speed));
    }

    // Calculate hit detection radius (class-specific)
    const projectileHitRadius = projectile.hitRadius
      ? FP.mul(PROJECTILE_BASE_HIT_RADIUS, FP.fromFloat(projectile.hitRadius))
      : PROJECTILE_BASE_HIT_RADIUS;

    const enemyHitRadius = targetEnemy && targetEnemy.hp > 0
      ? FP.add(targetEnemy.radius, projectileHitRadius)
      : projectileHitRadius;

    // Check collision with target
    const hitTarget = rayIntersectsCircle(
      prevX, prevY,
      newX, newY,
      projectile.targetX, projectile.targetY,
      enemyHitRadius
    );

    if (hitTarget) {
      applyProjectileDamage(projectile, state);
      toRemove.push(projectile.id);
    } else {
      projectile.x = newX;
      projectile.y = newY;

      // Pierce mechanic
      if (projectile.pierceCount !== undefined && projectile.pierceCount > 0) {
        checkPierceCollisions(projectile, state);
      }
    }

    // Check timeout
    if (state.tick - projectile.spawnTick > 300) {
      toRemove.push(projectile.id);
    }
  }

  const removeSet = new Set(toRemove);
  state.projectiles = state.projectiles.filter(p => !removeSet.has(p.id));
}

/**
 * Check for pierce collisions with enemies near the projectile
 */
function checkPierceCollisions(projectile: ActiveProjectile, state: GameState): void {
  if (!projectile.pierceCount || projectile.pierceCount <= 0) return;

  // Initialize hitEnemyIds if not present
  if (!projectile.hitEnemyIds) {
    projectile.hitEnemyIds = [];
  }

  const pierceRadiusSq = FP.mul(PIERCE_HIT_RADIUS, PIERCE_HIT_RADIUS);

  for (const enemy of state.enemies) {
    // Skip if this is the main target or already hit
    if (enemy.id === projectile.targetEnemyId) continue;
    if (enemy.hp <= 0) continue;
    if (projectile.hitEnemyIds.includes(enemy.id)) continue;
    if (projectile.pierceCount <= 0) break;

    // Check distance to enemy
    const dx = FP.sub(enemy.x, projectile.x);
    const dy = FP.sub(enemy.y, projectile.y);
    const distSq = FP.lengthSq2D(dx, dy);

    if (distSq <= pierceRadiusSq) {
      // Hit! Apply reduced damage
      applyPierceDamage(projectile, enemy, state);
      projectile.hitEnemyIds.push(enemy.id);
      projectile.pierceCount--;
    }
  }
}

/**
 * Apply reduced damage to a pierced enemy with falloff
 * Pierce damage decreases with each enemy hit: 60%, 45%, 34%, etc.
 */
function applyPierceDamage(projectile: ActiveProjectile, enemy: Enemy, state: GameState): void {
  // Calculate falloff based on how many enemies already hit
  const piercesUsed = projectile.hitEnemyIds?.length ?? 0;
  // First pierce: 60%, second: 45% (60% * 0.75), third: 34% (45% * 0.75), etc.
  const falloffMultiplier = Math.pow(PIERCE_DAMAGE_FALLOFF, piercesUsed);
  const pierceMultiplier = PIERCE_DAMAGE_MULTIPLIER * falloffMultiplier;

  // Apply armor break multiplier from shatter combo (if active)
  const armorMultiplier = getArmorBreakMultiplier(enemy);
  const baseDamage = Math.floor(projectile.damage * armorMultiplier * pierceMultiplier);

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

  const attribution = getProjectileAttribution(projectile, 'secondary', 'pierce');
  analytics.trackAttributedDamage(attribution, damageDealt);

  // Apply status effects to pierced enemies too
  for (const effect of projectile.effects) {
    applyEffectToEnemy(effect, enemy, state, attribution);
  }
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
    const wasAlive = enemy.hp > 0;
    enemy.hp -= baseDamage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;

    // Check if enemy just died - emit death physics for visual ragdoll
    if (wasAlive && enemy.hp <= 0 && projectile.class) {
      // Create RNG for knockback spread using deterministic seed
      const rngSeed = ((projectile.id * 2654435761) ^ (state.tick * 31337)) >>> 0;
      let rngState = rngSeed;
      const rng = () => {
        rngState = (rngState * 1103515245 + 12345) >>> 0;
        return (rngState % 10000) / 10000;
      };

      // Calculate knockback from projectile source to enemy
      const knockback = calculateKnockback(
        projectile.startX,
        projectile.startY,
        enemy.x,
        enemy.y,
        baseDamage,
        projectile.class,
        rng
      );

      // Emit death physics event
      pendingDeathPhysics.push({
        enemyId: enemy.id,
        enemyType: enemy.type,
        isElite: enemy.isElite ?? false,
        x: enemy.x,
        y: enemy.y,
        kbX: knockback.kbX,
        kbY: knockback.kbY,
        spinForce: knockback.spinForce,
        isBigKill: knockback.isBigKill,
        sourceClass: projectile.class,
        damage: baseDamage,
      });
    }

    // Track damage hit for combo system
    if (projectile.class) {
      const comboTrigger = trackDamageHit(enemy, projectile.class, damageDealt, state);
      if (comboTrigger) {
        pendingComboTriggers.push(comboTrigger);
      }
    }

    const attribution = getProjectileAttribution(projectile);
    analytics.trackAttributedDamage(attribution, damageDealt);

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
          const artifactAttribution: DamageAttribution = {
            ownerType: 'hero',
            ownerId: hero.definitionId,
            mechanicType: 'artifact',
            mechanicId: hero.equippedArtifact || 'unknown_artifact',
          };
          applyEffectToEnemy(onHitEffect, enemy, state, artifactAttribution);
        }
      }
    }

    // Apply additional effects
    for (const effect of projectile.effects) {
      applyEffectToEnemy(effect, enemy, state, attribution);
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
        const damageDealt = Math.min(effect.strength, enemy.hp);
        enemy.hp -= effect.strength;
        enemy.hitFlashTicks = 3; // Visual feedback for DOT
        const attribution = effect.source || {
          ownerType: 'system',
          ownerId: 'unknown',
          mechanicType: 'dot',
          mechanicId: effect.type,
        };
        analytics.trackAttributedDamage(attribution, damageDealt, 'dot');
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
export function applyEffectToEnemy(
  effect: SkillEffect,
  enemy: Enemy,
  state: GameState,
  sourceAttribution?: DamageAttribution
): void {
  const effectDuration = effect.duration || DEFAULT_EFFECT_DURATION;

  switch (effect.type) {
    case 'damage': {
      const rawDamage = effect.amount || 0;
      const damageDealt = Math.min(rawDamage, enemy.hp);
      enemy.hp -= rawDamage;
      const attribution = sourceAttribution || {
        ownerType: 'system',
        ownerId: 'unknown',
        mechanicType: 'skill',
        mechanicId: 'direct_damage',
      };
      analytics.trackAttributedDamage(attribution, damageDealt);
      break;
    }
    case 'slow': {
      // Convert percent to decimal if needed (30 -> 0.3, 0.3 -> 0.3)
      const slowPercent = (effect.percent || 30) > 1 ? (effect.percent || 30) / 100 : (effect.percent || 0.3);
      // Apply slow effect and track it
      addStatusEffect(enemy, 'slow', effectDuration, slowPercent, state.tick, sourceAttribution);
      // Recalculate speed from baseSpeed with all active slow effects
      recalculateEnemySpeed(enemy);
      break;
    }
    case 'burn':
      // Track burn DOT effect
      const burnAttribution = buildDotAttribution(sourceAttribution, 'burn');
      addStatusEffect(enemy, 'burn', effectDuration, effect.damagePerTick || 5, state.tick, burnAttribution);
      // Apply initial tick of damage
      const burnDamage = effect.damagePerTick || 5;
      const burnDealt = Math.min(burnDamage, enemy.hp);
      enemy.hp -= burnDamage;
      analytics.trackAttributedDamage(burnAttribution, burnDealt, 'dot');
      break;
    case 'poison':
      // Track poison DOT effect
      const poisonAttribution = buildDotAttribution(sourceAttribution, 'poison');
      addStatusEffect(enemy, 'poison', effectDuration, effect.damagePerTick || 5, state.tick, poisonAttribution);
      // Apply initial tick of damage
      const poisonDamage = effect.damagePerTick || 5;
      const poisonDealt = Math.min(poisonDamage, enemy.hp);
      enemy.hp -= poisonDamage;
      analytics.trackAttributedDamage(poisonAttribution, poisonDealt, 'dot');
      break;
    case 'freeze':
      // Track freeze effect
      addStatusEffect(enemy, 'freeze', effectDuration, 1.0, state.tick, sourceAttribution);
      recalculateEnemySpeed(enemy);
      break;
    case 'stun':
      // Track stun effect
      addStatusEffect(enemy, 'stun', effectDuration, 1.0, state.tick, sourceAttribution);
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
  currentTick: number,
  sourceAttribution?: DamageAttribution
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
      source: sourceAttribution || existing.source,
    };
  } else {
    // Add new effect
    enemy.activeEffects.push({
      type,
      remainingTicks: duration,
      strength,
      appliedTick: currentTick,
      source: sourceAttribution,
    });
  }
}

function getProjectileAttribution(
  projectile: ActiveProjectile,
  mechanicTypeOverride?: DamageMechanicType,
  mechanicIdOverride?: string
): DamageAttribution {
  let mechanicType: DamageMechanicType = projectile.skillId ? 'skill' : 'basic';
  let mechanicId = projectile.skillId || 'basic_attack';

  if (projectile.isChained) {
    mechanicType = 'skill';
    mechanicId = 'storm_chain';
  }

  if (mechanicTypeOverride) {
    mechanicType = mechanicTypeOverride;
  }
  if (mechanicIdOverride) {
    mechanicId = mechanicIdOverride;
  }

  return {
    ownerType: projectile.sourceType as DamageOwnerType,
    ownerId: String(projectile.sourceId),
    mechanicType,
    mechanicId,
  };
}

function buildDotAttribution(
  sourceAttribution: DamageAttribution | undefined,
  dotType: 'burn' | 'poison'
): DamageAttribution {
  return {
    ownerType: sourceAttribution?.ownerType || 'system',
    ownerId: sourceAttribution?.ownerId || 'unknown',
    mechanicType: 'dot',
    mechanicId: dotType,
  };
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
 * Get class-specific projectile speed
 */
function getClassProjectileSpeed(fortressClass: FortressClass): number {
  const speedMultiplier = PROJECTILE_CLASS_SPEED[fortressClass] ?? 1.0;
  return FP.mul(PROJECTILE_BASE_SPEED, FP.fromFloat(speedMultiplier));
}

/**
 * Get class-specific pierce count
 */
function getClassPierceCount(fortressClass: FortressClass): number {
  return FORTRESS_CLASS_PIERCE[fortressClass] ?? 2;
}

/**
 * Get class-specific trajectory type
 */
function getClassTrajectory(fortressClass: FortressClass): 'linear' | 'arc' {
  return PROJECTILE_CLASS_TRAJECTORY[fortressClass] ?? 'linear';
}

/**
 * Get class-specific homing strength
 */
function getClassHomingStrength(fortressClass: FortressClass): number {
  return PROJECTILE_CLASS_HOMING[fortressClass] ?? 0;
}

/**
 * Get class-specific hit radius multiplier
 */
function getClassHitRadius(fortressClass: FortressClass): number {
  return PROJECTILE_CLASS_HIT_RADIUS[fortressClass] ?? 1.0;
}

/**
 * Calculate initial velocities for arc trajectory
 * Uses ballistic trajectory math to hit the target
 */
function calculateArcVelocities(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  speed: number
): { vx: number; vy: number } {
  const dx = FP.sub(targetX, startX);
  const dy = FP.sub(targetY, startY);
  const dist = FP.sqrt(FP.lengthSq2D(dx, dy));

  // Horizontal velocity based on distance and speed
  const flightTime = FP.div(dist, speed);
  const vx = FP.div(dx, flightTime);

  // Calculate upward velocity for parabolic arc
  // We want the projectile to arc up then down to the target
  const gravityFloat = FP.toFloat(ARC_GRAVITY);
  const flightTimeFloat = FP.toFloat(flightTime);
  const dyFloat = FP.toFloat(dy);

  // vy = (dy + 0.5 * g * t^2) / t  (to land at target Y)
  // Add extra upward boost for visual arc
  const arcHeight = ARC_LAUNCH_ANGLE * FP.toFloat(dist);
  const vyFloat = (dyFloat + 0.5 * gravityFloat * flightTimeFloat * flightTimeFloat) / flightTimeFloat - arcHeight;

  return {
    vx,
    vy: FP.fromFloat(-Math.abs(vyFloat) - arcHeight), // Always start going up
  };
}

/**
 * Create a projectile from fortress attack
 * Uses class-specific speed, pierce, trajectory, homing, and hit radius
 */
export function createFortressProjectile(
  target: Enemy,
  state: GameState,
  config: SimConfig,
  damage: number
): void {
  const fortressClass = state.fortressClass;

  // Apply class-specific damage modifier
  const classDamageMultiplier = FORTRESS_CLASS_DAMAGE[fortressClass] ?? 1.0;
  const finalDamage = Math.floor(damage * classDamageMultiplier);

  const startX = config.fortressX;
  const startY = FP.fromInt(7);
  const speed = getClassProjectileSpeed(fortressClass);
  const trajectory = getClassTrajectory(fortressClass);
  const homingStrength = getClassHomingStrength(fortressClass);
  const hitRadius = getClassHitRadius(fortressClass);

  // Calculate initial velocities based on trajectory type
  let vx: number | undefined;
  let vy: number | undefined;

  if (trajectory === 'arc') {
    const arcVelocities = calculateArcVelocities(startX, startY, target.x, target.y, speed);
    vx = arcVelocities.vx;
    vy = arcVelocities.vy;
  } else if (homingStrength > 0) {
    // Initialize velocity for homing projectiles
    const dx = FP.sub(target.x, startX);
    const dy = FP.sub(target.y, startY);
    const dir = FP.normalize2D(dx, dy);
    vx = FP.mul(dir.x, speed);
    vy = FP.mul(dir.y, speed);
  }

  const projectile: ActiveProjectile = {
    id: state.nextProjectileId++,
    type: getProjectileTypeForClass(fortressClass),
    sourceType: 'fortress',
    sourceId: 0,
    targetEnemyId: target.id,
    x: startX,
    y: startY,
    startX,
    startY,
    targetX: target.x,
    targetY: target.y,
    speed,
    damage: finalDamage,
    effects: [],
    spawnTick: state.tick,
    class: fortressClass,
    pierceCount: getClassPierceCount(fortressClass),
    hitEnemyIds: [],
    // New physics properties
    trajectory,
    vx,
    vy,
    homingStrength: homingStrength > 0 ? homingStrength : undefined,
    hitRadius: hitRadius !== 1.0 ? hitRadius : undefined,
  };

  state.projectiles.push(projectile);
}
