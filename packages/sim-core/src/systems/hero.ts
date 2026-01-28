/**
 * Hero System
 *
 * Main hero update loop including:
 * - AI and target selection
 * - Physics and movement
 * - State machine (idle, combat, commanded)
 * - Combat and skill usage
 */

import { FP } from '../fixed.js';
import type {
  GameState,
  SimConfig,
  Enemy,
  ActiveHero,
} from '../types.js';
import {
  integratePosition,
  applyFriction,
  clampVelocity,
  calculateEffectiveSpeed,
  cleanupExpiredModifiers,
  steerTowards,
  detectCircleCollision,
  resolveCollision,
  applySeparationForce,
  HERO_PHYSICS,
  DEFAULT_PHYSICS_CONFIG,
  type PhysicsConfig,
} from '../physics.js';
import { Xorshift32 } from '../rng.js';
import { getHeroById, calculateHeroStats, hasHeroPassive } from '../data/heroes.js';
import {
  selectTarget as simpleSelectTarget,
  resetSimpleAI,
  resetTargetCounts,
} from '../simple-ai.js';

import {
  HERO_ARRIVAL_RADIUS,
  HERO_BASE_ATTACK_INTERVAL,
  HERO_PREFERRED_COMBAT_DISTANCE_RATIO,
} from './constants.js';
import {
  calculateWeaknessStatPenalty,
  applyConditionalWeaknessesToDamage,
  checkBehavioralWeaknesses,
} from './weakness.js';
import {
  calculateHeroStoneDamageBonus,
  calculateHeroStoneCooldownReduction,
} from './infinity-stones.js';
import { getStormForgeAttackSpeedBonus } from './synergy.js';
import {
  calculateTotalArtifactDamageMultiplier,
  hasArtifactPassive,
} from './artifacts.js';
import { createHeroProjectile, createManualHeroProjectile } from './projectile.js';
import { getHeroStatPointBonuses } from './apply-stat-points.js';
import {
  findClosestEnemy2D,
  applySkillEffects,
  isEnemyTargetable,
} from './helpers.js';

const MANUAL_ATTACK_RANGE_BONUS = FP.fromInt(2);

// ============================================================================
// AI SYSTEM (Simplified Role-Based)
// ============================================================================

/**
 * Reset AI state (call when starting new session)
 */
export function resetTeamCoordinator(): void {
  resetSimpleAI();
}

/**
 * Select best target for a hero using simple role-based AI
 */
function selectBestTarget(
  hero: ActiveHero,
  enemiesInRange: Enemy[],
  state: GameState,
  config: SimConfig
): Enemy | null {
  return simpleSelectTarget(hero, enemiesInRange, state, FP.toInt(config.fortressX));
}

// NOTE: Retreat behavior has been removed.
// Heroes now rely on lifesteal to sustain in combat.

// ============================================================================
// PHYSICS HELPERS
// ============================================================================

/**
 * Create physics config from sim config
 */
function getPhysicsConfig(config: SimConfig): PhysicsConfig {
  return {
    ...DEFAULT_PHYSICS_CONFIG,
    fieldMinX: FP.fromInt(0),
    fieldMaxX: config.enemySpawnX,
    fieldMinY: FP.fromInt(0),
    fieldMaxY: config.fieldHeight,
  };
}

/**
 * Clamp hero position to field boundaries
 */
function clampHeroToField(hero: ActiveHero, physicsConfig: PhysicsConfig, config: SimConfig): void {
  // Clamp X - hero shouldn't go beyond fortress or past enemy spawn
  const minX = FP.add(config.fortressX, hero.radius);
  const maxX = FP.sub(config.enemySpawnX, hero.radius);

  if (hero.x < minX) {
    hero.x = minX;
    hero.vx = 0;
  } else if (hero.x > maxX) {
    hero.x = maxX;
    hero.vx = 0;
  }

  // Clamp Y
  const minY = FP.add(physicsConfig.fieldMinY, hero.radius);
  const maxY = FP.sub(physicsConfig.fieldMaxY, hero.radius);

  if (hero.y < minY) {
    hero.y = minY;
    hero.vy = 0;
  } else if (hero.y > maxY) {
    hero.y = maxY;
    hero.vy = 0;
  }
}

// ============================================================================
// HERO UPDATE
// ============================================================================

/**
 * Update all heroes - AI, movement, combat, skills
 */
