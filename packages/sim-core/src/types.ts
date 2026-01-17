/**
 * Game simulation types
 */

// ============================================================================
// FIXED-POINT TYPE
// ============================================================================

/**
 * Fixed-point number type (Q16.16 format)
 * Used for deterministic calculations
 */
export type FP = number;

// ============================================================================
// FORTRESS CLASS SYSTEM
// ============================================================================

export type FortressClass = 'natural' | 'ice' | 'fire' | 'lightning' | 'tech' | 'void' | 'plasma';

export interface ClassColors {
  primary: number;
  secondary: number;
  glow: number;
  projectile: number;
}

export interface ClassPassiveModifiers {
  damageBonus?: number;
  attackSpeedBonus?: number;
  critChance?: number;
  critDamageBonus?: number;
  maxHpBonus?: number;
  hpRegen?: number;
  splashRadiusBonus?: number;
  splashDamagePercent?: number;
  pierceCount?: number;
  chainChance?: number;
  chainCount?: number;
  chainDamagePercent?: number;
  executeThreshold?: number;
  executeBonusDamage?: number;
  cooldownReduction?: number;
  goldBonus?: number;
  dustBonus?: number;
  dropRateBonus?: number;
}

export type SkillTargetType = 'single' | 'area' | 'all' | 'self';

export interface SkillEffect {
  type: 'damage' | 'slow' | 'burn' | 'freeze' | 'poison' | 'stun' | 'buff' | 'shield' | 'heal' | 'summon' | 'percent_current_hp_damage';
  amount?: number;
  percent?: number;
  duration?: number;
  target?: SkillTargetType;
  damagePerTick?: number;
  stacks?: number;
  stat?: keyof ModifierSet;
  unitType?: string;
  count?: number;
  damage?: number; // For burn/poison damage per tick
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  cooldownTicks: number;
  manaCost?: number;
  damage: number;
  radius?: number;
  duration?: number;
  effects: SkillEffect[];
  unlockedAtFortressLevel: number;
}

export type ProjectileType = 'physical' | 'icicle' | 'fireball' | 'bolt' | 'laser' | 'plasma_beam' | 'void_slash';

export interface FortressClassDefinition {
  id: FortressClass;
  name: string;
  description: string;
  colors: ClassColors;
  passiveModifiers: ClassPassiveModifiers;
  skills: SkillDefinition[];
  projectileType: ProjectileType;
}

// ============================================================================
// HERO SYSTEM
// ============================================================================

export type HeroRole = 'tank' | 'dps' | 'support' | 'crowd_control' | 'assassin';
export type HeroState = 'idle' | 'deploying' | 'combat' | 'returning' | 'cooldown' | 'dead' | 'commanded';

export interface HeroWeakness {
  id: string;
  name: string;
  description: string;
  effect: WeaknessEffect;
}

export type WeaknessEffect =
  | { type: 'stat_penalty'; stat: keyof ModifierSet; amount: number; condition?: string }
  | { type: 'damage_vulnerability'; damageClass: FortressClass; multiplier: number }
  | { type: 'behavioral'; behavior: string; chance?: number }
  | { type: 'conditional'; condition: string; effect: string };

export interface HeroSkillDefinition {
  id: string;
  name: string;
  description: string;
  cooldownTicks: number;
  isPassive: boolean;
  isUltimate: boolean;
  unlockedAtLevel: number;
  effects: SkillEffect[];
}

export interface HeroTier {
  tier: 1 | 2 | 3;
  name: string;
  statMultiplier: number;
  skills: HeroSkillDefinition[];
  visualChanges: {
    sizeMultiplier: number;
    glowIntensity: number;
    particleEffects: string[];
    colorShift?: number;
  };
  unlockRequirements: {
    level: number;
    gold: number;
    dust: number;
    material?: string;
  };
}

export interface HeroDefinition {
  id: string;
  name: string;
  class: FortressClass;
  role: HeroRole;
  rarity: 'starter' | 'common' | 'rare' | 'epic' | 'legendary';
  baseStats: {
    hp: number;
    damage: number;
    attackSpeed: number;
    range: number;
    moveSpeed: number;
    deployCooldown: number;
  };
  tiers: [HeroTier, HeroTier, HeroTier];
  weaknesses: HeroWeakness[];
  colors: {
    primary: number;
    secondary: number;
    glow: number;
  };
  shape: 'circle' | 'square' | 'triangle' | 'hexagon' | 'star' | 'diamond';
}

