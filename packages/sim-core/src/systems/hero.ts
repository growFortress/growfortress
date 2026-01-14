/**
 * Hero System
 *
 * Main hero update loop including:
 * - AI and target selection
 * - Physics and movement
 * - State machine (idle, deploying, combat, returning, cooldown, commanded)
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
  HERO_PHYSICS,
  DEFAULT_PHYSICS_CONFIG,
  type PhysicsConfig,
} from '../physics.js';
import { Xorshift32 } from '../rng.js';
import { getHeroById, calculateHeroStats } from '../data/heroes.js';
import {
  selectTarget as simpleSelectTarget,
  shouldHeroRetreat as simpleHeroRetreat,
  resetSimpleAI,
} from '../simple-ai.js';

import {
  HERO_ARRIVAL_RADIUS,
  HERO_BASE_ATTACK_INTERVAL,
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
import {
  calculateTotalArtifactDamageMultiplier,
  hasArtifactPassive,
} from './artifacts.js';
import { createHeroProjectile } from './projectile.js';
import {
  findClosestEnemy2D,
  getHeroAttackRange,
  getFormationPosition,
  applySkillEffects,
} from './helpers.js';

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

/**
 * Check if hero should retreat (simple HP threshold)
 */
function shouldHeroRetreat(
  hero: ActiveHero,
  _state: GameState,
  _config: SimConfig
): boolean {
  return simpleHeroRetreat(hero);
}

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

  // Phase 1: Calculate steering forces and update velocities
  for (const hero of state.heroes) {
    if (hero.state === 'dead') continue;

    // Clean up expired movement modifiers
    hero.movementModifiers = cleanupExpiredModifiers(hero.movementModifiers, state.tick);

    // Update steering based on current state
    updateHeroSteering(hero, state, config);
  }

  // Phase 2: Integrate physics (apply velocity to position)
  // Note: No ally collisions - heroes pass through each other
  for (const hero of state.heroes) {
    if (hero.state === 'dead' || hero.state === 'idle' || hero.state === 'cooldown') continue;

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

  // Phase 3: State machine updates
  for (const hero of state.heroes) {
    switch (hero.state) {
      case 'idle':
        updateHeroIdle(hero, state, config);
        break;
      case 'deploying':
        updateHeroDeployingState(hero, state, config);
        break;
      case 'combat':
        updateHeroCombat(hero, state, config, rng);
        break;
      case 'returning':
        updateHeroReturningState(hero, state, config, rng);
        break;
      case 'cooldown':
        updateHeroCooldown(hero, state, config);
        break;
      case 'dead':
        // Dead heroes stay dead until resurrection or run end
        break;
      case 'commanded':
        updateHeroCommandedState(hero, state, config);
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
 * Update hero steering based on current state
 * Sets velocity direction, actual movement happens in physics phase
 */
function updateHeroSteering(hero: ActiveHero, state: GameState, config: SimConfig): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);
  const maxSpeed = calculateEffectiveSpeed(stats.moveSpeed, hero.movementModifiers, state.tick);

  switch (hero.state) {
    case 'deploying': {
      // Steer towards closest enemy
      const closestEnemy = findClosestEnemy2D(state.enemies, hero.x, hero.y);
      if (closestEnemy) {
        const steering = steerTowards(hero, closestEnemy.x, closestEnemy.y, maxSpeed, HERO_ARRIVAL_RADIUS);
        hero.vx = FP.add(hero.vx, steering.ax);
        hero.vy = FP.add(hero.vy, steering.ay);
      }
      break;
    }
    case 'combat': {
      // Slight movement towards current target if needed, but mostly stationary
      // Heroes in combat stay mostly in place
      hero.vx = FP.mul(hero.vx, FP.fromFloat(0.5)); // Reduce velocity while in combat
      hero.vy = FP.mul(hero.vy, FP.fromFloat(0.5));
      break;
    }
    case 'returning': {
      // Steer back towards formation position
      const heroIndex = state.heroes.indexOf(hero);
      const formation = getFormationPosition(heroIndex >= 0 ? heroIndex : 0, state.heroes.length);
      const targetX = config.fortressX + FP.fromFloat(formation.xOffset);
      const targetY = FP.fromFloat(formation.yOffset);
      const steering = steerTowards(hero, targetX, targetY, maxSpeed, HERO_ARRIVAL_RADIUS);
      hero.vx = FP.add(hero.vx, steering.ax);
      hero.vy = FP.add(hero.vy, steering.ay);
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

  // Deploy if there are enemies and cooldown is ready
  if (canDeploy && state.enemies.length > 0) {
    hero.state = 'deploying';
    hero.lastDeployTick = state.tick;
    // Keep current position - heroes start at fortress but stay where they finished fighting
  }
}

/**
 * Hero deploying state logic - check for state transitions
 * Movement is handled by physics phase
 */
function updateHeroDeployingState(hero: ActiveHero, state: GameState, _config: SimConfig): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  // Find closest enemy (2D)
  const closestEnemy = findClosestEnemy2D(state.enemies, hero.x, hero.y);

  if (!closestEnemy) {
    // No enemies, stay in place and wait
    hero.state = 'idle';
    hero.vx = 0;
    hero.vy = 0;
    return;
  }

  // Calculate range based on hero class
  const attackRange = getHeroAttackRange(heroDef.role);

  // Check if in attack range (2D distance)
  const distSq = FP.distSq(hero.x, hero.y, closestEnemy.x, closestEnemy.y);
  const rangeSq = FP.mul(attackRange, attackRange);

  if (distSq <= rangeSq) {
    // Enter combat
    hero.state = 'combat';
    hero.currentTargetId = closestEnemy.id;
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
  rng: Xorshift32
): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  // Check if enemies in range (2D distance)
  const attackRange = getHeroAttackRange(heroDef.role);
  const attackRangeSq = FP.mul(attackRange, attackRange);
  const enemiesInRange = state.enemies.filter(e => {
    const distSq = FP.distSq(hero.x, hero.y, e.x, e.y);
    return distSq <= attackRangeSq;
  });

  if (enemiesInRange.length === 0) {
    return;
  }

  // Attack if ready
  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);

  // Apply stat penalties from weaknesses (e.g., -20% move speed for Iron Sentinel)
  const attackSpeedPenalty = calculateWeaknessStatPenalty(heroDef.weaknesses, 'attackSpeedMultiplier');
  const effectiveAttackSpeed = stats.attackSpeed * attackSpeedPenalty;
  const attackInterval = Math.floor(HERO_BASE_ATTACK_INTERVAL / effectiveAttackSpeed);

  if (state.tick - hero.lastAttackTick >= attackInterval) {
    // Check behavioral weaknesses
    const behavioralEffects = checkBehavioralWeaknesses(heroDef.weaknesses);

    hero.lastAttackTick = state.tick;

    // Find target using AI-based targeting (or random if weakness triggers)
    let target: Enemy | null;
    if (behavioralEffects.randomTarget && enemiesInRange.length > 1) {
      // Random target instead of AI selection (weakness override)
      const randomIndex = Math.floor(rng.nextFloat() * enemiesInRange.length);
      target = enemiesInRange[randomIndex];
    } else {
      // Use Utility AI to select best target
      target = selectBestTarget(hero, enemiesInRange, state, config);
    }

    // No valid target, skip attack
    if (!target) {
      return;
    }

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

    // Apply conditional weakness penalties to damage
    const isFirstAttack = hero.lastAttackTick === state.tick;
    const isMeleeRange = getHeroAttackRange(heroDef.role) <= FP.fromInt(3);
    finalDamage = applyConditionalWeaknessesToDamage(hero, finalDamage, heroDef.weaknesses, {
      enemyCount: enemiesInRange.length,
      isFirstAttack,
      isMeleeRange,
      pillarId: state.currentPillar,
      hasWeapon: !!hero.equippedArtifact,
    });

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
  }
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

  // Check HP threshold for retreat using AI-based assessment
  if (shouldHeroRetreat(hero, state, config)) {
    hero.state = 'returning';
    hero.currentTargetId = undefined;
    return;
  }

  // Check if enemies in range (2D distance)
  const attackRange = getHeroAttackRange(heroDef.role);
  const attackRangeSq = FP.mul(attackRange, attackRange);
  const enemiesInRange = state.enemies.filter(e => {
    const distSq = FP.distSq(hero.x, hero.y, e.x, e.y);
    return distSq <= attackRangeSq;
  });

  if (enemiesInRange.length === 0) {
    // No enemies in range, move closer or return
    const closestEnemy = findClosestEnemy2D(state.enemies, hero.x, hero.y);
    if (closestEnemy) {
      hero.state = 'deploying'; // Continue moving
    } else {
      hero.state = 'idle'; // Stay in place and wait
      hero.vx = 0;
      hero.vy = 0;
    }
    hero.currentTargetId = undefined;
    return;
  }

  // Perform attack using shared logic
  performHeroAttack(hero, state, config, rng);

  // Check and use skills
  useHeroSkills(hero, state, config, rng, enemiesInRange);
}

/**
 * Hero returning state logic - check for state transitions
 * Movement is handled by physics phase
 * Hero continues attacking enemies in range while retreating
 */
function updateHeroReturningState(hero: ActiveHero, state: GameState, config: SimConfig, rng?: Xorshift32): void {
  const heroDef = getHeroById(hero.definitionId);

  // Check if should cancel retreat and return to combat
  if (heroDef && state.enemies.length > 0) {
    const hpPercent = hero.currentHp / hero.maxHp;

    // Cancel retreat if HP recovered above 50% threshold
    const cancelRetreatThreshold = 0.5;
    if (hpPercent >= cancelRetreatThreshold) {
      hero.state = 'deploying';
      return;
    }

    // Cancel retreat if enemies are critically close to fortress (within 8 units)
    const criticalDistance = FP.fromInt(8);
    const closestEnemy = findClosestEnemy2D(state.enemies, config.fortressX, FP.div(config.fieldHeight, FP.fromInt(2)));
    if (closestEnemy) {
      const enemyDistFromFortress = FP.sub(closestEnemy.x, config.fortressX);
      if (enemyDistFromFortress < criticalDistance && hpPercent > 0.2) {
        // Emergency - enemies too close, return to fight even with low HP
        hero.state = 'deploying';
        return;
      }
    }

    // Attack enemies in range while retreating
    if (heroDef && rng) {
      performHeroAttack(hero, state, config, rng);
    }
  }

  // Check if reached formation position (within 1.5 units)
  const heroIndex = state.heroes.indexOf(hero);
  const formation = getFormationPosition(heroIndex >= 0 ? heroIndex : 0, state.heroes.length);
  const targetX = config.fortressX + FP.fromFloat(formation.xOffset);
  const targetY = FP.fromFloat(formation.yOffset);

  const dx = FP.sub(hero.x, targetX);
  const dy = FP.sub(hero.y, targetY);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
  const arrivalRadiusSq = FP.fromFloat(2.25); // 1.5^2

  if (distSq <= arrivalRadiusSq) {
    // Arrived at formation position
    hero.x = targetX;
    hero.y = targetY;
    hero.vx = 0;
    hero.vy = 0;
    hero.state = 'cooldown';
    hero.currentTargetId = undefined;
  }
}

/**
 * Hero on cooldown after returning
 */
function updateHeroCooldown(hero: ActiveHero, state: GameState, _config: SimConfig): void {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return;

  // Regenerate some HP while in castle
  let regenRate = heroDef.baseStats.hp * 0.02; // 2% per second

  // Iron Man Armor Nano-Repair: +20 HP/s extra regeneration
  if (hasArtifactPassive(hero.equippedArtifact, 'nano-repair')) {
    regenRate += 20;
  }

  if (state.tick % 30 === 0) {
    hero.currentHp = Math.min(hero.currentHp + regenRate, hero.maxHp);
  }

  // Check if ready to deploy again
  // deployCooldown is already in ticks
  const deployCooldownTicks = heroDef.baseStats.deployCooldown;
  if (state.tick - hero.lastDeployTick >= deployCooldownTicks) {
    hero.state = 'idle';
  }
}

/**
 * Hero executing a player-issued command (moving to target position)
 */
function updateHeroCommandedState(hero: ActiveHero, state: GameState, _config: SimConfig): void {
  // Validate command
  if (!hero.commandTarget || !hero.isCommanded) {
    // No valid command, return to normal AI
    hero.state = state.enemies.length > 0 ? 'deploying' : 'idle';
    hero.isCommanded = false;
    hero.commandTarget = undefined;
    return;
  }

  // Check if reached target (within arrival radius of 1.5 units)
  const dx = FP.sub(hero.x, hero.commandTarget.x);
  const dy = FP.sub(hero.y, hero.commandTarget.y);
  const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));
  const arrivalRadiusSq = FP.fromFloat(2.25); // 1.5^2

  if (distSq <= arrivalRadiusSq) {
    // Reached destination - return to normal AI
    hero.state = state.enemies.length > 0 ? 'combat' : 'idle';
    hero.isCommanded = false;
    hero.commandTarget = undefined;
    hero.vx = 0;
    hero.vy = 0;
    return;
  }

  // While moving to target, hero can still attack enemies in range
  // This allows tactical positioning while maintaining combat effectiveness
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
 * Update buff durations
 */
function updateHeroBuffs(hero: ActiveHero, state: GameState): void {
  hero.buffs = hero.buffs.filter(buff => buff.expirationTick > state.tick);
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
    applySkillEffects(skill.effects, hero, state, enemiesInRange, rng);
  }
}
