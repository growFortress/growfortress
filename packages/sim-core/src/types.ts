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

export type FortressClass = 'natural' | 'ice' | 'fire' | 'lightning' | 'tech';

export interface ClassColors {
  primary: number;
  secondary: number;
  glow: number;
  projectile: number;
}

export interface ClassPassiveModifiers {
  damageMultiplier?: number;
  attackSpeedMultiplier?: number;
  critChance?: number;
  critDamage?: number;
  maxHpMultiplier?: number;
  hpRegen?: number;
  splashRadius?: number;
  splashDamage?: number;
  pierceCount?: number;
  chainChance?: number;
  chainCount?: number;
  chainDamage?: number;
  executeThreshold?: number;
  executeDamage?: number;
  cooldownMultiplier?: number;
  goldMultiplier?: number;
  dustMultiplier?: number;
  luckMultiplier?: number;
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

export type ProjectileType = 'physical' | 'icicle' | 'fireball' | 'bolt' | 'laser';

export interface FortressClassDefinition {
  id: FortressClass;
  name: string;
  description: string;
  colors: ClassColors;
  passiveModifiers: ClassPassiveModifiers;
  skills: SkillDefinition[];
  projectileType: ProjectileType;
  unlockCost: { gold: number; dust: number };
}

// ============================================================================
// HERO SYSTEM
// ============================================================================

export type HeroRole = 'tank' | 'dps' | 'support' | 'crowd_control';
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
  marvelInspiration: string;
  class: FortressClass;
  role: HeroRole;
  rarity: 'starter' | 'common' | 'rare' | 'epic';
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
  infinityStone?: InfinityStoneType;

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
// INFINITY STONES
// ============================================================================

export type InfinityStoneType = 'power' | 'space' | 'time' | 'reality' | 'soul' | 'mind';

export interface InfinityStoneDefinition {
  type: InfinityStoneType;
  name: string;
  color: number;
  description: string;
  effects: SkillEffect[];
  dropLocation: PillarId;
  fragmentsRequired: number;
  purchaseCost: { dust: number };
}

export interface InfinityStoneFragment {
  stoneType: InfinityStoneType;
  count: number;
}

export interface InfinityGauntletState {
  isAssembled: boolean;
  heroId?: string;
  stonesCollected: InfinityStoneType[];
  snapCooldown: number;
  snapUsedCount: number;
}

// NOTE: ArtifactDefinition and ItemDefinition are defined in data/artifacts.ts
// to avoid circular dependencies

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

// Modifier system - all values are multipliers or flat bonuses
export interface ModifierSet {
  // Damage modifiers
  damageMultiplier: number;      // Base damage multiplier (1.0 = 100%)
  splashRadius: number;          // Fixed-point radius for splash damage
  splashDamage: number;          // Splash damage multiplier (0.5 = 50%)
  pierceCount: number;           // Number of enemies to pierce
  chainChance: number;           // Chance to chain (0-1)
  chainCount: number;            // Number of chain targets
  chainDamage: number;           // Chain damage multiplier
  executeThreshold: number;      // HP% threshold for execute
  executeDamage: number;         // Execute damage multiplier
  critChance: number;            // Crit chance (0-1)
  critDamage: number;            // Crit damage multiplier

  // Economy modifiers
  goldMultiplier: number;        // Gold earned multiplier
  dustMultiplier: number;        // Dust earned multiplier

  // Defense modifiers
  maxHpMultiplier: number;       // Fortress max HP multiplier
  hpRegen: number;               // HP regenerated per 5 seconds

  // Skill modifiers
  cooldownMultiplier: number;    // Skill cooldown multiplier (lower = faster)
  attackSpeedMultiplier: number; // Attack speed multiplier

  // Conditional modifiers
  eliteDamageMultiplier: number; // Extra damage vs elites
  waveDamageBonus: number;       // Extra damage per wave cleared
  lowHpDamageMultiplier: number; // Damage multiplier when fortress low HP
  lowHpThreshold: number;        // HP% threshold for low HP bonus

  // Luck
  luckMultiplier: number;        // Multiplier for all luck-based effects
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

  // NEW: Infinity Stones
  infinityStoneFragments: InfinityStoneFragment[];
  collectedStones: InfinityStoneType[];
  gauntletState: InfinityGauntletState | null;

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
