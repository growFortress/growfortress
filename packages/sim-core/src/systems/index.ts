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

export {
  updateTurrets,
  activateTurretOvercharge,
  setTurretTargetingMode,
} from './turret.js';

// ============================================================================
// PROJECTILE SYSTEM
// ============================================================================

export {
  updateProjectiles,
  updateEnemyStatusEffects,
  createFortressProjectile,
  popComboTriggers,
  // Internal exports for other modules
  createHeroProjectile,
  createTurretProjectile,
  applyEffectToEnemy,
} from './projectile.js';

// ============================================================================
// COMBO SYSTEM
// ============================================================================

export {
  trackDamageHit,
  getArmorBreakMultiplier,
  cleanupExpiredDamageHits,
  COMBOS,
  type ComboTrigger,
  type ComboDefinition,
} from './combos.js';

// ============================================================================
// FORTRESS SKILLS
// ============================================================================

export { updateFortressSkills, activateTargetedSkill } from './fortress-skills.js';

// ============================================================================
// FORTRESS AURA SYSTEM
// ============================================================================

export {
  updateFortressAuras,
  getHeroAuraEffects,
  getTurretAuraEffects,
  getHeroAuraDamageBonus,
  getTurretAuraDamageBonus,
  getAuraAttackSpeedBonus,
  getAllAuraEffects,
  invalidateAuraCache,
  type EntityAuraEffects,
  type AuraEffect,
} from './fortress-auras.js';

// ============================================================================
// SYNERGY SYSTEM
// ============================================================================

export {
  calculateSynergyBonuses,
  calculatePillarModifiers,
  calculateTurretAdjacencyBonuses,
  getTurretSynergyBonus,
  getHeroSynergies,
  getActiveSynergiesForHeroes,
  HERO_PAIR_SYNERGIES,
  HERO_TRIO_SYNERGIES,
  type TurretSynergyBonus,
  type HeroPairSynergyDef,
  type HeroTrioSynergyDef,
} from './synergy.js';

// ============================================================================
// DAMAGE SYSTEM
// ============================================================================

export { applyDamageToHero, applyDamageToTurret, type HeroDamageResult } from './damage.js';

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
  calculateArtifactLifesteal,
  getArtifactReflectDamage,
  getArtifactOnHitEffect,
  hasArtifactPassive,
} from './artifacts.js';

// ============================================================================
// HELPERS
// ============================================================================

export { findClosestEnemy } from './helpers.js';

// ============================================================================
// WALL SYSTEM
// ============================================================================

export {
  placeWall,
  removeWall,
  updateWalls,
  checkEnemyWallCollision,
  getCollidingWall,
  getWallsInArea,
  isValidWallPosition,
} from './walls.js';

// ============================================================================
// MILITIA SYSTEM
// ============================================================================

export {
  spawnMilitia,
  spawnMilitiaSquad,
  updateMilitia,
  applyDamageToMilitia,
  getMilitiaById,
  getMilitiaByType,
  countActiveMilitia,
} from './militia.js';

// ============================================================================
// ENEMY ABILITIES SYSTEM
// ============================================================================

export {
  updateEnemyAbilities,
  isEnemyShielded,
  getShieldDamageReduction,
  getSapperDamageMultiplier,
  isSpecialEnemy,
  SPECIAL_ENEMY_TYPES,
} from './enemy-abilities.js';

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
  // Fortress attack balance constants
  MIN_FORTRESS_ATTACK_INTERVAL,
  MAX_FORTRESS_ATTACK_SPEED,
  FORTRESS_BASE_DAMAGE,
  FORTRESS_BASE_ATTACK_INTERVAL,
  PIERCE_DAMAGE_FALLOFF,
  PROJECTILE_CLASS_SPEED,
  FORTRESS_CLASS_DAMAGE,
  FORTRESS_CLASS_PIERCE,
  // Projectile physics constants
  PROJECTILE_CLASS_TRAJECTORY,
  ARC_GRAVITY,
  ARC_LAUNCH_ANGLE,
  PROJECTILE_CLASS_HOMING,
  HOMING_MAX_TURN_RATE,
  PROJECTILE_CLASS_HIT_RADIUS,
  PROJECTILE_BASE_HIT_RADIUS,
} from './constants.js';