/**
 * Movement modifier for heroes (speed buffs/debuffs)
 */
export interface MovementModifier {
  id: string;
  multiplier: number; // FP format: FP.ONE = 100%, FP.HALF = 50%
  expirationTick: number;
}

export interface ActiveHero {
  definitionId: string;
  tier: 1 | 2 | 3;
  level: number;
  xp: number;
  currentHp: number;
  maxHp: number;

  // Position (fixed-point)
  x: number;
  y: number;

  // Physics (fixed-point) - 2D velocity-based movement
  vx: number;                    // Velocity X
  vy: number;                    // Velocity Y
  radius: number;                // Collision radius
  mass: number;                  // Mass for collision resolution
  movementModifiers: MovementModifier[];  // Speed modifiers

  state: HeroState;
  lastAttackTick: number;
  lastDeployTick: number;
  skillCooldowns: Record<string, number>;
  buffs: ActiveBuff[];
  equippedArtifact?: string;
  equippedItems: string[];
  crystal?: CrystalType;
  /** @deprecated Use crystal */
  infinityStone?: CrystalType;

  // AI targeting (cached for current tick)
  currentTargetId?: number;      // Enemy ID being targeted

  // Command system (player-issued orders)
  commandTarget?: { x: number; y: number };  // Target position (fixed-point)
  isCommanded?: boolean;                      // Whether hero is executing a command
}

export interface ActiveBuff {
  id: string;
  stat: keyof ModifierSet;
  amount: number;
  expirationTick: number;
}

// ============================================================================
// TURRET SYSTEM
// ============================================================================

// Turret targeting modes
export type TurretTargetingMode =
  | 'closest_to_fortress'  // Enemy with lowest X (closest to fortress)
  | 'weakest'              // Enemy with lowest HP
  | 'strongest'            // Enemy with highest HP
  | 'nearest_to_turret';   // Enemy closest to turret by distance

export interface TurretDefinition {
  id: string;
  name: string;
  description: string;
  baseStats: {
    damage: number;
    attackSpeed: number;
    range: number;
  };
  cost: { gold: number; dust: number };
  upgradeCosts: {
    tier2: { gold: number; dust: number };
    tier3: { gold: number; dust: number };
    classChange: { gold: number; dust: number };
  };
  specialAbility?: {
    id: string;
    name: string;
    description: string;
    cooldownTicks: number;
    effects: SkillEffect[];
  };
}

export interface ActiveTurret {
  definitionId: string;
  tier: 1 | 2 | 3;
  currentClass: FortressClass;
  slotIndex: number;
  lastAttackTick: number;
  specialCooldown: number;
  targetingMode: TurretTargetingMode;
  currentHp: number;
  maxHp: number;
}

export interface TurretSlot {
  index: number;
  x: number;
  y: number;
  isUnlocked: boolean;
}

// ============================================================================
// PILLAR SYSTEM (Game Chapters)
// ============================================================================

export type PillarId = 'streets' | 'science' | 'mutants' | 'cosmos' | 'magic' | 'gods';

export interface PillarClassModifier {
  class: FortressClass;
  damageMultiplier: number;
  description: string;
}

export interface PillarDefinition {
  id: PillarId;
  name: string;
  description: string;
  waveRange: { start: number; end: number };
  unlockRequirement: { fortressLevel: number };
  scenery: string;
  enemyTypes: string[];
  classModifiers: PillarClassModifier[];
  specialMechanic?: {
    id: string;
    name: string;
    description: string;
  };
  naturalHeroes: string[];
  bossWaves: number[];
}

// ============================================================================
// CRYSTALS (Ancient artifacts system)
// ============================================================================

// Crystal IDs match the old Infinity Stone IDs for backwards compatibility
// Display names are different (e.g., 'space' displays as "Kryształ Próżni")
export type CrystalType = 'power' | 'space' | 'time' | 'reality' | 'soul' | 'mind';

export interface CrystalDefinition {
  type: CrystalType;
  name: string;
  color: number;
  description: string;
  effects: SkillEffect[];
  dropLocation: PillarId;
  fragmentsRequired: number;
  purchaseCost: { dust: number };
}

export interface CrystalFragment {
  crystalType: CrystalType;
  count: number;
  /** @deprecated Use crystalType */
  stoneType?: CrystalType;
}