export function updateHeroes(
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  const physicsConfig = getPhysicsConfig(config);

  // Reset target distribution tracking for this tick
  resetTargetCounts(state.tick);

  // Phase 1: Calculate steering forces and update velocities
  for (const hero of state.heroes) {
    // Clean up expired movement modifiers
    hero.movementModifiers = cleanupExpiredModifiers(hero.movementModifiers, state.tick);

    // Update steering based on current state
    updateHeroSteering(hero, state, config);
  }

  // Phase 2: Integrate physics (apply velocity to position)
  for (const hero of state.heroes) {
    if (hero.state === 'idle') continue;

    // Get effective speed considering modifiers
    const heroDef = getHeroById(hero.definitionId);
    if (!heroDef) continue;

    const stats = calculateHeroStats(heroDef, hero.tier, hero.level);
    const maxSpeed = calculateEffectiveSpeed(stats.moveSpeed, hero.movementModifiers, state.tick);

    // Apply friction
    applyFriction(hero, HERO_PHYSICS.friction);

    // Clamp velocity
    clampVelocity(hero, maxSpeed);

    // Integrate position
    integratePosition(hero);

    // Clamp to field boundaries
    clampHeroToField(hero, physicsConfig, config);
  }

  // Phase 2b: Hero-to-hero collision resolution
  const activeHeroes = state.heroes.filter(h => h.state !== 'idle');
  if (activeHeroes.length > 1) {
    // Apply separation force to prevent stacking
    applySeparationForce(activeHeroes, HERO_PHYSICS.separationForce, HERO_PHYSICS.separationForce);

    // Resolve direct collisions
    for (let i = 0; i < activeHeroes.length; i++) {
      for (let j = i + 1; j < activeHeroes.length; j++) {
        const a = activeHeroes[i];
        const b = activeHeroes[j];
        const collision = detectCircleCollision(a, b);
        if (collision) {
          const maxOverlap = FP.fromFloat(0.5);
          const limitedCollision =
            collision.overlap > maxOverlap
              ? { ...collision, overlap: maxOverlap }
              : collision;
          resolveCollision(a, b, limitedCollision);
        }
      }
    }

    // Re-clamp to field after collision resolution
    for (const hero of activeHeroes) {
      clampHeroToField(hero, physicsConfig, config);
    }
  }

  // Phase 3: State machine updates
  for (const hero of state.heroes) {
    switch (hero.state) {
      case 'idle':
        updateHeroIdle(hero, state, config);
        break;
      case 'combat':
        updateHeroCombat(hero, state, config, rng);
        break;
      case 'commanded':
        updateHeroCommandedState(hero, state, config, rng);
        break;
    }

    // Update skill cooldowns
    updateHeroSkillCooldowns(hero, state);

    // Update buffs
    updateHeroBuffs(hero, state);
  }
}

// ============================================================================
// STEERING
// ============================================================================

/**
 * Calculate preferred target position that maintains optimal combat distance
 * Prevents heroes from getting too close to enemies, improving VFX visibility
 * Returns a position that is preferredDistance away from the enemy in the direction of the hero
 */
function calculatePreferredCombatPosition(
  hero: ActiveHero,
  target: { x: number; y: number },
  attackRange: number
): { x: number; y: number } {
  const dx = FP.sub(target.x, hero.x);
  const dy = FP.sub(target.y, hero.y);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

  if (distSq === 0) {
    // Already on target, move slightly away
    return { x: target.x, y: target.y };
  }

  const dist = FP.sqrt(distSq);
  const preferredDistance = FP.mul(attackRange, HERO_PREFERRED_COMBAT_DISTANCE_RATIO);

  // If already at or beyond preferred distance, use target position as-is
  if (dist >= preferredDistance) {
    return { x: target.x, y: target.y };
  }

  // Calculate position that maintains preferred distance from enemy
  // Direction from enemy to hero (away from enemy)
  const awayFromEnemyDx = FP.sub(hero.x, target.x);
  const awayFromEnemyDy = FP.sub(hero.y, target.y);
  const awayDistSq = FP.add(FP.mul(awayFromEnemyDx, awayFromEnemyDx), FP.mul(awayFromEnemyDy, awayFromEnemyDy));
  
  if (awayDistSq === 0) {
    // Hero and enemy are at same position, use a default direction
    return { x: FP.add(target.x, preferredDistance), y: target.y };
  }

  const normalized = FP.normalize2D(awayFromEnemyDx, awayFromEnemyDy);
  const offsetX = FP.mul(normalized.x, preferredDistance);
  const offsetY = FP.mul(normalized.y, preferredDistance);

  // Preferred position is enemy position + offset (maintaining preferred distance from enemy)
  const preferredX = FP.add(target.x, offsetX);
  const preferredY = FP.add(target.y, offsetY);

  return { x: preferredX, y: preferredY };
}

