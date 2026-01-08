// Version
export { SIM_VERSION } from './version.js';

// Analytics
export { analytics, type WaveStats } from './analytics.js';

// RNG
export { Xorshift32 } from './rng.js';

// Fixed-point math
export { FP } from './fixed.js';

// Physics
export {
  Vec2,
  integratePosition,
  applyAcceleration,
  applyFriction,
  clampVelocity,
  clampToField,
  detectCircleCollision,
  resolveCollision,
  applySeparationForce,
  calculateEffectiveSpeed,
  cleanupExpiredModifiers,
  steerTowards,
  steerAway,
  getLaneY,
  getRandomLane,
  HERO_PHYSICS,
  ENEMY_PHYSICS,
  DEFAULT_PHYSICS_CONFIG,
  type Vec2FP,
  type PhysicsBody,
  type PhysicsConfig,
  type CollisionResult,
} from './physics.js';

// Types
export type {
  EnemyType,
  Enemy,
  RelicDef,
  ActiveRelic,
  RelicChoice,
  ModifierSet,
  SimConfig,
  GameState,
  WaveSpawnEntry,
  RunScore,
  // Fortress classes
  FortressClass,
  ProjectileType,
  FortressClassDefinition,
  SkillDefinition,
  SkillEffect,
  // Heroes
  HeroRole,
  HeroState,
  HeroDefinition,
  ActiveHero,
  HeroTier,
  HeroSkillDefinition,
  HeroWeakness,
  MovementModifier,
  // Turrets
  TurretDefinition,
  ActiveTurret,
  TurretSlot,
  TurretTargetingMode,
  // Projectiles
  ActiveProjectile,
  // Pillars
  PillarId,
  PillarDefinition,
  // Infinity Stones
  InfinityStoneType,
  InfinityStoneFragment,
  InfinityGauntletState,
  // Materials
  MaterialType,
  // Status Effects
  StatusEffectType,
  StatusEffect,
  AnalyticsStats,
} from './types.js';

// Data
export {
  ENEMY_ARCHETYPES,
  getEnemyStats,
  getEnemyRewards,
  getWaveComposition,
  type EnemyArchetype,
  type WaveComposition,
} from './data/enemies.js';

export {
  DEFAULT_MODIFIERS,
  RELICS,
  getRelicById,
  getAllRelicIds,
  getAvailableRelics,
} from './data/relics.js';

export {
  TURRET_DEFINITIONS,
  getTurretById,
  calculateTurretStats,
  TURRET_SLOTS,
  type TurretType,
} from './data/turrets.js';

// Fortress Classes
export {
  FORTRESS_CLASSES,
  getClassById,
  getUnlockedSkills as getClassUnlockedSkills,
  getSkillById,
  isClassUnlocked,
  getUnlockableClasses,
  getClassUnlockCost,
} from './data/classes.js';

// Modifiers
export {
  computeModifiers,
  calculateDamage,
  shouldCrit,
  shouldChain,
} from './modifiers.js';

// Events
export {
  validateEvent,
  applyEvent,
  type EventValidation,
} from './events.js';

// Checkpoints
export {
  fnv1a32,
  computeCheckpointHash,
  computeChainHash,
  createCheckpoint,
  verifyCheckpoint,
  computeFinalHash,
} from './checkpoints.js';

// Simulation
export {
  getDefaultConfig,
  createInitialState,
  Simulation,
} from './simulation.js';

// Replay
export {
  replayRun,
  createClientSimulation,
  type ReplayResult,
  type VerifyOptions,
} from './replay.js';

// Unified Progression System
export {
  // XP formula
  getXpForLevel,
  getTotalXpForLevel,
  getLevelFromTotalXp,
  // Progression bonuses
  getProgressionBonuses,
  type ProgressionBonuses,
  // Level info
  getFortressLevelInfo,
  getMaxHeroSlots,
  getMaxTurretSlots,
  getUnlockedSkills,
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  MAX_FORTRESS_LEVEL,
  getFortressTier,
  getFortressTierName,
  getNextTierDescription,
  FORTRESS_TIER_THRESHOLDS,
  // Unlock system (nowy uproszczony system)
  getUnlockedClasses,
  isClassUnlockedAtLevel,
  getClassUnlockLevel,
  getUnlockedTurretTypes,
  isTurretUnlockedAtLevel,
  getTurretUnlockLevel,
  getUnlockedHeroes,
  isHeroUnlockedAtLevel,
  getHeroUnlockLevel,
  // Level rewards
  getRewardsForLevel,
  checkLevelUp,
  type FortressLevelReward,
  type FortressLevel,
  type FortressTier,
} from './data/fortress-progression.js';

// Heroes
export {
  HEROES,
  getHeroById,
  getHeroesByClass,
  getHeroesByRole,
  getHeroesByRarity,
  getStarterHeroes,
  getUnlockableHeroes,
  getHeroUnlockCost,
  getHeroTier,
  calculateHeroStats,
  getXpRequiredForLevel,
  canUpgradeTier,
} from './data/heroes.js';

