/**
 * Game Systems - Heroes, Turrets, Projectiles, Skills, Synergies
 *
 * Faza 2: Logika symulacji dla nowych systemów
 */

import { FP } from './fixed.js';
import {
  GameState,
  SimConfig,
  Enemy,
  ActiveHero,
  ActiveTurret,
  ActiveProjectile,
  FortressClass,
  SkillEffect,
  ModifierSet,
  HeroWeakness,
  StatusEffectType,
  TurretTargetingMode,
} from './types.js';
import { analytics } from './analytics.js';
import {
  integratePosition,
  applyFriction,
  clampVelocity,
  detectCircleCollision,
  resolveCollision,
  applySeparationForce,
  calculateEffectiveSpeed,
  cleanupExpiredModifiers,
  steerTowards,
  HERO_PHYSICS,
  DEFAULT_PHYSICS_CONFIG,
  type PhysicsBody,
  type PhysicsConfig,
} from './physics.js';
import { Xorshift32 } from './rng.js';
import { getHeroById, calculateHeroStats } from './data/heroes.js';
import { getTurretById, calculateTurretStats, calculateTurretHp, TURRET_SLOTS } from './data/turrets.js';
import { getClassById } from './data/classes.js';
import { getPillarForWave, calculatePillarDamageMultiplier } from './data/pillars.js';
import { getStoneById } from './data/infinity-stones.js';
import { getArtifactById, getItemById } from './data/artifacts.js';
import { getRelicById, type ExtendedRelicDef } from './data/relics.js';
import type { InfinityStoneType } from './types.js';
import {
  selectTarget as simpleSelectTarget,
  shouldHeroRetreat as simpleHeroRetreat,
  resetSimpleAI,
} from './simple-ai.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Distance at which heroes start attacking */
const HERO_ATTACK_RANGE_BASE = FP.fromInt(3);

/** Fixed-point base (16384 = 1.0) */
const FP_BASE = 16384;

/** Ticks between hero attacks at base speed */
const HERO_BASE_ATTACK_INTERVAL = 30;

/** Turret base attack interval multiplier */
const TURRET_ATTACK_INTERVAL_BASE = 30;

/** Projectile base speed (units per tick) - 1.0 = travels 30 units/sec at 30Hz */
const PROJECTILE_BASE_SPEED = FP.fromFloat(1.0);

/** Ticks for hit flash effect */
const HIT_FLASH_TICKS = 3;

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

/** Arrival radius for steering (when to slow down) */
const HERO_ARRIVAL_RADIUS = FP.fromFloat(5.0);

/** Separation radius between heroes */
const HERO_SEPARATION_RADIUS = FP.fromFloat(2.5);

/** Separation force strength */
const HERO_SEPARATION_FORCE = FP.fromFloat(0.2);

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
// INFINITY STONE HELPERS
// ============================================================================

/**
 * Calculate damage bonus multiplier from an equipped Infinity Stone
 * @returns Multiplier (1.0 = no bonus, 1.5 = +50% damage)
 */
function calculateHeroStoneDamageBonus(stoneType: InfinityStoneType): number {
  const stone = getStoneById(stoneType);
  if (!stone) return 1.0;

  // Find damage multiplier effect
  for (const effect of stone.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'damageMultiplier' && effect.value) {
      // Convert from fixed-point (16384 = 1.0, 24576 = 1.5)
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate cooldown reduction from an equipped Infinity Stone (Time Stone)
 * @returns Reduction multiplier (0.5 = -50% cooldown, meaning 2x faster)
 */
export function calculateHeroStoneCooldownReduction(stoneType: InfinityStoneType | undefined): number {
  if (!stoneType) return 1.0;

  const stone = getStoneById(stoneType);
  if (!stone) return 1.0;

  // Find cooldown reduction effect
  for (const effect of stone.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'cooldownReduction' && effect.value) {
      // Convert from fixed-point, reduction of 24576 means -50%, so multiply cooldown by 0.5
      const reduction = effect.value / FP_BASE;
      return Math.max(0.1, 1 - reduction); // Minimum 10% of original cooldown
    }
  }

  return 1.0;
}

/**
 * Calculate lifesteal from an equipped Infinity Stone (Soul Stone)
 * @returns Lifesteal percentage (0.3 = 30%)
 */
export function calculateHeroStoneLifesteal(stoneType: InfinityStoneType | undefined): number {
  if (!stoneType) return 0;

  const stone = getStoneById(stoneType);
  if (!stone) return 0;

  // Find lifesteal effect
  for (const effect of stone.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'lifesteal' && effect.value) {
      // Convert from fixed-point
      return effect.value / FP_BASE;
    }
  }

  return 0;
}

// ============================================================================
// ARTIFACT HELPERS
// ============================================================================

/**
 * Calculate damage bonus from an equipped Artifact
 * @returns Multiplier (1.0 = no bonus, 1.4 = +40% damage)
 */
function calculateHeroArtifactDamageBonus(artifactId: string | undefined): number {
  if (!artifactId) return 1.0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'damageMultiplier' && effect.value) {
      return effect.value / FP_BASE;
    }
    // Handle 'allStats' which boosts everything including damage
    if (effect.type === 'stat_boost' && effect.stat === 'allStats' && effect.value) {
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate class-specific damage bonus from Artifact (iceDamage, chaosMagic, etc.)
 */
function calculateHeroArtifactClassDamageBonus(
  artifactId: string | undefined,
  heroClass: FortressClass
): number {
  if (!artifactId) return 1.0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 1.0;

  // Map hero class to relevant stat
  const classStatMap: Record<string, string[]> = {
    ice: ['iceDamage'],
    magic: ['chaosMagic', 'spellPower', 'defensiveSpells'],
    lightning: ['lightningDamage'],
    fire: ['fireDamage'],
    poison: ['poisonDamage'],
    natural: ['physicalDamage'],
    tech: ['techDamage'],
  };

  const relevantStats = classStatMap[heroClass] || [];

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat && relevantStats.includes(effect.stat) && effect.value) {
      return effect.value / FP_BASE;
    }
  }

  return 1.0;
}