/**
 * Update hero steering based on current state
 * Sets velocity direction, actual movement happens in physics phase
 */
function updateHeroSteering(hero: ActiveHero, state: GameState, config: SimConfig): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);
  const maxSpeed = calculateEffectiveSpeed(stats.moveSpeed, hero.movementModifiers, state.tick);
  const fieldWidth = config.fieldWidth;
  const attackRange = stats.range;

  switch (hero.state) {
    case 'combat': {
      // Move towards the hero's actual target (not just closest enemy)
      // Priority: focusTarget > currentTarget > closest
      let moveTarget: { x: number; y: number } | null = null;
      let targetEnemy: Enemy | null = null;

  // Priority 1: Focus target (team-wide command from player)
      if (hero.focusTargetId !== undefined) {
        const focusEnemy = state.enemies.find(e => e.id === hero.focusTargetId);
    if (focusEnemy && isEnemyTargetable(focusEnemy, fieldWidth)) {
          moveTarget = focusEnemy;
          targetEnemy = focusEnemy;
        } else if (!focusEnemy || focusEnemy.hp <= 0) {
          hero.focusTargetId = undefined;
        }
      }

      // Priority 2: Current attack target
      if (!moveTarget && hero.currentTargetId !== undefined) {
        const currentEnemy = state.enemies.find(e => e.id === hero.currentTargetId);
    if (currentEnemy && isEnemyTargetable(currentEnemy, fieldWidth)) {
          moveTarget = currentEnemy;
          targetEnemy = currentEnemy;
        } else if (!currentEnemy || currentEnemy.hp <= 0) {
          hero.currentTargetId = undefined;
        }
      }

      // Priority 3: Fall back to closest enemy
      if (!moveTarget) {
        const closestEnemy = findClosestEnemy2D(
      state.enemies.filter(e => isEnemyTargetable(e, fieldWidth)),
          hero.x,
          hero.y
        );
        if (closestEnemy) {
          moveTarget = closestEnemy;
          targetEnemy = closestEnemy;
        }
      }

      if (moveTarget && targetEnemy) {
        // Check if hero is in attack range
        const distSq = FP.distSq(hero.x, hero.y, targetEnemy.x, targetEnemy.y);
        const attackRangeSq = FP.mul(attackRange, attackRange);
        const isInRange = distSq <= attackRangeSq;

        // If in range, maintain preferred combat distance instead of moving directly to enemy
        const steeringTarget = isInRange
          ? calculatePreferredCombatPosition(hero, moveTarget, attackRange)
          : moveTarget;

        const steering = steerTowards(hero, steeringTarget.x, steeringTarget.y, maxSpeed, HERO_ARRIVAL_RADIUS);
        hero.vx = FP.add(hero.vx, steering.ax);
        hero.vy = FP.add(hero.vy, steering.ay);
      } else {
        // No valid target - dampen velocity so heroes don't drift indefinitely
        hero.vx = FP.mul(hero.vx, FP.fromFloat(0.6));
        hero.vy = FP.mul(hero.vy, FP.fromFloat(0.6));
      }
      break;
    }
    case 'commanded': {
      // Steer towards player-specified target
      if (hero.commandTarget) {
        const steering = steerTowards(hero, hero.commandTarget.x, hero.commandTarget.y, maxSpeed, HERO_ARRIVAL_RADIUS);
        hero.vx = FP.add(hero.vx, steering.ax);
        hero.vy = FP.add(hero.vy, steering.ay);
      }
      break;
    }
  }
}

// ============================================================================
// STATE HANDLERS
// ============================================================================

/**
 * Hero in idle state - waiting in castle
 */
function updateHeroIdle(hero: ActiveHero, state: GameState, _config: SimConfig): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  // Check if should deploy
  // deployCooldown is already in ticks (e.g., 300 = 10 seconds at 30Hz)
  const deployCooldownTicks = heroDef.baseStats.deployCooldown;
  const canDeploy = state.tick - hero.lastDeployTick >= deployCooldownTicks;

  // Enter combat if there are enemies and cooldown is ready
  if (canDeploy && state.enemies.length > 0) {
    hero.state = 'combat';
    hero.lastDeployTick = state.tick;
  }
}

/**
 * Perform hero attack - shared logic for attacking enemies in range
 * Used by both combat and returning states
 */