export interface CrystalMatrixState {
  isAssembled: boolean;
  heroId?: string;
  crystalsCollected: CrystalType[];
  annihilationCooldown: number;
  annihilationUsedCount: number;

  // Legacy aliases for backwards compatibility
  /** @deprecated Use crystalsCollected */
  stonesCollected?: CrystalType[];
  /** @deprecated Use annihilationCooldown */
  snapCooldown?: number;
  /** @deprecated Use annihilationUsedCount */
  snapUsedCount?: number;
}

// Legacy aliases for backwards compatibility during migration
/** @deprecated Use CrystalType instead */
export type InfinityStoneType = CrystalType;
/** @deprecated Use CrystalDefinition instead */
export type InfinityStoneDefinition = CrystalDefinition;
/** @deprecated Use CrystalFragment instead */
export type InfinityStoneFragment = CrystalFragment;
/** @deprecated Use CrystalMatrixState instead */
export type InfinityGauntletState = CrystalMatrixState;

// NOTE: ArtifactDefinition and ItemDefinition are defined in data/artifacts.ts
// to avoid circular dependencies

// ============================================================================
// ARTIFACT SLOT SYSTEM (3 slots per hero)
// ============================================================================

/** Simplified slot types - 3 per hero */
export type ArtifactSlotType = 'weapon' | 'armor' | 'accessory';

/** Hero's equipped artifacts by slot */
export interface HeroArtifactSlots {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

// ============================================================================
// ARTIFACT SYNERGY SYSTEM
// ============================================================================

/** Synergy bonus when artifact matches hero class */
export interface ArtifactSynergyBonus {
  synergyClasses: FortressClass[];
  bonusMultiplier: number; // 1.15 = +15% effectiveness
  bonusDescription: string;
}

// ============================================================================
// ARTIFACT VISUAL SYSTEM (Procedural)
// ============================================================================

/** Shape types for procedural artifact rendering */
export type ArtifactShapeType =
  | 'hexagon'
  | 'diamond'
  | 'circle'
  | 'star'
  | 'gear'
  | 'crystal'
  | 'blade'
  | 'shield'
  | 'ring';

/** Animation types for artifacts */
export type ArtifactAnimationType = 'pulse' | 'rotate' | 'shimmer' | 'float' | 'static';

/** Particle effect types */
export type ArtifactParticleType =
  | 'sparkles'
  | 'flames'
  | 'frost'
  | 'void'
  | 'lightning'
  | 'plasma'
  | 'none';

/** Complete visual definition for procedural artifact rendering */
export interface ArtifactVisualDefinition {
  shape: ArtifactShapeType;
  primaryColor: number;
  secondaryColor: number;
  glowColor: number;
  accentColor?: number;
  animation: ArtifactAnimationType;
  animationSpeed?: number; // 0.5-2.0, default 1.0
  particles: ArtifactParticleType;
  particleIntensity?: number; // 0.0-1.0, default 0.5
  iconScale?: number; // 0.5-2.0, default 1.0
  hasOuterRing?: boolean; // Legendary effect
  hasInnerGlow?: boolean; // Epic+ effect
}

// ============================================================================
// MATERIALS & CRAFTING
// ============================================================================

export type MaterialType = 'adamantium' | 'vibranium' | 'uru' | 'darkforce' | 'cosmic_dust' |
                           'mutant_dna' | 'pym_particles' | 'extremis' | 'super_soldier_serum' |
                           // Boss Rush materials
                           'boss_essence_streets' | 'boss_essence_science' | 'boss_essence_mutants' |
                           'boss_essence_cosmos' | 'boss_essence_magic' | 'boss_essence_gods' |
                           'boss_essence_random' | 'boss_trophy_gold' | 'boss_trophy_platinum';

export interface MaterialDefinition {
  type: MaterialType;
  name: string;
  description: string;
  rarity: 'common' | 'rare' | 'very_rare';
  dropSource: PillarId;
  dropChance: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  materials: { type: MaterialType; count: number }[];
  goldCost: number;
  result: {
    type: 'artifact' | 'item' | 'enhancement';
    id: string;
  };
}

export interface PlayerMaterials {
  [key: string]: number;
}

// ============================================================================
// FORTRESS PROGRESSION
// ============================================================================

export interface FortressLevel {
  level: number;
  xpRequired: number;
  rewards: {
    hpBonus?: number;
    damageBonus?: number;
    heroSlots?: number;
    turretSlots?: number;
    skillUnlock?: number;
    pillarUnlock?: PillarId;
  };
}

export interface FortressProgression {
  currentLevel: number;
  currentXp: number;
  totalXp: number;
  unlockedSkills: number[];
  unlockedPillars: PillarId[];
  heroSlots: number;
  turretSlots: number;
}

// ============================================================================
// ENEMY TYPES (existing + extended)
// ============================================================================

export type EnemyType = 'runner' | 'bruiser' | 'leech' |
                        // Pillar-specific enemies
                        'gangster' | 'thug' | 'mafia_boss' |  // Streets
                        'robot' | 'drone' | 'ai_core' |       // Science
                        'sentinel' | 'mutant_hunter' |         // Mutants
                        'kree_soldier' | 'skrull' | 'cosmic_beast' |  // Cosmos
                        'demon' | 'sorcerer' | 'dimensional_being' |  // Magic
                        'einherjar' | 'titan' | 'god';                 // Gods

// Status effect types that can be applied to enemies
export type StatusEffectType = 'slow' | 'freeze' | 'burn' | 'poison' | 'stun';

// Active status effect on an enemy
export interface StatusEffect {
  type: StatusEffectType;
  remainingTicks: number;      // Ticks remaining
  strength: number;            // Effect strength (e.g., slow percentage, damage per tick)
  appliedTick: number;         // Tick when effect was applied
}

export interface Enemy {
  id: number;
  type: EnemyType;
  hp: number;
  maxHp: number;