/**
 * Calculate dodge chance from Artifact (Cloak of Levitation)
 */
export function calculateHeroArtifactDodgeChance(artifactId: string | undefined): number {
  if (!artifactId) return 0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'dodgeChance' && effect.value) {
      return (effect.value / FP_BASE) - 1; // Convert from multiplier to percentage
    }
  }

  return 0;
}

/**
 * Calculate block chance from Artifact (Captain's Shield)
 */
export function calculateHeroArtifactBlockChance(artifactId: string | undefined): number {
  if (!artifactId) return 0;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return 0;

  for (const effect of artifact.effects) {
    if (effect.type === 'stat_boost' && effect.stat === 'blockChance' && effect.value) {
      return (effect.value / FP_BASE) - 1;
    }
  }

  return 0;
}

/**
 * Check if artifact has a specific passive effect
 */
export function hasArtifactPassive(artifactId: string | undefined, passiveKeyword: string): boolean {
  if (!artifactId) return false;

  const artifact = getArtifactById(artifactId);
  if (!artifact) return false;

  for (const effect of artifact.effects) {
    if (effect.type === 'passive' && effect.description.toLowerCase().includes(passiveKeyword.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Apply item effects to hero (consumables with duration)
 */
export function applyItemToHero(
  hero: ActiveHero,
  itemId: string,
  currentTick: number
): void {
  const item = getItemById(itemId);
  if (!item) return;

  for (const effect of item.effects) {
    switch (effect.type) {
      case 'instant':
        // Apply instant effects
        if (effect.stat === 'hp' && effect.value) {
          const healAmount = effect.value / FP_BASE;
          hero.currentHp = Math.min(hero.currentHp + healAmount, hero.maxHp);
        }
        if (effect.stat === 'xp' && effect.value) {
          hero.xp += effect.value / FP_BASE;
        }
        if (effect.stat === 'shield' && effect.value) {
          // Add as temporary HP
          hero.currentHp += effect.value / FP_BASE;
        }
        break;

      case 'duration':
        // Add buff with duration - only if stat is valid ModifierSet key
        if (effect.stat && effect.value && effect.duration) {
          // Map item stats to ModifierSet stats
          const statMapping: Record<string, keyof ModifierSet> = {
            'damageMultiplier': 'damageMultiplier',
            'attackSpeed': 'attackSpeedMultiplier',
            'critChance': 'critChance',
          };

          const modifierStat = statMapping[effect.stat];
          if (modifierStat) {
            hero.buffs.push({
              id: `item_${itemId}_${currentTick}`,
              stat: modifierStat,
              amount: (effect.value / FP_BASE) - 1, // Convert to bonus amount
              expirationTick: currentTick + effect.duration,
            });
          }
        }
        break;
    }
  }

  // Remove item from inventory
  const itemIndex = hero.equippedItems.indexOf(itemId);
  if (itemIndex !== -1) {
    hero.equippedItems.splice(itemIndex, 1);
  }
}

/**
 * Calculate all artifact damage bonuses combined
 */
function calculateTotalArtifactDamageMultiplier(
  hero: ActiveHero,
  heroClass: FortressClass
): number {
  let multiplier = 1.0;

  // Base artifact damage bonus
  multiplier *= calculateHeroArtifactDamageBonus(hero.equippedArtifact);

  // Class-specific damage bonus
  multiplier *= calculateHeroArtifactClassDamageBonus(hero.equippedArtifact, heroClass);

  if (hero.definitionId) {
    analytics.trackDamage('hero', hero.definitionId, 0); // Checkpoint hero presence
  }

  return multiplier;
}

/**
 * Apply damage to hero with artifact defensive effects (dodge, block) and weakness vulnerabilities
 * @returns actual damage taken (after dodge/block)
 */
export function applyDamageToHero(
  hero: ActiveHero,
  damage: number,
  rng: Xorshift32,
  incomingDamageClass?: FortressClass
): number {
  const heroDef = getHeroById(hero.definitionId);

  // Apply weakness damage vulnerability (e.g., Thunderlord +25% from Magic)
  if (heroDef && incomingDamageClass) {
    const weaknessMultiplier = calculateWeaknessDamageMultiplier(heroDef.weaknesses, incomingDamageClass);
    damage = Math.floor(damage * weaknessMultiplier);
  }
  // Check dodge (Cloak of Levitation)
  const dodgeChance = calculateHeroArtifactDodgeChance(hero.equippedArtifact);
  if (dodgeChance > 0 && rng.nextFloat() < dodgeChance) {
    return 0; // Dodged!
  }

  // Check block (Captain's Shield)
  const blockChance = calculateHeroArtifactBlockChance(hero.equippedArtifact);
  if (blockChance > 0 && rng.nextFloat() < blockChance) {
    // Blocked - reduce damage by 75%
    damage = Math.floor(damage * 0.25);

    // Vibranium Absorption: heal when blocking
    if (hasArtifactPassive(hero.equippedArtifact, 'vibranium absorption')) {
      hero.currentHp = Math.min(hero.currentHp + Math.floor(damage * 0.5), hero.maxHp);
    }
  }

  // Check Sentient Protection (Cloak - blocks one fatal hit per wave)
  if (hero.currentHp - damage <= 0 && hasArtifactPassive(hero.equippedArtifact, 'sentient protection')) {
    // Check if this passive was already used this wave
    const usedThisWave = hero.buffs.some(b => b.id === 'sentient_protection_used');
    if (!usedThisWave) {
      // Block fatal damage, leave at 1 HP
      damage = hero.currentHp - 1;
      // Mark as used (using luckMultiplier as a marker with 0 effect)
      hero.buffs.push({
        id: 'sentient_protection_used',
        stat: 'luckMultiplier',
        amount: 0,
        expirationTick: Infinity, // Cleared on wave end
      });
    }
  }

  if (hero.definitionId) {
    analytics.trackDamageTaken(hero.definitionId, damage);
  }

  hero.currentHp -= damage;
  analytics.trackDamage('fortress', 'fortress', damage); // Technically hero taking damage, but for now we track this flow
  return damage;
}

/**
 * Apply damage to a turret from enemy attack
 * @returns actual damage dealt
 */
export function applyDamageToTurret(
  turret: ActiveTurret,
  damage: number
): number {
  const actualDamage = Math.min(damage, turret.currentHp);
  turret.currentHp -= actualDamage;
  return actualDamage;
}

// ============================================================================
// HERO WEAKNESS SYSTEM
// ============================================================================

/**
 * Calculate damage multiplier from hero weaknesses when taking damage
 * @param weaknesses - Hero's weaknesses
 * @param incomingDamageClass - Class of the incoming damage
 * @returns Damage multiplier (1.0 = no change, 1.5 = +50% damage taken)
 */
export function calculateWeaknessDamageMultiplier(
  weaknesses: HeroWeakness[],
  incomingDamageClass: FortressClass
): number {
  let multiplier = 1.0;

  for (const weakness of weaknesses) {
    if (weakness.effect.type === 'damage_vulnerability') {
      if (weakness.effect.damageClass === incomingDamageClass && weakness.effect.multiplier) {
        multiplier *= weakness.effect.multiplier;
      }
    }
  }

  return multiplier;
}

/**
 * Calculate stat penalty from hero weaknesses
 * @param weaknesses - Hero's weaknesses
 * @param stat - The stat to check
 * @returns Multiplier for the stat (e.g., 0.7 for -30%)
 */
export function calculateWeaknessStatPenalty(
  weaknesses: HeroWeakness[],
  stat: string
): number {
  let multiplier = 1.0;

  for (const weakness of weaknesses) {
    if (weakness.effect.type === 'stat_penalty' && weakness.effect.stat === stat && weakness.effect.amount) {
      multiplier *= weakness.effect.amount;
    }
  }

  return multiplier;
}

/**
 * Check if hero has a specific behavioral weakness
 */
export function hasWeaknessBehavior(weaknesses: HeroWeakness[], behavior: string): boolean {
  return weaknesses.some(w =>
    w.effect.type === 'behavioral' && w.effect.behavior === behavior
  );
}

/**
 * Get chance for behavioral weakness (friendly fire, betray, etc.)
 */
export function getWeaknessBehaviorChance(weaknesses: HeroWeakness[], behavior: string): number {
  for (const weakness of weaknesses) {
    if (weakness.effect.type === 'behavioral' && weakness.effect.behavior === behavior) {
      return weakness.effect.chance ?? 0;
    }
  }
  return 0;
}

/**
 * Check if conditional weakness applies
 */
export function shouldApplyConditionalWeakness(
  weakness: HeroWeakness,
  hero: ActiveHero,
  context: {
    enemyCount?: number;
    isFirstAttack?: boolean;
    isStunned?: boolean;
    isMeleeRange?: boolean;
    pillarId?: string;
    isPrecisionSkill?: boolean;
    hasWeapon?: boolean;
  }
): boolean {
  if (weakness.effect.type !== 'conditional') return false;

  const condition = weakness.effect.condition;
  if (!condition) return false;

  switch (condition) {
    case 'hp > 80%':
      return hero.currentHp / hero.maxHp > 0.8;
    case 'first_attack':
      return context.isFirstAttack ?? false;
    case 'enemies >= 5':
      return (context.enemyCount ?? 0) >= 5;
    case 'stunned':
      return context.isStunned ?? false;
    case 'cc_applied':
      return context.isStunned ?? false;
    case 'melee_range':
      return context.isMeleeRange ?? false;
    case 'precision_skill':
      return context.isPrecisionSkill ?? false;
    case 'not_cosmos_pillar':
      return context.pillarId !== 'cosmos';
    case 'no_weapon':
      return !(context.hasWeapon ?? true);
    case 'melee_attack':
      return context.isMeleeRange ?? false;
    case 'not_first_strike':
      return !(context.isFirstAttack ?? true);
    case 'primitive_enemy':
      // Simplified - all enemies in first pillar are "primitive"
      return context.pillarId === 'streets';
    default:
      return false;
  }
}

/**
 * Apply all conditional weakness effects to damage output
 */
export function applyConditionalWeaknessesToDamage(
  hero: ActiveHero,
  baseDamage: number,
  weaknesses: HeroWeakness[],
  context: {
    enemyCount?: number;
    isFirstAttack?: boolean;
    isStunned?: boolean;
    isMeleeRange?: boolean;
    pillarId?: string;
    isPrecisionSkill?: boolean;
    hasWeapon?: boolean;
  }
): number {
  let damage = baseDamage;

  for (const weakness of weaknesses) {
    if (shouldApplyConditionalWeakness(weakness, hero, context)) {
      // Only conditional type has the 'effect' string property
      if (weakness.effect.type !== 'conditional') continue;

      const effectStr = weakness.effect.effect || '';

      // Parse effect string like "-50% damage" or "-20% all stats"
      const match = effectStr.match(/(-?\d+)%\s*(damage|effectiveness|all stats|HP)?/i);
      if (match) {
        const percent = parseInt(match[1], 10);
        const target = match[2]?.toLowerCase() || 'damage';

        if (target === 'damage' || target === 'effectiveness' || target === 'all stats') {
          damage = Math.floor(damage * (1 + percent / 100));
        }
      }
    }
  }

  return Math.max(1, damage); // Minimum 1 damage
}

/**
 * Apply behavioral weakness effects during combat
 * @returns Object with flags for various behavioral effects
 */
export function checkBehavioralWeaknesses(
  weaknesses: HeroWeakness[],
  rng: Xorshift32
): {
  friendlyFire: boolean;
  noKillingBlow: boolean;
  needsReload: boolean;
  isBetray: boolean;
  castingInterrupted: boolean;
  randomTarget: boolean;
} {
  const result = {
    friendlyFire: false,
    noKillingBlow: false,
    needsReload: false,
    isBetray: false,
    castingInterrupted: false,
    randomTarget: false,
  };

  for (const weakness of weaknesses) {
    if (weakness.effect.type !== 'behavioral') continue;

    const behavior = weakness.effect.behavior;
    const chance = weakness.effect.chance ?? 1.0;

    switch (behavior) {
      case 'friendly_fire':
      case 'friendly_fire_spell':
        if (rng.nextFloat() < chance) {
          result.friendlyFire = true;
        }
        break;
      case 'no_killing_blow':
        result.noKillingBlow = true;
        break;
      case 'reload_20':
      case 'recharge_after_10_attacks':
        // This needs to be tracked per hero
        result.needsReload = true;
        break;
      case 'betray':
        if (rng.nextFloat() < chance) {
          result.isBetray = true;
        }
        break;
      case 'casting_interrupt':
        result.castingInterrupted = true;
        break;
      case 'random_target':
        result.randomTarget = true;
        break;
    }
  }

  return result;
}

// ============================================================================
// HERO SYSTEM
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

  // Phase 2: Apply separation forces between heroes
  const activeHeroes = state.heroes.filter(h => h.state !== 'dead' && h.state !== 'idle' && h.state !== 'cooldown');
  if (activeHeroes.length > 1) {
    // Convert heroes to physics bodies for separation
    const bodies: PhysicsBody[] = activeHeroes.map(h => ({
      x: h.x,
      y: h.y,
      vx: h.vx,
      vy: h.vy,
      radius: h.radius,
      mass: h.mass,
    }));

    applySeparationForce(bodies, HERO_SEPARATION_RADIUS, HERO_SEPARATION_FORCE);

    // Write back velocities
    for (let i = 0; i < activeHeroes.length; i++) {
      activeHeroes[i].vx = bodies[i].vx;
      activeHeroes[i].vy = bodies[i].vy;
    }
  }

  // Phase 3: Integrate physics (apply velocity to position)
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

  // Phase 4: Resolve collisions
  for (let i = 0; i < activeHeroes.length; i++) {
    for (let j = i + 1; j < activeHeroes.length; j++) {
      const collision = detectCircleCollision(activeHeroes[i], activeHeroes[j]);
      if (collision) {
        resolveCollision(activeHeroes[i], activeHeroes[j], collision);
      }
    }
  }

  // Phase 5: State machine updates
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
        updateHeroReturningState(hero, state, config);
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
      // Steer back towards fortress
      const fortressY = FP.div(config.fieldHeight, FP.fromInt(2)); // Center Y
      const steering = steerTowards(hero, config.fortressX, fortressY, maxSpeed, HERO_ARRIVAL_RADIUS);
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

  // Attack if ready
  const stats = calculateHeroStats(heroDef, hero.tier, hero.level);

  // Apply stat penalties from weaknesses (e.g., -20% move speed for Iron Sentinel)
  const attackSpeedPenalty = calculateWeaknessStatPenalty(heroDef.weaknesses, 'attackSpeedMultiplier');
  const effectiveAttackSpeed = stats.attackSpeed * attackSpeedPenalty;
  const attackInterval = Math.floor(HERO_BASE_ATTACK_INTERVAL / effectiveAttackSpeed);

  if (state.tick - hero.lastAttackTick >= attackInterval) {
    // Check behavioral weaknesses
    const behavioralEffects = checkBehavioralWeaknesses(heroDef.weaknesses, rng);

    // Betray weakness (Frost Giant): skip this attack turn
    if (behavioralEffects.isBetray) {
      hero.lastAttackTick = state.tick;
      return;
    }

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

    // Infinity Stone bonus
    if (hero.infinityStone) {
      const stoneBonus = calculateHeroStoneDamageBonus(hero.infinityStone);
      finalDamage = Math.floor(finalDamage * stoneBonus);
    }

    // Artifact bonus
    const artifactBonus = calculateTotalArtifactDamageMultiplier(hero, heroDef.class);
    finalDamage = Math.floor(finalDamage * artifactBonus);

    // Buff bonuses (from items)
    for (const buff of hero.buffs) {
      if (buff.stat === 'damageMultiplier') {
        finalDamage = Math.floor(finalDamage * (1 + buff.amount));
      }
    }

    // Apply conditional weakness penalties to damage
    const isFirstAttack = hero.lastAttackTick === state.tick && hero.state === 'combat';
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

    // Friendly fire weakness check - if triggered, don't attack enemy
    // (in a more complex system this would damage allies instead)
    if (!behavioralEffects.friendlyFire) {
      // Create projectile
      createHeroProjectile(hero, target, state, heroDef.class, finalDamage);
    }
  }

  // Check and use skills
  useHeroSkills(hero, state, config, rng, enemiesInRange);
}

/**
 * Hero returning state logic - check for state transitions
 * Movement is handled by physics phase
 */
function updateHeroReturningState(hero: ActiveHero, state: GameState, config: SimConfig): void {
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
  }

  // Check if reached fortress (within 1 unit)
  const fortressZone = FP.add(config.fortressX, FP.fromInt(2));

  if (hero.x <= fortressZone) {
    // Arrived at fortress
    hero.x = FP.add(config.fortressX, FP.fromInt(1));
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

    // Apply cooldown reduction from Infinity Stone (Time Stone)
    const cooldownMultiplier = calculateHeroStoneCooldownReduction(hero.infinityStone);
    const adjustedCooldown = Math.floor(skill.cooldownTicks * cooldownMultiplier);

    // Use skill
    hero.skillCooldowns[skill.id] = adjustedCooldown;

    // Apply skill effects
    applySkillEffects(skill.effects, hero, state, enemiesInRange, rng);
  }
}

/**
 * Get hero attack range based on role
 */
function getHeroAttackRange(role: string): number {
  switch (role) {
    case 'tank': return FP.fromInt(2);
    case 'dps': return FP.fromInt(4);
    case 'support': return FP.fromInt(5);
    case 'crowd_control': return FP.fromInt(6);
    default: return HERO_ATTACK_RANGE_BASE;
  }
}

// ============================================================================
// TURRET SYSTEM
// ============================================================================

/**
 * Select target enemy based on turret targeting mode
 */
function selectTarget(
  enemies: Enemy[],
  targetingMode: TurretTargetingMode,
  turretX: number,
  turretY: number
): Enemy {
  switch (targetingMode) {
    case 'closest_to_fortress':
      // Enemy with lowest X (closest to fortress at x=2)
      return enemies.reduce((a, b) => a.x < b.x ? a : b);

    case 'weakest':
      // Enemy with lowest current HP
      return enemies.reduce((a, b) => a.hp < b.hp ? a : b);

    case 'strongest':
      // Enemy with highest current HP
      return enemies.reduce((a, b) => a.hp > b.hp ? a : b);

    case 'nearest_to_turret':
      // Enemy closest to turret by Euclidean distance
      return enemies.reduce((a, b) => {
        const distA = FP.distSq(a.x, a.y, turretX, turretY);
        const distB = FP.distSq(b.x, b.y, turretX, turretY);
        return distA < distB ? a : b;
      });

    default:
      return enemies.reduce((a, b) => a.x < b.x ? a : b);
  }
}

/**
 * Update all turrets - targeting and attacking
 */
export function updateTurrets(
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  for (const turret of state.turrets) {
    const turretDef = getTurretById(turret.definitionId);
    if (!turretDef) continue;

    const slot = TURRET_SLOTS.find(s => s.id === turret.slotIndex);
    if (!slot) continue;

    // Calculate turret position
    const turretX = FP.add(config.fortressX, FP.fromFloat(slot.offsetX));
    const turretY = FP.fromFloat(7 + slot.offsetY);

    // Get turret stats with class modifier
    const stats = calculateTurretStats(turretDef, turret.currentClass, turret.tier);

    // Find enemies in range
    // NOTE: turret stats use 16384 as 1.0 scale, not FP's 65536
    const rangeFp = stats.range << 2; // 16384 -> 65536 scale
    const rangeSq = FP.mul(rangeFp, rangeFp);
    const enemiesInRange = state.enemies.filter(e => {
      const distSq = FP.distSq(e.x, e.y, turretX, turretY);
      return distSq <= rangeSq;
    });

    if (enemiesInRange.length === 0) continue;

    // Calculate attack interval
    // NOTE: turret stats use 16384 as 1.0 scale
    const attackSpeed = stats.attackSpeed / 16384;
    const attackInterval = Math.floor(TURRET_ATTACK_INTERVAL_BASE / attackSpeed);

    if (state.tick - turret.lastAttackTick >= attackInterval) {
      turret.lastAttackTick = state.tick;

      // Target enemy based on turret's targeting mode
      const target = selectTarget(
        enemiesInRange,
        turret.targetingMode || 'closest_to_fortress',
        turretX,
        turretY
      );

      // Create projectile (damage also uses 16384 scale)
      createTurretProjectile(turret, target, state, turretX, turretY, turret.currentClass, stats.damage / 16384);
    }

    // Check special ability
    if (turretDef.ability && turret.specialCooldown <= 0) {
      // Use special ability
      turret.specialCooldown = turretDef.ability.cooldown;

      // Apply ability effect
      applyTurretAbility(turret, turretDef.ability, state, enemiesInRange, rng);
    }

    // Decrease special cooldown
    if (turret.specialCooldown > 0) {
      turret.specialCooldown--;
    }
  }
}

/**
 * Apply turret special ability
 */
function applyTurretAbility(
  _turret: ActiveTurret,
  ability: any,
  state: GameState,
  enemies: Enemy[],
  _rng: Xorshift32
): void {
  switch (ability.effect.type) {
    case 'damage_boost':
      // Buff self for next attacks (handled in attack logic)
      break;
    case 'aoe_attack':
      // Deal damage to all enemies in area
      for (const enemy of enemies) {
        const damage = ability.effect.value ? ability.effect.value * 10 : 50;
        enemy.hp -= damage;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
    case 'guaranteed_crit':
      // Next attack crits (handled in projectile logic)
      break;
    case 'chain_all':
      // Hit all enemies
      for (const enemy of enemies) {
        enemy.hp -= 15;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
    case 'freeze_all':
      // Freeze all enemies (reduce speed)
      for (const enemy of enemies) {
        enemy.speed = FP.mul(enemy.speed, FP.fromFloat(0.5));
      }
      break;
    case 'zone_damage':
      // Create damage zone (simplified: instant damage)
      for (const enemy of enemies) {
        enemy.hp -= 20;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
    case 'buff_allies':
      // Buff all heroes
      for (const hero of state.heroes) {
        hero.buffs.push({
          id: 'power_surge',
          stat: 'damageMultiplier',
          amount: ability.effect.value || 0.5,
          expirationTick: state.tick + (ability.effect.duration || 240),
        });
      }
      break;
    case 'poison_all':
      // Apply poison stacks
      for (const enemy of enemies) {
        // Simplified: deal damage over time
        enemy.hp -= 10;
        enemy.hitFlashTicks = HIT_FLASH_TICKS;
      }
      break;
  }
}

// ============================================================================
// PROJECTILE SYSTEM
// ============================================================================

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

/** Default duration for status effects (in ticks, ~5 seconds at 30Hz) */
const DEFAULT_EFFECT_DURATION = 150;

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
function applyEffectToEnemy(effect: SkillEffect, enemy: Enemy, state: GameState): void {
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
 * Create a projectile from hero attack
 */
function createHeroProjectile(
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
function createTurretProjectile(
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

/**
 * Get projectile type for class
 */
function getProjectileTypeForClass(fortressClass: FortressClass): any {
  switch (fortressClass) {
    case 'natural': return 'physical';
    case 'ice': return 'icicle';
    case 'fire': return 'fireball';
    case 'lightning': return 'bolt';
    case 'tech': return 'laser';
    default: return 'physical';
  }
}

// ============================================================================
// FORTRESS SKILLS SYSTEM
// ============================================================================

/**
 * Update fortress class skills
 */
export function updateFortressSkills(
  state: GameState,
  config: SimConfig,
  rng: Xorshift32
): void {
  const classDef = getClassById(state.fortressClass);
  if (!classDef) return;

  // Update cooldowns
  for (const skillId of Object.keys(state.skillCooldowns)) {
    if (state.skillCooldowns[skillId] > 0) {
      state.skillCooldowns[skillId]--;
    }
  }

  // Auto-use skills that are ready (AI-controlled)
  for (const skill of classDef.skills) {
    // Check if skill is unlocked
    if (!state.activeSkills.includes(skill.id)) continue;

    // Check cooldown
    if (state.skillCooldowns[skill.id] > 0) continue;

    // Check if there are enemies to target
    if (state.enemies.length === 0) continue;

    // Use skill
    executeFortressSkill(skill, state, config, rng);
    const cooldownMultiplier =
      state.modifiers.cooldownMultiplier *
      (state.synergyModifiers.cooldownMultiplier ?? 1);
    state.skillCooldowns[skill.id] = Math.floor(skill.cooldownTicks * cooldownMultiplier);
  }
}

/**
 * Execute a fortress skill
 */
function executeFortressSkill(
  skill: any,
  state: GameState,
  _config: SimConfig,
  _rng: Xorshift32
): void {
  const centerX = FP.fromInt(20); // Center of field
  const radius = skill.radius || FP.fromInt(5);

  // Find enemies in radius
  const enemiesInRadius = state.enemies.filter(e => {
    const dist = FP.abs(FP.sub(e.x, centerX));
    return dist <= radius;
  });

  if (enemiesInRadius.length === 0) return;

  // Apply skill effects
  const synergyDamage = state.synergyModifiers.damageMultiplier ?? 1;
  const pillarDamage = state.pillarModifiers.damageMultiplier ?? 1;
  const baseDamage = Math.floor(
    skill.damage * state.modifiers.damageMultiplier * synergyDamage * pillarDamage
  );

  for (const enemy of enemiesInRadius) {
    enemy.hp -= baseDamage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;

    // Apply additional effects
    for (const effect of skill.effects) {
      applyEffectToEnemy(effect, enemy, state);
    }
  }
}

// ============================================================================
// SYNERGY SYSTEM
// ============================================================================

/**
 * Calculate synergy bonuses based on hero/turret class matching
 */
export function calculateSynergyBonuses(state: GameState): Partial<ModifierSet> {
  const bonuses: Partial<ModifierSet> = {};

  const fortressClass = state.fortressClass;

  // Count matching classes
  let heroMatches = 0;
  let turretMatches = 0;

  for (const hero of state.heroes) {
    const heroDef = getHeroById(hero.definitionId);
    if (heroDef && heroDef.class === fortressClass) {
      heroMatches++;
    }
  }

  for (const turret of state.turrets) {
    if (turret.currentClass === fortressClass) {
      turretMatches++;
    }
  }

  const addMultiplier = (key: keyof ModifierSet, amount: number): void => {
    bonuses[key] = (bonuses[key] ?? 1) + amount;
  };

  const multiplyMultiplier = (key: keyof ModifierSet, multiplier: number): void => {
    bonuses[key] = (bonuses[key] ?? 1) * multiplier;
  };

  const addAdditive = (key: keyof ModifierSet, amount: number): void => {
    bonuses[key] = (bonuses[key] ?? 0) + amount;
  };

  // Hero-Fortress synergy: +30% DMG, +15% AS per matching hero
  if (heroMatches > 0) {
    addMultiplier('damageMultiplier', 0.30 * heroMatches);
    addMultiplier('attackSpeedMultiplier', 0.15 * heroMatches);
  }

  // Turret-Fortress synergy: +25% AS, +15% DMG per matching turret
  if (turretMatches > 0) {
    addMultiplier('attackSpeedMultiplier', 0.25 * turretMatches);
    addMultiplier('damageMultiplier', 0.15 * turretMatches);
  }

  // Full synergy bonus (minimum set size)
  const hasFullSynergy = heroMatches >= 2 && turretMatches >= 3;
  if (hasFullSynergy) {
    // +50% DMG, +15% crit, -20% cooldowns
    addMultiplier('damageMultiplier', 0.50);
    addAdditive('critChance', 0.15);
    multiplyMultiplier('cooldownMultiplier', 0.80);
  }

  const synergyRelics = state.relics
    .map((relic) => getRelicById(relic.id))
    .filter((relic): relic is ExtendedRelicDef => !!relic && relic.category === 'synergy');

  const getSynergyRelic = (id: string): ExtendedRelicDef | undefined =>
    synergyRelics.find((relic) => relic.id === id);

  const matchingUnits = heroMatches + turretMatches;

  const elementalBond = getSynergyRelic('elemental-bond');
  if (elementalBond && matchingUnits >= 2) {
    const damageMultiplier = elementalBond.modifiers.damageMultiplier;
    if (damageMultiplier) {
      multiplyMultiplier('damageMultiplier', damageMultiplier);
    }
  }

  const teamSpirit = getSynergyRelic('team-spirit');
  if (teamSpirit && heroMatches > 0) {
    const stacks = heroMatches;
    const applyStackedMultiplier = (
      key: keyof ModifierSet,
      perStackMultiplier: number | undefined
    ): void => {
      if (!perStackMultiplier) return;
      const totalMultiplier = 1 + ((perStackMultiplier - 1) * stacks);
      multiplyMultiplier(key, totalMultiplier);
    };

    applyStackedMultiplier('damageMultiplier', teamSpirit.modifiers.damageMultiplier);
    applyStackedMultiplier('attackSpeedMultiplier', teamSpirit.modifiers.attackSpeedMultiplier);
    applyStackedMultiplier('maxHpMultiplier', teamSpirit.modifiers.maxHpMultiplier);
  }

  const harmonicResonance = getSynergyRelic('harmonic-resonance');
  if (harmonicResonance && hasFullSynergy) {
    const damageMultiplier = harmonicResonance.modifiers.damageMultiplier;
    if (damageMultiplier) {
      multiplyMultiplier('damageMultiplier', damageMultiplier);
    }
    const cooldownMultiplier = harmonicResonance.modifiers.cooldownMultiplier;
    if (cooldownMultiplier) {
      multiplyMultiplier('cooldownMultiplier', cooldownMultiplier);
    }
  }

  const hasUnityCrystal = !!getSynergyRelic('unity-crystal');
  if (hasUnityCrystal) {
    const effectiveness = 1.5;
    const scaleMultiplier = (value: number): number =>
      1 + ((value - 1) * effectiveness);
    const scaleAdditive = (value: number): number =>
      value * effectiveness;

    if (bonuses.damageMultiplier !== undefined) {
      bonuses.damageMultiplier = scaleMultiplier(bonuses.damageMultiplier);
    }
    if (bonuses.attackSpeedMultiplier !== undefined) {
      bonuses.attackSpeedMultiplier = scaleMultiplier(bonuses.attackSpeedMultiplier);
    }
    if (bonuses.cooldownMultiplier !== undefined) {
      bonuses.cooldownMultiplier = scaleMultiplier(bonuses.cooldownMultiplier);
    }
    if (bonuses.maxHpMultiplier !== undefined) {
      bonuses.maxHpMultiplier = scaleMultiplier(bonuses.maxHpMultiplier);
    }
    if (bonuses.critChance !== undefined) {
      bonuses.critChance = scaleAdditive(bonuses.critChance);
    }
  }

  return bonuses;
}

/**
 * Calculate pillar class modifiers
 */
export function calculatePillarModifiers(state: GameState): Partial<ModifierSet> {
  const pillar = getPillarForWave(state.wave);
  if (!pillar) return {};

  const damageMultiplier = calculatePillarDamageMultiplier(pillar.id, state.fortressClass);

  // Convert from fixed-point (16384 = 1.0) to float
  return {
    damageMultiplier: damageMultiplier / 16384,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find closest enemy to a position (1D - X only, legacy)
 * @deprecated Use findClosestEnemy2D for 2D physics
 */
export function findClosestEnemy(enemies: Enemy[], x: number): Enemy | null {
  if (enemies.length === 0) return null;

  let closest = enemies[0];
  let closestDist = Math.abs(FP.toFloat(enemies[0].x) - FP.toFloat(x));

  for (const enemy of enemies) {
    const dist = Math.abs(FP.toFloat(enemy.x) - FP.toFloat(x));
    if (dist < closestDist) {
      closest = enemy;
      closestDist = dist;
    }
  }

  return closest;
}

/**
 * Find closest enemy to a position (2D - considers both X and Y)
 */
function findClosestEnemy2D(enemies: Enemy[], x: number, y: number): Enemy | null {
  if (enemies.length === 0) return null;

  let closest = enemies[0];
  let closestDistSq = FP.distSq(enemies[0].x, enemies[0].y, x, y);

  for (const enemy of enemies) {
    const distSq = FP.distSq(enemy.x, enemy.y, x, y);
    if (distSq < closestDistSq) {
      closest = enemy;
      closestDistSq = distSq;
    }
  }

  return closest;
}

/**
 * Apply skill effects to targets
 */
function applySkillEffects(
  effects: SkillEffect[],
  hero: ActiveHero,
  state: GameState,
  enemies: Enemy[],
  _rng: Xorshift32
): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'damage':
        // Deal damage to enemies in range
        for (const enemy of enemies) {
          const damage = effect.amount || 0;
          enemy.hp -= damage;
          enemy.hitFlashTicks = HIT_FLASH_TICKS;
        }
        break;

      case 'slow':
        for (const enemy of enemies) {
          enemy.speed = FP.mul(enemy.speed, FP.fromFloat(1 - (effect.percent || 0.3)));
        }
        break;

      case 'stun':
      case 'freeze':
        for (const enemy of enemies) {
          enemy.speed = 0;
        }
        break;

      case 'buff':
        // Apply buff to self
        if (effect.stat) {
          hero.buffs.push({
            id: `skill_buff_${state.tick}`,
            stat: effect.stat,
            amount: effect.amount || 0,
            expirationTick: state.tick + (effect.duration || 150),
          });
        }
        break;

      case 'heal':
        hero.currentHp = Math.min(
          hero.currentHp + (effect.amount || 0),
          hero.maxHp
        );
        break;

      case 'shield':
        // Add temporary HP (simplified)
        hero.currentHp += effect.amount || 0;
        break;
    }
  }
}

// ============================================================================
// INITIALIZATION HELPERS
// ============================================================================

/**
 * Initialize heroes from config
 */
export function initializeHeroes(
  heroIds: string[],
  fortressX: number
): ActiveHero[] {
  const heroes: ActiveHero[] = [];
  const heroCount = heroIds.filter(id => getHeroById(id)).length;

  // Calculate Y positions: single hero centered, multiple heroes spread out
  // Field height is 15 units, center is 7.5
  const centerY = 7.5;
  const spreadRange = 5; // Total spread range (units from top to bottom)

  let validHeroIndex = 0;

  for (const heroId of heroIds) {
    const heroDef = getHeroById(heroId);
    if (!heroDef) continue;

    // Calculate Y position based on hero count
    let heroY: number;
    if (heroCount === 1) {
      // Single hero: centered
      heroY = centerY;
    } else {
      // Multiple heroes: spread evenly across the path
      // Index 0 at top, last index at bottom
      const spreadStep = spreadRange / (heroCount - 1);
      heroY = (centerY - spreadRange / 2) + (validHeroIndex * spreadStep);
    }

    const hero: ActiveHero = {
      definitionId: heroId,
      tier: 1,
      level: 1,
      xp: 0,
      currentHp: heroDef.baseStats.hp,
      maxHp: heroDef.baseStats.hp,

      // Position
      x: fortressX + FP.fromInt(1),
      y: FP.fromFloat(heroY),

      // Physics
      vx: 0,
      vy: 0,
      radius: HERO_PHYSICS.defaultRadius,
      mass: HERO_PHYSICS.defaultMass,
      movementModifiers: [],

      state: 'idle',
      lastAttackTick: 0,
      lastDeployTick: -1000, // Ready to deploy immediately
      skillCooldowns: {},
      buffs: [],
      equippedItems: [],
    };

    validHeroIndex++;

    // Initialize skill cooldowns
    for (const tier of heroDef.tiers) {
      for (const skill of tier.skills) {
        hero.skillCooldowns[skill.id] = 0;
      }
    }

    heroes.push(hero);
  }

  return heroes;
}

/**
 * Initialize turrets from config
 */
export function initializeTurrets(
  turretConfigs: Array<{ definitionId: string; slotIndex: number; class: FortressClass; tier?: 1 | 2 | 3 }>
): ActiveTurret[] {
  const turrets: ActiveTurret[] = [];

  for (const config of turretConfigs) {
    const turretDef = getTurretById(config.definitionId);
    const tier = config.tier || 1;
    const maxHp = turretDef ? calculateTurretHp(turretDef, tier) : 150;

    const turret: ActiveTurret = {
      definitionId: config.definitionId,
      tier,
      currentClass: config.class,
      slotIndex: config.slotIndex,
      lastAttackTick: 0,
      specialCooldown: 0,
      targetingMode: 'closest_to_fortress',
      currentHp: maxHp,
      maxHp,
    };

    turrets.push(turret);
  }

  return turrets;
}

/**
 * Initialize active skills based on fortress level
 */
export function initializeActiveSkills(
  fortressClass: FortressClass,
  fortressLevel: number
): string[] {
  const classDef = getClassById(fortressClass);
  if (!classDef) return [];

  return classDef.skills
    .filter(skill => skill.unlockedAtFortressLevel <= fortressLevel)
    .map(skill => skill.id);
}