function performHeroAttack(
  hero: ActiveHero,
  state: GameState,
  config: SimConfig,
  rng: Xorshift32,
  attackRange: number,
  manualOnly: boolean = false
): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  // Check if enemies in range (2D distance)
  const attackRangeSq = FP.mul(attackRange, attackRange);
  const fieldWidth = config.fieldWidth;
  const enemiesInRange = state.enemies.filter(e => {
    if (!isEnemyTargetable(e, fieldWidth)) return false;
    const distSq = FP.distSq(hero.x, hero.y, e.x, e.y);
    return distSq <= attackRangeSq;
  });

  if (enemiesInRange.length === 0) {
    return;
  }

  // Attack if ready
  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);

  // Get free stat point bonuses for this hero
  const statPointBonuses = config.statPointData
    ? getHeroStatPointBonuses(config.statPointData.heroAllocations, hero.definitionId)
    : { damageBonus: 0, attackSpeedBonus: 0, critChanceBonus: 0 };

  // Apply stat penalties from weaknesses (e.g., -20% move speed for Iron Sentinel)
  const attackSpeedPenalty = calculateWeaknessStatPenalty(heroDef.weaknesses, 'attackSpeedMultiplier');
  // Apply guild stat boost to attack speed
  const guildBoost = 1 + (config.guildStatBoost ?? 0);
  const stormForgeBonus = getStormForgeAttackSpeedBonus(state, hero);
  // Apply free stat point attack speed bonus
  const statPointAttackSpeedBonus = 1 + statPointBonuses.attackSpeedBonus;
  const effectiveAttackSpeed =
    stats.attackSpeed * attackSpeedPenalty * guildBoost * (1 + stormForgeBonus) * statPointAttackSpeedBonus;
  const attackInterval = Math.floor(HERO_BASE_ATTACK_INTERVAL / effectiveAttackSpeed);

  if (state.tick - hero.lastAttackTick >= attackInterval) {
    // Check behavioral weaknesses
    const behavioralEffects = checkBehavioralWeaknesses(heroDef.weaknesses);

    // Find target using AI-based targeting (or manual focus only)
    let target: Enemy | null = null;

    if (manualOnly) {
      if (hero.focusTargetId === undefined) {
        hero.currentTargetId = undefined;
        return;
      }
      const focusEnemy = enemiesInRange.find(e => e.id === hero.focusTargetId);
      if (!focusEnemy) {
        const focusAlive = state.enemies.find(e => e.id === hero.focusTargetId);
        if (!focusAlive || focusAlive.hp <= 0) {
          hero.focusTargetId = undefined;
        }
        hero.currentTargetId = undefined;
        return;
      }
      target = focusEnemy;
    } else if (hero.focusTargetId !== undefined) {
      // Priority 1: Focus target if set (team-wide focus fire command)
      const focusEnemy = enemiesInRange.find(e => e.id === hero.focusTargetId);
      if (focusEnemy) {
        target = focusEnemy;
      } else {
        // Focus target not in range, use normal AI
        target = selectBestTarget(hero, enemiesInRange, state, config);
        // Clear focus if enemy is dead or removed
        const focusEnemy = state.enemies.find(e => e.id === hero.focusTargetId);
        if (!focusEnemy || focusEnemy.hp <= 0) {
          hero.focusTargetId = undefined;
        }
      }
    } else if (behavioralEffects.randomTarget && enemiesInRange.length > 1) {
      // Priority 2: Random target if weakness override
      const randomIndex = Math.floor(rng.nextFloat() * enemiesInRange.length);
      target = enemiesInRange[randomIndex];
    } else {
      // Priority 3: Use Utility AI to select best target
      target = selectBestTarget(hero, enemiesInRange, state, config);
    }

    // No valid target, skip attack
    if (!target) {
      return;
    }

    hero.lastAttackTick = state.tick;

    // Update current target for AI tracking
    hero.currentTargetId = target.id;

    // Calculate damage with all bonuses
    let finalDamage = stats.damage;

    // Apply HP-based stat penalty (e.g., Spider Sentinel -30% HP)
    const hpPenalty = calculateWeaknessStatPenalty(heroDef.weaknesses, 'maxHpMultiplier');
    if (hpPenalty < 1.0) {
      // This affects max HP, but for damage we just note it
    }

    // Crystal bonus (Power Crystal = +50% damage)
    if (hero.infinityStone) {
      const stoneBonus = calculateHeroStoneDamageBonus(hero.infinityStone);
      finalDamage = Math.floor(finalDamage * stoneBonus);
    }

    // Artifact bonus
    const artifactBonus = calculateTotalArtifactDamageMultiplier(hero, heroDef.class);
    finalDamage = Math.floor(finalDamage * artifactBonus);

    // Buff bonuses (from items)
    for (const buff of hero.buffs) {
      if (buff.stat === 'damageBonus') {
        finalDamage = Math.floor(finalDamage * (1 + buff.amount));
      }
    }

    // Free stat point damage bonus
    if (statPointBonuses.damageBonus > 0) {
      finalDamage = Math.floor(finalDamage * (1 + statPointBonuses.damageBonus));
    }

    // Free stat point crit chance (hero-specific crit)
    if (statPointBonuses.critChanceBonus > 0) {
      const critRoll = rng.nextFloat();
      if (critRoll < statPointBonuses.critChanceBonus) {
        finalDamage = Math.floor(finalDamage * 1.5); // 1.5x crit multiplier
      }
    }

    // Hero passive damage bonuses
    const heroTier = hero.tier || 1;
    const heroLevel = hero.level || 1;

    // Void Absorption (Titan): damage increases with HP loss (up to +100% at 0 HP)
    if (hasHeroPassive(hero.definitionId, 'void_absorption', heroTier as 1 | 2 | 3, heroLevel)) {
      const hpLostPercent = 1 - (hero.currentHp / hero.maxHp);
      finalDamage = Math.floor(finalDamage * (1 + hpLostPercent));
    }

    // Void Resonance (Titan Tier 2): +100% damage when HP below 30%
    if (hasHeroPassive(hero.definitionId, 'void_resonance', heroTier as 1 | 2 | 3, heroLevel)) {
      const hpPercent = hero.currentHp / hero.maxHp;
      if (hpPercent < 0.3) {
        finalDamage = Math.floor(finalDamage * 2);
      }
    }

    // Burning Heart (Inferno): +20% damage vs burning targets
    if (hasHeroPassive(hero.definitionId, 'burning_heart', heroTier as 1 | 2 | 3, heroLevel)) {
      const isBurning = target.activeEffects.some(e => e.type === 'burn' && e.remainingTicks > 0);
      if (isBurning) {
        finalDamage = Math.floor(finalDamage * 1.2);
      }
    }

    // Fire Mastery (Inferno Tier 2): +35% fire damage
    if (hasHeroPassive(hero.definitionId, 'fire_mastery', heroTier as 1 | 2 | 3, heroLevel)) {
      if (heroDef.class === 'fire') {
        finalDamage = Math.floor(finalDamage * 1.35);
      }
    }

    // Ice Mastery (Frost Tier 2): +25% ice damage
    if (hasHeroPassive(hero.definitionId, 'ice_mastery', heroTier as 1 | 2 | 3, heroLevel)) {
      if (heroDef.class === 'ice') {
        finalDamage = Math.floor(finalDamage * 1.25);
      }
    }

    // Hunter Instinct (Omega): tiered execute thresholds
    // Regular: 20%, Elite: 15%, Boss: 10% (kept under execute cap)
    if (hasHeroPassive(hero.definitionId, 'hunter_instinct', heroTier as 1 | 2 | 3, heroLevel)) {
      const targetHpPercent = target.hp / target.maxHp;
      // Determine execute threshold based on enemy type
      const isBoss = ['mafia_boss', 'ai_core', 'cosmic_beast', 'dimensional_being', 'god', 'titan', 'sentinel'].includes(target.type);
      const executeThreshold = isBoss ? 0.10 : (target.isElite ? 0.15 : 0.20);

      if (targetHpPercent <= executeThreshold) {
        // Execute - deal remaining HP as damage
        finalDamage = target.hp;
      }
    }

    // Apply conditional weakness penalties to damage
    const isFirstAttack = hero.lastAttackTick === state.tick;
    const isMeleeRange = attackRange <= FP.fromInt(3);
    finalDamage = applyConditionalWeaknessesToDamage(hero, finalDamage, heroDef.weaknesses, {
      enemyCount: enemiesInRange.length,
      isFirstAttack,
      isMeleeRange,
      pillarId: state.currentPillar,
      hasWeapon: !!hero.equippedArtifact,
    });

    // Apply global damage bonus (includes guild stat boost, synergies, etc.)
    if (state.modifiers.damageBonus > 0) {
      finalDamage = Math.floor(finalDamage * (1 + state.modifiers.damageBonus));
    }

    // No killing blow weakness (Spider Sentinel) - cap damage to not kill
    if (behavioralEffects.noKillingBlow && target.hp <= finalDamage) {
      finalDamage = Math.max(1, target.hp - 1);
    }

    // Ebony Blade curse: costs 1% HP per attack
    if (hasArtifactPassive(hero.equippedArtifact, 'blood curse')) {
      hero.currentHp = Math.max(1, hero.currentHp - hero.maxHp * 0.01);
    }

    // Create projectile
    createHeroProjectile(hero, target, state, heroDef.class, finalDamage);

    // Lifesteal - 10% of damage dealt heals hero
    const LIFESTEAL_PERCENT = 0.10;
    const healAmount = Math.floor(finalDamage * LIFESTEAL_PERCENT);
    hero.currentHp = Math.min(hero.currentHp + healAmount, hero.maxHp);
  }
}