  // Position (fixed-point)
  x: number;
  y: number;        // Y position for 2D movement (lane-based)

  // Physics (fixed-point) - 2D velocity-based movement
  vx: number;       // Velocity X
  vy: number;       // Velocity Y
  speed: number;    // Base movement speed (units per tick)
  radius: number;   // Collision radius
  mass: number;     // Mass for collision resolution

  damage: number;
  isElite: boolean;
  hitFlashTicks: number;
  lastAttackTick: number;  // Last tick when enemy attacked fortress

  // Lane information
  lane: number;     // Which lane enemy is in (0, 1, 2)

  // Active status effects
  activeEffects: StatusEffect[];
}

// Relic system
export interface RelicDef {
  id: string;
  name: string;
  description: string;
  modifiers: Partial<ModifierSet>;
  isBuildDefining: boolean;
}

export interface ActiveRelic {
  id: string;
  acquiredWave: number;
  acquiredTick: number;
}

export interface RelicChoice {
  options: string[];
  wave: number;
  offeredTick: number;
}

// Modifier system - additive bonus system for balanced scaling
// Formula: base × (1 + sum of bonuses)
export interface ModifierSet {
  // === ADDITIVE BONUSES ===
  // These stack additively: 3x +50% = +150%, not 3.375x
  damageBonus: number;           // Sum of +X% damage (0.5 = +50%)
  attackSpeedBonus: number;      // Sum of +X% attack speed
  cooldownReduction: number;     // Sum of CDR (capped at 0.75)
  goldBonus: number;             // Sum of +X% gold
  dustBonus: number;             // Sum of +X% dust
  maxHpBonus: number;            // Sum of +X% max HP
  eliteDamageBonus: number;      // Sum of +X% vs elites

  // === STACKABLE SECONDARY STATS ===
  // All stack additively for consistent value
  splashRadiusBonus: number;     // Additive bonus to splash radius
  splashDamagePercent: number;   // Sum of splash damage % (capped at 1.0)
  pierceCount: number;           // Total pierce count (additive)
  chainChance: number;           // Chain chance (capped at 1.0)
  chainCount: number;            // Chain targets (additive)
  chainDamagePercent: number;    // Sum of chain damage % (capped at 1.0)
  executeThreshold: number;      // HP% threshold for execute (max wins)
  executeBonusDamage: number;    // Additive bonus damage on execute
  critChance: number;            // Crit chance with diminishing returns (capped at 0.75)
  critDamageBonus: number;       // Additive crit damage bonus (0.5 = 150% total)

  // === DEFENSE ===
  hpRegen: number;               // Flat HP regen per interval
  incomingDamageReduction: number; // Damage reduction (negative = more damage)
  lifesteal: number;             // % of damage dealt healed (0.08 = 8%)
  reflectDamage: number;         // % of incoming damage reflected (0.10 = 10%)

