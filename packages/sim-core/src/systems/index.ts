/**
 * Game Systems - Central Export
 *
 * Re-exports all public APIs from individual system modules.
 * This maintains backward compatibility with existing imports from './systems.js'
 */

// ============================================================================
// HERO SYSTEM
// ============================================================================

export { resetTeamCoordinator, updateHeroes } from './hero.js';

// ============================================================================
// TURRET SYSTEM
// ============================================================================

export { updateTurrets } from './turret.js';

// ============================================================================
// PROJECTILE SYSTEM
// ============================================================================

export {
  updateProjectiles,
  updateEnemyStatusEffects,
  createFortressProjectile,
  // Internal exports for other modules
  createHeroProjectile,
  createTurretProjectile,
  applyEffectToEnemy,
} from './projectile.js';

// ============================================================================
// FORTRESS SKILLS
// ============================================================================

export { updateFortressSkills } from './fortress-skills.js';

// ============================================================================
// SYNERGY SYSTEM
// ============================================================================

export { calculateSynergyBonuses, calculatePillarModifiers } from './synergy.js';

// ============================================================================
// DAMAGE SYSTEM
// ============================================================================

export { applyDamageToHero, applyDamageToTurret } from './damage.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

export {
  initializeHeroes,
  initializeTurrets,
  initializeActiveSkills,
} from './initialization.js';

// ============================================================================
// WEAKNESS SYSTEM
// ============================================================================

export {
  calculateWeaknessDamageMultiplier,
  calculateWeaknessStatPenalty,
  hasWeaknessBehavior,
  getWeaknessBehaviorChance,
  shouldApplyConditionalWeakness,
  applyConditionalWeaknessesToDamage,
  checkBehavioralWeaknesses,
} from './weakness.js';

// ============================================================================
// INFINITY STONES
// ============================================================================

export {
  calculateHeroStoneCooldownReduction,
  calculateHeroStoneDamageBonus,
  calculateHeroStoneLifesteal,
} from './infinity-stones.js';

// ============================================================================
// ARTIFACTS
// ============================================================================

export {
  applyItemToHero,
  calculateHeroArtifactDodgeChance,
  calculateHeroArtifactBlockChance,
  hasArtifactPassive,
} from './artifacts.js';

// ============================================================================
// HELPERS
// ============================================================================

export { findClosestEnemy } from './helpers.js';

// ============================================================================
// CONSTANTS (for external use if needed)
// ============================================================================

export {
  FP_BASE,
  HERO_ATTACK_RANGE_BASE,
  HERO_BASE_ATTACK_INTERVAL,
  TURRET_ATTACK_INTERVAL_BASE,
  PROJECTILE_BASE_SPEED,
  HIT_FLASH_TICKS,
  HERO_ARRIVAL_RADIUS,
  HERO_SEPARATION_RADIUS,
  HERO_SEPARATION_FORCE,
  DEFAULT_EFFECT_DURATION,
} from './constants.js';