/**
 * Perform a manual (player-aimed) hero attack toward a world position
 * The projectile flies to the target position, hitting the first enemy along the path
 *
 * Key differences from AI attack:
 * - Target is a world position, not an enemy
 * - Projectile doesn't track/home to enemies
 * - Collision checks any enemy along the projectile path
 */
function performManualHeroAttack(
  hero: ActiveHero,
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  // Must have a manual attack target pending
  if (!hero.manualAttackTarget || !hero.manualAttackPending) {
    return;
  }

  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) {
    hero.manualAttackPending = false;
    hero.manualAttackTarget = undefined;
    return;
  }

  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);

  // Get free stat point bonuses for this hero
  const statPointBonuses = config.statPointData
    ? getHeroStatPointBonuses(config.statPointData.heroAllocations, hero.definitionId)
    : { damageBonus: 0, attackSpeedBonus: 0, critChanceBonus: 0 };

  // Check attack cooldown
  const guildBoost = 1 + (config.guildStatBoost ?? 0);
  const stormForgeBonus = getStormForgeAttackSpeedBonus(state, hero);
  // Apply free stat point attack speed bonus
  const statPointAttackSpeedBonus = 1 + statPointBonuses.attackSpeedBonus;
  const effectiveAttackSpeed = stats.attackSpeed * guildBoost * (1 + stormForgeBonus) * statPointAttackSpeedBonus;
  const attackInterval = Math.floor(HERO_BASE_ATTACK_INTERVAL / effectiveAttackSpeed);

  if (state.tick - hero.lastAttackTick < attackInterval) {
    // Still on cooldown - keep the pending attack, it will fire when ready
    return;
  }

  // Ready to fire - update attack tick
  hero.lastAttackTick = state.tick;

  // Calculate damage with all bonuses (same as normal attack)
  let finalDamage = stats.damage;

  // Crystal bonus (Power Crystal = +50% damage)
  if (hero.infinityStone) {
    const stoneBonus = calculateHeroStoneDamageBonus(hero.infinityStone);
    finalDamage = Math.floor(finalDamage * stoneBonus);
  }

  // Artifact bonus
  const artifactBonus = calculateTotalArtifactDamageMultiplier(hero, heroDef.class);
  finalDamage = Math.floor(finalDamage * artifactBonus);

  // Buff bonuses (from items)
  for (const buff of hero.buffs) {
    if (buff.stat === 'damageBonus') {
      finalDamage = Math.floor(finalDamage * (1 + buff.amount));
    }
  }

  // Free stat point damage bonus
  if (statPointBonuses.damageBonus > 0) {
    finalDamage = Math.floor(finalDamage * (1 + statPointBonuses.damageBonus));
  }

  // Free stat point crit chance (hero-specific crit)
  if (statPointBonuses.critChanceBonus > 0) {
    const critRoll = rng.nextFloat();
    if (critRoll < statPointBonuses.critChanceBonus) {
      finalDamage = Math.floor(finalDamage * 1.5); // 1.5x crit multiplier
    }
  }

  // Apply global damage bonus (includes guild stat boost, synergies, etc.)
  if (state.modifiers.damageBonus > 0) {
    finalDamage = Math.floor(finalDamage * (1 + state.modifiers.damageBonus));
  }

  // Ebony Blade curse: costs 1% HP per attack
  if (hasArtifactPassive(hero.equippedArtifact, 'blood curse')) {
    hero.currentHp = Math.max(1, hero.currentHp - hero.maxHp * 0.01);
  }

  // Create manual projectile toward target position
  createManualHeroProjectile(
    hero,
    hero.manualAttackTarget.x,
    hero.manualAttackTarget.y,
    state,
    heroDef.class,
    finalDamage
  );

  // Clear pending attack (it was consumed)
  hero.manualAttackPending = false;
  hero.manualAttackTarget = undefined;
}