  // === PHYSICS-BASED DEFENSE ===
  massBonus: number;             // +X% mass (harder to push)
  knockbackResistance: number;   // Knockback reduction (capped at 0.9)
  ccResistance: number;          // Crowd control resistance (capped at 0.9)

  // === LUCK (META-REWARDS, NOT COMBAT) ===
  dropRateBonus: number;         // +X% drop rates
  relicQualityBonus: number;     // +X% chance for higher rarity
  goldFindBonus: number;         // Additional gold bonus from luck

  // === CONDITIONAL ===
  waveDamageBonus: number;       // Bonus damage per wave cleared
  lowHpDamageBonus: number;      // Bonus when fortress HP low
  lowHpThreshold: number;        // HP% threshold for low HP bonus
}



// Simulation configuration
export interface SimConfig {
  tickHz: number;

  segmentSize: number;            // Waves per segment for verification (default: 5)
  startingWave: number;           // Wave to start from (for endless resume)
  fortressBaseHp: number;
  fortressBaseDamage: number;
  fortressAttackInterval: number;   // Ticks between attacks
  skillCooldownTicks: number;
  skillDamage: number;
  skillRadius: number;              // Fixed-point
  waveIntervalTicks: number;        // Ticks between waves
  choiceDelayTicks: number;         // Ticks after wave before choice appears
  relicsPerChoice: number;
  fieldWidth: number;               // Fixed-point
  fieldHeight: number;              // Fixed-point
  fortressX: number;                // Fixed-point
  enemySpawnX: number;              // Fixed-point
  enemyAttackRange: number;         // Fixed-point - distance from fortress where enemies stop
  enemyAttackInterval: number;      // Ticks between enemy attacks
  availableRelics: string[];

  // Unified progression system
  commanderLevel: number;           // Player's persisted commander level
  progressionDamageBonus: number;   // Damage multiplier from progression
  progressionGoldBonus: number;     // Gold multiplier from progression
  startingGold: number;             // Starting gold (includes progression bonus)

  // NEW: Class system
  fortressClass: FortressClass;     // Selected fortress class

  // NEW: Heroes configuration
  startingHeroes: string[];         // Hero IDs to start with
  maxHeroSlots: number;             // Max heroes that can be deployed

  // NEW: Turrets configuration
  startingTurrets: Array<{ definitionId: string; slotIndex: number; class: FortressClass }>;
  turretSlots: TurretSlot[];        // Available turret slots

  // NEW: Pillar/Chapter system
  currentPillar: PillarId;          // Current game pillar/chapter

  // NEW: Player's already-owned artifacts (for duplicate detection)
  playerOwnedArtifacts?: string[];

  // NEW: Equipped artifacts (heroId -> artifactId mapping)
  equippedArtifacts?: Record<string, string>;

  // NEW: Power upgrades data (permanent stat bonuses)
  powerData?: {
    fortressUpgrades: {
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    };
    heroUpgrades: Array<{
      heroId: string;
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    }>;
    turretUpgrades: Array<{
      turretType: string;
      statUpgrades: {
        hp: number;
        damage: number;
        attackSpeed: number;
        range: number;
        critChance: number;
        critMultiplier: number;
        armor: number;
        dodge: number;
      };
    }>;
    itemTiers: Array<{
      itemId: string;
      tier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    }>;
    // Hero tier progression (1-3)
    heroTiers: Record<string, number>;
    // Turret tier progression (1-3)
    turretTiers: Record<string, number>;
  };

  // Guild stat boost (0-0.20 = 0-20% HP/damage bonus for fortress and heroes)
  guildStatBoost?: number;
}

// Main game state
export interface GameState {
  // Core state
  tick: number;
  wave: number;
  ended: boolean;
  won: boolean;

  // Segment tracking (for endless mode)
  segmentStartWave: number;       // First wave of current segment
  segmentGoldEarned: number;      // Gold earned in this segment
  segmentDustEarned: number;      // Dust earned in this segment
  segmentXpEarned: number;        // XP earned in this segment
  segmentMaterialsEarned: Record<string, number>;  // Materials earned in this segment

  // RNG state for checkpointing
  rngState: number;

  // Fortress
  fortressHp: number;
  fortressMaxHp: number;
  fortressLastAttackTick: number;
  fortressClass: FortressClass;   // Selected fortress class
  commanderLevel: number;         // Player's commander level (persisted, for unlocks)
  sessionXpEarned: number;        // Total XP earned in this session (will be added to progression)
  xpAtSessionStart: number;       // XP threshold at initial commander level (for progress calculation)

