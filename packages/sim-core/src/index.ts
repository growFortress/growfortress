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
  // Crystals (ancient artifacts system)
  CrystalType,
  CrystalFragment,
  CrystalMatrixState,
  // Legacy aliases for backwards compatibility
  InfinityStoneType,
  InfinityStoneFragment,
  InfinityGauntletState,
  // Materials
  MaterialType,
  // Status Effects
  StatusEffectType,
  StatusEffect,
  AnalyticsStats,
  // Artifact Visuals
  ArtifactSlotType,
  ArtifactSynergyBonus,
  ArtifactVisualDefinition,
  ArtifactShapeType,
  ArtifactAnimationType,
  ArtifactParticleType,
  // Walls
  Wall,
  WallType,
  // Militia
  Militia,
  MilitiaType,
  MilitiaState,
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
  RELIC_RARITY_CONFIG,
  type ExtendedRelicDef,
  type RelicCategory,
  type RelicRarity,
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
  // Slot purchase system
  type SlotUnlockConfig,
  HERO_SLOT_UNLOCKS,
  TURRET_SLOT_UNLOCKS,
  MAX_HERO_SLOTS,
  MAX_TURRET_SLOTS,
  getNextPurchasableHeroSlot,
  getNextPurchasableTurretSlot,
  getNextHeroSlotInfo,
  getNextTurretSlotInfo,
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
  isPremiumShopHero,
  getHeroTier,
  calculateHeroStats,
  getXpRequiredForLevel,
  canUpgradeTier,
} from './data/heroes.js';

// Artifacts
export {
  // Getters
  getArtifactById,
  getItemById,
  getArtifactsBySlot,
  getArtifactsBySlotType,
  getArtifactsByRarity,
  // Equip system
  canHeroEquipArtifact,
  canEquipToSlot,
  getAvailableArtifactsForHero,
  getAvailableArtifactsForSlot,
  // Hero-specific artifacts
  getHeroSpecificArtifacts,
  isHeroSpecificArtifact,
  // Synergy system
  hasSynergyBonus,
  calculateSynergyMultiplier,
  calculateTotalSynergyMultiplier,
  // Items
  getConsumableItems,
  // Crafting costs
  calculateArtifactCraftCost,
  // Crafting 2.0 - Upgrade/Fuse/Dismantle
  calculateUpgradeCost,
  calculateLevelStatMultiplier,
  calculateDismantleReturn,
  getFusionResults,
  validateFusion,
  // Constants
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

// Crystals (Ancient Artifacts)
export {
  CRYSTAL_DEFINITIONS,
  CRYSTAL_MATRIX,
  CRYSTAL_COLORS,
  MATRIX_CRYSTAL_ORDER,
  BOSS_CRYSTAL_DROPS,
  FRAGMENTS_PER_CRYSTAL,
  getCrystalById,
  canUseCrystalMatrix,
  calculateFragmentBonus,
  canCraftFullCrystal,
  getCrystalDropLocations,
  getFragmentDropChance,
  calculateCrystalBonuses,
  isBossEnemy,
  rollCrystalDrop,
  getBossIdForEnemy,
  BOSS_ENEMY_TYPES,
  ENEMY_TYPE_TO_BOSS_ID,
  // Legacy aliases
  INFINITY_STONE_DEFINITIONS,
  INFINITY_GAUNTLET,
  STONE_COLORS,
  GAUNTLET_STONE_ORDER,
  BOSS_STONE_DROPS,
  getStoneById,
  canUseInfinityGauntlet,
  canCraftFullStone,
  getStoneDropLocations,
  calculateStoneBonuses,
  rollStoneDrop,
  type CrystalDefinition,
  type CrystalEffect,
  type CrystalMatrixDefinition,
  type CrystalFragmentState,
} from './data/crystals.js';

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
  calculateArtifactPower,
  calculateArenaPower,
  calculateTotalPower,
  calculateQuickTotalPower,
  formatPower,
  getPowerColor,
  type TierMaps,
  type ArenaHeroConfig,
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

// Boss Rush Simulation (Server-side verification)
export {
  BossRushSimulation,
  replayBossRush,
  getDefaultBossRushConfig,
  createBossRushGameState,
  computeBossRushCheckpointHash,
  computeBossRushFinalHash,
  createBossRushCheckpoint,
  type BossRushGameState,
  type BossRushSimConfig,
  type BossRushReplayResult,
  type BossRushVerifyOptions,
  type BossRushTurretConfig,
} from './boss-rush-simulation.js';

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
  // Guild Arena 5v5
  runGuildArena,
  type GuildBattleHero,
  type GuildArenaResult,
  type GuildArenaKeyMoment,
  type GuildArenaKillLog,
  type GuildArenaMvp,
} from './arena/index.js';

// Leaderboard Exclusive Items
export {
  WAVES_EXCLUSIVE_ITEMS,
  HONOR_EXCLUSIVE_ITEMS,
  ALL_EXCLUSIVE_ITEMS,
  WAVES_REWARD_TIERS,
  HONOR_REWARD_TIERS,
  REWARD_TIERS,
  getExclusiveItemById,
  getExclusiveItemsByCategory,
  getExclusiveItemsByRarity,
  getRewardTierForRank,
  type ExclusiveItem,
  type ExclusiveItemType,
  type ExclusiveItemRarity,
  type ExclusiveItemCategory,
  type RewardTier,
} from './data/leaderboard-items.js';