/**
 * Hero in combat - attacking enemies
 */
function updateHeroCombat(
  hero: ActiveHero,
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;
  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);
  const isManualControlled = hero.isManualControlled === true;

  // Heroes no longer retreat - they have lifesteal to sustain in combat

  // Check if enemies in range (2D distance)
  const attackRange = stats.range;
  const attackRangeSq = FP.mul(attackRange, attackRange);
  const fieldWidth = config.fieldWidth;
  const enemiesInRange = state.enemies.filter(e => {
    if (!isEnemyTargetable(e, fieldWidth)) return false;
    const distSq = FP.distSq(hero.x, hero.y, e.x, e.y);
    return distSq <= attackRangeSq;
  });

  if (enemiesInRange.length === 0) {
    // No enemies in range
    const aliveEnemies = state.enemies.filter(e => e.hp > 0);
    if (aliveEnemies.length === 0) {
      // No enemies alive at all, go idle
      hero.state = 'idle';
      hero.vx = 0;
      hero.vy = 0;
    }
    // Otherwise stay in combat and keep moving toward enemies (handled by steering)
    hero.currentTargetId = undefined;
    return;
  }

  // Manual control: player aims and shoots via right-click, no AI auto-attack
  if (isManualControlled) {
    // Process pending manual attack if any
    if (hero.manualAttackPending) {
      performManualHeroAttack(hero, state, config, rng);
    }
  } else {
    // AI-controlled: use normal attack logic
    performHeroAttack(hero, state, config, rng, attackRange);
  }

  // Check and use skills
  useHeroSkills(hero, state, config, rng, enemiesInRange);
}