// Artifacts
export {
  getArtifactById,
  getItemById,
  getArtifactsBySlot,
  getArtifactsByRarity,
  canHeroEquipArtifact,
  getAvailableArtifactsForHero,
  getConsumableItems,
  calculateArtifactCraftCost,
  ARTIFACT_DEFINITIONS,
  ITEM_DEFINITIONS,
  MAX_ITEMS_PER_HERO,
  MAX_ARTIFACTS_PER_HERO,
  // Types
  type ArtifactRarity,
  type ArtifactSlot,
  type ArtifactEffect,
  type ArtifactRequirement,
  type ArtifactDefinition,
  type ItemType,
  type ItemEffect,
  type ItemDefinition,
} from './data/artifacts.js';

// Materials
export {
  getMaterialById,
  getMaterialsByRarity,
  getRecipeById,
  canCraft,
  meetsRecipeRequirements,
  getAvailableRecipes,
  getMaterialSources,
  getMaterialDropChanceForPillar,
  getRarityColor,
  rollMaterialDropFromBoss,
  rollMaterialDropFromWave,
  getBossMaterialDrops,
  MATERIAL_DEFINITIONS,
  CRAFTING_RECIPES,
  RARITY_COLORS,
  type MaterialDefinition,
  type MaterialRarity,
  type MaterialDropSource,
  type CraftingRecipe,
} from './data/materials.js';

// Power Upgrades System
export {
  // Types
  type ItemTier,
  type UpgradableStat,
  type FortressUpgradableStat,
  type HeroUpgradableStat,
  type TurretUpgradableStat,
  type StatUpgrades,
  type FortressUpgrades,
  type HeroUpgrades,
  type TurretUpgrades,
  type ItemTierUpgrade,
  type PlayerPowerData,
  type PowerBreakdown,
  type EntityPower,
  type TotalPowerSummary,
  // Constants
  ITEM_TIERS,
  ITEM_TIER_INDEX,
  // Functions
  getNextItemTier,
  isMaxItemTier,
  createDefaultStatUpgrades,
  createDefaultFortressUpgrades,
  createDefaultPlayerPowerData,
  getHeroUpgrades,
  getTurretUpgrades,
  getItemTier,
  setHeroStatLevel,
  setTurretStatLevel,
  setItemTier,
} from './data/power-upgrades.js';

export {
  // Config types
  type StatUpgradeConfig,
  type ItemTierConfig,
  // Config constants
  FORTRESS_STAT_UPGRADES,
  HERO_STAT_UPGRADES,
  TURRET_STAT_UPGRADES,
  ITEM_TIER_CONFIG,
  POWER_WEIGHTS,
  // Helper functions
  getUpgradeCost,
  getStatMultiplier,
  getStatBonusPercent,
  getFortressStatConfig,
  getHeroStatConfig,
  getTurretStatConfig,
  getItemUpgradeCost,
  getTotalSpentOnStat,
  getAffordableLevels,
} from './data/power-config.js';

export {
  // Power calculator
  calculateFortressPower,
  calculateHeroPower,
  calculateTurretPower,
  calculateItemPower,
  calculateTotalPower,
  calculateQuickTotalPower,
  formatPower,
  getPowerColor,
  type TierMaps,
} from './power/index.js';

// Power Upgrades Application (Simulation Integration)
export {
  applyFortressPowerUpgrades,
  applyAllPowerUpgrades,
  getHeroPowerMultipliers,
  getTurretPowerMultipliers,
  getItemEffectMultiplier,
  getItemTierFromPowerData,
  hasAnyPowerUpgrades,
  calculateTotalUpgradeInvestment,
} from './systems/apply-power-upgrades.js';

// Boss Rush Mode
export {
  // Config & Constants
  BOSS_RUSH_SEQUENCE,
  BOSS_RUSH_CYCLE_LENGTH,
  BOSS_RUSH_MILESTONES,
  DEFAULT_BOSS_RUSH_CONFIG,
  // Functions
  getBossRushBossStats,
  getBossAtIndex,
  getCycleForBossIndex,
  getBossRushBossRewards,
  getAchievedMilestones,
  getNextMilestone,
  createBossRushState,
  recordBossRushDamage,
  processBossKill,
  startIntermission,
  endIntermission,
  generateBossRushSummary,
  // Types
  type BossRushBoss,
  type BossRushConfig,
  type BossRushBossStats,
  type BossRushBossRewards,
  type BossRushMilestoneReward,
  type BossRushState,
  type BossRushSummary,
} from './boss-rush.js';

// AI System (Simplified Role-Based)
export {
  getHeroRole,
  shouldHeroRetreat,
  isFrontliner,
  isSupport,
  selectTarget,
  getSimpleBattlefieldState,
  resetSimpleAI,
  type SimpleBattlefieldState,
} from './simple-ai.js';

// Arena PvP System
export {
  // State
  createArenaState,
  getEnemySide,
  getOwnSide,
  DEFAULT_ARENA_CONFIG,
  // AI
  selectHeroTarget,
  selectTurretTarget,
  selectFortressTarget,
  getHeroMovementDirection,
  // Simulation
  ArenaSimulation,
  runArenaBattle,
  // Types
  type ArenaState,
  type ArenaSide,
  type ArenaFortress,
  type ArenaStats,
  type ArenaConfig,
  type ArenaBuildConfig,
  type ArenaWinReason,
  type ArenaTarget,
  type ArenaTargetType,
  type ArenaResult,
  type ArenaReplayEvent,
} from './arena/index.js';