// Pillar Challenge (Deterministic Crystal Acquisition)
export {
  // Constants & Config
  PILLAR_CRYSTAL_REWARDS,
  TIER_CONFIGS,
  PERFORMANCE_BONUSES,
  CHALLENGE_ENTRY_CONFIG,
  TIER_MATERIAL_REWARDS,
  PILLAR_SPECIFIC_MATERIALS,
  TIER_FORTRESS_XP,
  PILLAR_XP_MULTIPLIERS,
  // Functions
  checkPerformanceBonus,
  calculateFragmentRewards,
  calculateMaterialRewards,
  createPillarChallengeState,
  processWaveComplete,
  processHeroDeath,
  finishChallengeSession,
  generateChallengeSummary,
  isTierUnlocked,
  calculateRemainingAttempts,
  isCooldownExpired,
  getCooldownRemaining,
  getCrystalInfoForPillar,
  // Types
  type PillarChallengeTier,
  type PillarCrystalReward,
  type TierConfig,
  type PerformanceBonus,
  type PerfBonusCondition,
  type ChallengeEntryConfig,
  type PillarChallengeState,
  type PillarChallengeSummary,
} from './pillar-challenge.js';

// Pillar Challenge Simulation (Server-side verification)
export {
  PillarChallengeSimulation,
  replayPillarChallenge,
  getDefaultPillarChallengeConfig,
  createPillarChallengeGameState,
  computePillarChallengeCheckpointHash,
  computePillarChallengeFinalHash,
  type PillarChallengeSimConfig,
  type PillarChallengeReplayResult,
  type PillarChallengeVerifyOptions,
  type PillarChallengeCheckpoint,
} from './pillar-challenge-simulation.js';

// Mastery System (Class Skill Trees)
export {
  // Types
  type MasteryNodeType,
  type MasteryNodeId,
  type MasterySynergyAmplifier,
  type MasteryClassPerk,
  type MasteryNodeEffect,
  type MasteryNodeDefinition,
  type MasteryTreeDefinition,
  type ClassMasteryProgress,
  type PlayerMasteryProgress,
  type MasteryPointCondition,
  type MasteryPointSource,
  type MasteryModifiers,
  // Constants
  MASTERY_POINT_SOURCES,
  MASTERY_ECONOMY,
  // Functions
  createDefaultMasteryProgress,
  createEmptyMasteryModifiers,
  getPointsRequiredForTier,
  isTierUnlocked as isMasteryTierUnlocked,
  canUnlockNode,
  calculateRespecReturn,
} from './data/mastery.js';

export {
  // Tree Data
  MASTERY_TREES,
  getMasteryTree,
  getMasteryNodeById,
  getMasteryNodesForClass,
  getMasteryNodesByTier,
  getAllMasteryClasses,
  // Individual trees
  FIRE_MASTERY_TREE,
  LIGHTNING_MASTERY_TREE,
  ICE_MASTERY_TREE,
  NATURAL_MASTERY_TREE,
  TECH_MASTERY_TREE,
  VOID_MASTERY_TREE,
  PLASMA_MASTERY_TREE,
} from './data/mastery-trees/index.js';

export {
  // Mastery calculation
  calculateMasteryModifiers,
  calculateAllClassMasteryModifiers,
  getTotalPointsSpent,
  getClassProgressSummary,
  getAllClassProgressSummaries,
  validateNodeUnlock,
  validateNodeUnlockSync,
  hasMasteryPerk,
  getSynergyMultiplier,
  type ClassProgressSummary,
  type UnlockValidation,
} from './systems/mastery.js';

// Artifact system
export {
  calculateHeroArtifactDamageBonus,
  calculateHeroArtifactHealthBonus,
  applyArtifactBonusesToStats,
} from './systems/artifacts.js';

// Combo System
export {
  popComboTriggers,
} from './systems/projectile.js';

export {
  COMBOS,
  type ComboTrigger,
  type ComboDefinition,
} from './systems/combos.js';

// Colonies (Offline Income System)
export {
  COLONY_DEFINITIONS,
  getColonyById,
  getUnlockedColonies,
  getNextColonyToUnlock,
  calculateColonyGoldPerHour,
  calculateTotalGoldPerHour,
  calculateUpgradeCost as calculateColonyUpgradeCost,
  canUpgradeColony,
  calculatePendingGold,
  getColonyStatus,
  getDefaultColonies,
  getAvailableColoniesToBuild,
  type ColonyDefinition,
  type ActiveColony,
} from './data/colonies.js';

// Wave Modifiers (Content Variety)
export {
  WAVE_MODIFIERS,
  getWaveModifiers,
  getCombinedModifierEffect,
  getCombinedRewardMultiplier,
  getWaveModifierByType,
  type WaveModifierType,
  type WaveModifierEffect,
  type WaveModifier,
} from './data/wave-modifiers.js';

// Element Counter System (Rock-Paper-Scissors)
export {
  ELEMENT_COUNTERS,
  HERO_ELEMENTS,
  PILLAR_ELEMENTS,
  getHeroElement,
  getPillarElement,
  getElementMultiplier,
  getHeroElementEffectiveness,
  getEffectivenessDescription,
  getEffectiveHeroesForPillar,
  getWeakHeroesForPillar,
  type ElementType,
} from './data/elements.js';

// Milestones (Permanent Unlocks)
export {
  MILESTONES,
  getMilestoneById,
  getMilestoneForWave,
  getMilestonesUpToWave,
  getNextMilestone as getNextMilestoneForWave,
  isMilestoneAchieved,
  calculateGoldMultiplierFromMilestones,
  calculateDamageMultiplierFromMilestones,
  calculateHpMultiplierFromMilestones,
  getHeroSlotsFromMilestones,
  getUnlockedFeaturesFromMilestones,
  isFeatureUnlocked,
  type Milestone,
  type MilestoneReward,
} from './data/milestones.js';