/**
 * Hero executing a player-issued command (moving to target position)
 */
function updateHeroCommandedState(
  hero: ActiveHero,
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  const isManualControlled = hero.isManualControlled === true;

  // Process manual attack if pending (player right-clicked to shoot)
  if (isManualControlled && hero.manualAttackPending) {
    performManualHeroAttack(hero, state, config, rng);
  }

  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);
  const attackRange = isManualControlled
    ? FP.add(stats.range, MANUAL_ATTACK_RANGE_BONUS)
    : stats.range;
  // Validate command
  if (!hero.commandTarget || !hero.isCommanded) {
    if (!isManualControlled) {
      // No valid command, return to normal AI
      hero.state = state.enemies.length > 0 ? 'combat' : 'idle';
      hero.isCommanded = false;
      hero.commandTarget = undefined;
      return;
    }

    // Manual control without a target: keep commanded state and hold position
    hero.isCommanded = true;
    hero.commandTarget = { x: hero.x, y: hero.y };
  }

  // Check if reached target (within arrival radius of 1.5 units)
  if (hero.commandTarget) {
    const dx = FP.sub(hero.x, hero.commandTarget.x);
    const dy = FP.sub(hero.y, hero.commandTarget.y);
    const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
    const arrivalRadiusSq = FP.fromFloat(2.25); // 1.5^2

    if (distSq <= arrivalRadiusSq) {
      if (!isManualControlled) {
        // Reached destination - return to normal AI
        hero.state = state.enemies.length > 0 ? 'combat' : 'idle';
        hero.isCommanded = false;
        hero.commandTarget = undefined;
        hero.vx = 0;
        hero.vy = 0;
        return;
      }

      hero.vx = 0;
      hero.vy = 0;
    }
  }

  // While moving to target, hero can still attack enemies in range
  // This allows tactical positioning while maintaining combat effectiveness
  const attackRangeSq = FP.mul(attackRange, attackRange);
  const fieldWidth = config.fieldWidth;
  const enemiesInRange = state.enemies.filter(e => {
    if (!isEnemyTargetable(e, fieldWidth)) return false;
    const distSq = FP.distSq(hero.x, hero.y, e.x, e.y);
    return distSq <= attackRangeSq;
  });

  if (enemiesInRange.length === 0) {
    hero.currentTargetId = undefined;
    return;
  }

  // Manual control: player aims and shoots, no AI auto-attack
  if (!isManualControlled) {
    performHeroAttack(hero, state, config, rng, attackRange);
  }
  useHeroSkills(hero, state, config, rng, enemiesInRange);
}

// ============================================================================
// SKILLS & BUFFS
// ============================================================================

/**
 * Update skill cooldowns for hero
 */