  // Enemies
  enemies: Enemy[];
  nextEnemyId: number;

  // Economy (during run)
  gold: number;
  dust: number;

  // Relics
  relics: ActiveRelic[];

  // Skill
  skillCooldown: number;      // Remaining cooldown ticks
  lastSkillTick: number;
  activeSkills: string[];     // NEW: Unlocked skill IDs for current class
  skillCooldowns: Record<string, number>;  // NEW: Cooldowns for each skill

  // Choice system
  inChoice: boolean;
  pendingChoice: RelicChoice | null;
  pendingChoiceTick: number;

  // Wave spawning
  waveSpawnQueue: WaveSpawnEntry[];
  waveTotalEnemies: number;        // Total enemies to spawn in current wave
  waveSpawnedEnemies: number;      // Enemies already spawned
  lastSpawnTick: number;
  waveComplete: boolean;

  // Stats (for scoring)
  kills: number;
  wavesCleared: number;
  eliteKills: number;
  goldEarned: number;
  dustEarned: number;

  // Computed modifiers (cached, recomputed on relic change)
  modifiers: ModifierSet;

  // NEW: Current pillar/chapter
  currentPillar: PillarId;
  pillarModifiers: Partial<ModifierSet>;  // Class modifiers from current pillar

  // NEW: Heroes system
  heroes: ActiveHero[];
  nextHeroId: number;
  heroSlots: number;              // Currently unlocked hero slots

  // NEW: Turrets system
  turrets: ActiveTurret[];
  turretSlots: TurretSlot[];

  // NEW: Projectiles in flight
  projectiles: ActiveProjectile[];
  nextProjectileId: number;

  // Crystal system (ancient artifacts)
  crystalFragments: CrystalFragment[];
  collectedCrystals: CrystalType[];
  matrixState: CrystalMatrixState | null;

  // Legacy aliases for backwards compatibility during migration
  /** @deprecated Use crystalFragments */
  infinityStoneFragments: CrystalFragment[];
  /** @deprecated Use collectedCrystals */
  collectedStones: CrystalType[];
  /** @deprecated Use matrixState */
  gauntletState: CrystalMatrixState | null;

  // NEW: Materials inventory (during run)
  materials: PlayerMaterials;

  // NEW: Synergy bonuses (cached, recomputed on hero/turret change)
  synergyModifiers: Partial<ModifierSet>;

  // NEW: Analytics
  stats: AnalyticsStats; // Current run stats

  // Endless mode: Retry system
  deathWave?: number;     // Wave where player died (for retry)
  retryCount: number;     // Number of retries on current wave

  // NEW: Artifact drops
  artifactsEarnedThisRun: string[];           // Artifact IDs earned during this run
  segmentArtifactsEarned: string[];           // Artifacts earned in current segment
  pendingArtifactDrops: PendingArtifactDrop[]; // Drops waiting to be processed/shown
}

// NEW: Pending artifact drop (for UI notification)
export interface PendingArtifactDrop {
  artifactId: string;
  isDuplicate: boolean;
  dustValue: number;
  dropTick: number;
  source: 'boss' | 'wave';
}

export interface AnalyticsStats {
  totalDamageDealt: number;
  enemiesKilledByHero: number;
  enemiesKilledByTurret: number;
  enemiesKilledByFortress: number;
}

// NEW: Projectile in flight
export interface ActiveProjectile {
  id: number;
  type: ProjectileType;
  sourceType: 'fortress' | 'hero' | 'turret';
  sourceId: number | string;
  targetEnemyId: number;
  x: number;              // Current position (fixed-point)
  y: number;
  startX: number;         // Starting position
  startY: number;
  targetX: number;        // Target position (enemy position at fire time)
  targetY: number;
  speed: number;          // Units per tick
  damage: number;
  effects: SkillEffect[]; // Effects to apply on hit
  spawnTick: number;
  class: FortressClass;   // For visual styling
}

// Wave spawn configuration
export interface WaveSpawnEntry {
  type: EnemyType;
  isElite: boolean;
  spawnTick: number;
}

// Score calculation
export interface RunScore {
  wavesCleared: number;
  kills: number;
  eliteKills: number;
  timeSurvived: number;
  goldEarned: number;
  dustEarned: number;
  relicsCollected: string[];
  finalScore: number;
}