function updateHeroSkillCooldowns(hero: ActiveHero, _state: GameState): void {
  for (const skillId of Object.keys(hero.skillCooldowns)) {
    if (hero.skillCooldowns[skillId] > 0) {
      hero.skillCooldowns[skillId]--;
    }
  }
}

/**
 * Update buff durations and shield expiration
 */
function updateHeroBuffs(hero: ActiveHero, state: GameState): void {
  hero.buffs = hero.buffs.filter(buff => buff.expirationTick > state.tick);

  // Clear expired shield
  if (hero.shieldExpiresTick && state.tick >= hero.shieldExpiresTick) {
    hero.shieldAmount = 0;
    hero.shieldExpiresTick = undefined;
  }

  // Apply passive effects
  const heroTier = hero.tier || 1;
  const heroLevel = hero.level || 1;

  // Heart of Winter (Glacier): regeneration when not attacked for 3 seconds (90 ticks)
  if (hasHeroPassive(hero.definitionId, 'heart_of_winter', heroTier as 1 | 2 | 3, heroLevel)) {
    const ticksSinceLastDamage = hero.lastDamagedTick ? state.tick - hero.lastDamagedTick : Infinity;
    if (ticksSinceLastDamage >= 90) {
      // Regenerate 2% max HP per tick while unattacked
      const regenAmount = Math.floor(hero.maxHp * 0.02);
      hero.currentHp = Math.min(hero.currentHp + regenAmount, hero.maxHp);
    }
  }

  // Command Aura (Vanguard): +10% damage to nearby allies
  if (hasHeroPassive(hero.definitionId, 'command_aura', heroTier as 1 | 2 | 3, heroLevel)) {
    // Apply buff to all other heroes if not already present
    for (const ally of state.heroes) {
      if (ally === hero) continue;

      // Check if hero is within 5 units (fixed-point)
      const distSq = FP.distSq(hero.x, hero.y, ally.x, ally.y);
      const auraRange = FP.fromInt(5);
      const auraRangeSq = FP.mul(auraRange, auraRange);

      if (distSq <= auraRangeSq) {
        // Check if already has command aura buff
        const hasAuraBuff = ally.buffs.some(b => b.id === 'command_aura_buff');
        if (!hasAuraBuff) {
          ally.buffs.push({
            id: 'command_aura_buff',
            stat: 'damageBonus',
            amount: 0.1, // +10% damage
            expirationTick: state.tick + 30, // Refresh every second
          });
        }
      }
    }
  }

  // Veteran (Vanguard Tier 2): +20% armor (incomingDamageReduction) for nearby allies
  if (hasHeroPassive(hero.definitionId, 'veteran', heroTier as 1 | 2 | 3, heroLevel)) {
    // Apply armor buff to all other heroes if not already present
    for (const ally of state.heroes) {
      if (ally === hero) continue;

      // Check if hero is within 5 units (fixed-point)
      const distSq = FP.distSq(hero.x, hero.y, ally.x, ally.y);
      const auraRange = FP.fromInt(5);
      const auraRangeSq = FP.mul(auraRange, auraRange);

      if (distSq <= auraRangeSq) {
        // Check if already has veteran armor buff
        const hasVeteranBuff = ally.buffs.some(b => b.id === 'veteran_armor_buff');
        if (!hasVeteranBuff) {
          ally.buffs.push({
            id: 'veteran_armor_buff',
            stat: 'incomingDamageReduction',
            amount: 0.2, // +20% damage reduction (armor)
            expirationTick: state.tick + 30, // Refresh every second
          });
        }
      }
    }
  }
}

/**
 * Use available hero skills
 */
function useHeroSkills(
  hero: ActiveHero,
  state: GameState,
  _config: SimConfig,
  rng: Xorshift32,
  enemiesInRange: Enemy[]
): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  const tierData = heroDef.tiers[hero.tier - 1];

  for (const skill of tierData.skills) {
    // Skip if on cooldown or level too low
    if (hero.skillCooldowns[skill.id] > 0) continue;
    if (hero.level < skill.unlockedAtLevel) continue;
    if (skill.isPassive) continue;

    // Apply cooldown reduction from Crystal (Chrono Crystal)
    const cooldownMultiplier = calculateHeroStoneCooldownReduction(hero.infinityStone);
    const adjustedCooldown = Math.floor(skill.cooldownTicks * cooldownMultiplier);

    // Use skill
    hero.skillCooldowns[skill.id] = adjustedCooldown;

    // Apply skill effects
    applySkillEffects(skill.effects, hero, state, enemiesInRange, rng, skill.id);
  }
}
