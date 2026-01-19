import type { GameEvent, Checkpoint } from '@arcade/protocol';
import { Xorshift32 } from './rng.js';
import { FP } from './fixed.js';
import {
  GameState,
  SimConfig,
  Enemy,
  WaveSpawnEntry,
  FortressClass,
  TurretSlot,
} from './types.js';
import {
  ENEMY_PHYSICS,
  getLaneY,
  getRandomLane,
  integratePosition,
  applyFriction,
  clampVelocity,
  DEFAULT_PHYSICS_CONFIG,
} from './physics.js';
import {
  DEFAULT_MODIFIERS,
  getAvailableRelics,
  RELICS,
  getRelicChoicesV2,
  detectBuildType,
  type ExtendedRelicSelectionContext,
} from './data/relics.js';
import { getEnemyStats, getEnemyRewards, getWaveComposition } from './data/enemies.js';
import { calculateDamage, shouldCrit, shouldChain } from './modifiers.js';
import { applyEvent } from './events.js';
import { createCheckpoint, computeFinalHash } from './checkpoints.js';
import {
  updateHeroes,
  updateTurrets,
  updateProjectiles,
  updateFortressSkills,
  activateTargetedSkill,
  calculateSynergyBonuses,
  calculatePillarModifiers,
  initializeHeroes,
  initializeTurrets,
  initializeActiveSkills,
  createFortressProjectile,
  updateEnemyStatusEffects,
  applyDamageToHero,
  applyDamageToTurret,
  // New systems
  updateWalls,
  updateMilitia,
  updateEnemyAbilities,
  updateFortressAuras,
} from './systems.js';
import { TURRET_SLOTS } from './data/turrets.js';
import { getPillarForWave } from './data/pillars.js';
import { analytics } from './analytics.js';
import { applyFortressPowerUpgrades } from './systems/apply-power-upgrades.js';
import {
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  getMaxHeroSlots,
  getMaxTurretSlots,
  calculateEnemyKillXp,
  calculateWaveCompleteXp,
  getXpForLevel,
  getTotalXpForLevel,
} from './data/fortress-progression.js';
import {
  isBossEnemy,
  getBossIdForEnemy,
  rollStoneDrop,
  FRAGMENTS_PER_STONE,
  CRYSTAL_MATRIX,
} from './data/crystals.js';
import {
  rollMaterialDropFromBoss,
  rollMaterialDropFromWave,
} from './data/materials.js';
import {
  rollArtifactDropFromBoss,
  rollArtifactDropFromWave,
} from './data/artifacts.js';
import type { CrystalType, CrystalMatrixState, MaterialType } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Leech enemy heals 20% of max HP per attack */
const LEECH_HEAL_PERCENT = 0.2;

/** Ticks between HP regeneration (5 seconds at 30Hz) */
const REGEN_INTERVAL_TICKS = 150;

/** Hit flash duration in ticks */
const HIT_FLASH_TICKS = 3;

/** Turret collision radius for melee attack detection (fixed-point) */
const TURRET_COLLISION_RADIUS = FP.fromFloat(1.0);

/** Points per second survived for scoring */
const SCORE_POINTS_PER_SECOND = 1;

/** Ticks per second for score calculation */
const TICKS_PER_SECOND = 30;

/** Speed bonus cutoff time (2 minutes in ticks at 30Hz) */
const SPEED_BONUS_CUTOFF_TICKS = 3600;

/** Speed bonus multiplier per tick under cutoff */
const SPEED_BONUS_MULTIPLIER = 2;


/**
 * Default turret slots configuration
 */
function getDefaultTurretSlots(): TurretSlot[] {
  return TURRET_SLOTS.map((slot) => ({
    index: slot.id,
    x: FP.fromFloat(2 + slot.offsetX),
    y: FP.fromFloat(7 + slot.offsetY),
    isUnlocked: slot.id <= 6, // First 6 slots unlocked by default
  }));
}

/**
 * Default simulation configuration
 */
export function getDefaultConfig(availableRelics: string[] = RELICS.map(r => r.id)): SimConfig {
  return {
    tickHz: 30,
    segmentSize: 5,             // 5 waves per segment for verification
    startingWave: 0,            // Resume point for endless
    fortressBaseHp: 200,
    fortressBaseDamage: 10,
    fortressAttackInterval: 15, // 0.5 seconds at 30Hz
    skillCooldownTicks: 300,    // 10 seconds
    skillDamage: 50,
    skillRadius: FP.fromInt(8),
    waveIntervalTicks: 90,      // 3 seconds between waves
    choiceDelayTicks: 30,       // 1 second after wave before choice
    relicsPerChoice: 3,
    fieldWidth: FP.fromInt(40),
    fieldHeight: FP.fromInt(15),
    fortressX: FP.fromInt(2),
    enemySpawnX: FP.fromInt(38),
    enemyAttackRange: FP.fromInt(4),  // Enemies stop 4 units from fortress
    enemyAttackInterval: 30,          // 1 second between enemy attacks at 30Hz
    availableRelics,

    // Unified progression system
    commanderLevel: 1,
    progressionDamageBonus: 1.0,
    progressionGoldBonus: 1.0,
    startingGold: 0,

    // Fortress class system
    fortressClass: 'natural' as FortressClass,

    // Heroes configuration
    startingHeroes: [], // Populated from player's unlocked heroes
    maxHeroSlots: 4,

    // Turrets configuration
    startingTurrets: [], // Populated from player's unlocked turrets
    turretSlots: getDefaultTurretSlots(),

    // Pillar/Chapter system
    currentPillar: 'streets',
  };
}

/**
 * Create initial game state
 */
export function createInitialState(seed: number, config: SimConfig): GameState {
  const rng = new Xorshift32(seed);

  // Initialize base modifiers and apply power upgrades
  let baseModifiers = { ...DEFAULT_MODIFIERS };
  if (config.powerData?.fortressUpgrades?.statUpgrades) {
    baseModifiers = applyFortressPowerUpgrades(
      baseModifiers,
      config.powerData.fortressUpgrades.statUpgrades
    );
  }

  // Apply commander level HP bonus (fixed-point: 16384 = 1.0)
  const hpBonus = calculateTotalHpBonus(config.commanderLevel);
  // Apply power upgrade HP bonus (additive: 0.15 = 15%)
  const powerHpMultiplier = 1 + baseModifiers.maxHpBonus;
  // Apply guild stat boost (0-0.20 = 0-20%)
  const guildBoost = 1 + (config.guildStatBoost ?? 0);
  const maxHp = Math.floor((config.fortressBaseHp * hpBonus * powerHpMultiplier * guildBoost) / 16384);

  // Initialize heroes with max slots based on commander level
  const maxHeroSlots = getMaxHeroSlots(config.commanderLevel);
  // Convert powerData to PlayerPowerData format for hero initialization
  const powerDataForHeroes = config.powerData ? {
    fortressUpgrades: config.powerData.fortressUpgrades,
    heroUpgrades: config.powerData.heroUpgrades,
    turretUpgrades: config.powerData.turretUpgrades,
    itemTiers: config.powerData.itemTiers,
  } : undefined;
  // Get hero and turret tiers from power data
  const heroTiers = config.powerData?.heroTiers || {};
  const turretTiers = config.powerData?.turretTiers || {};
  const heroes = initializeHeroes(
    config.startingHeroes || [],
    config.fortressX,
    powerDataForHeroes,
    heroTiers,
    config.equippedArtifacts,
    config.guildStatBoost
  );

  // Initialize turrets with max slots based on commander level
  const maxTurretSlots = getMaxTurretSlots(config.commanderLevel);
  // Apply turret tiers to starting turrets config
  const turretConfigsWithTiers = (config.startingTurrets || []).map(t => ({
    ...t,
    tier: (turretTiers[t.definitionId] || 1) as 1 | 2 | 3,
  }));
  const turrets = initializeTurrets(turretConfigsWithTiers, config.guildStatBoost);

  // Initialize active skills based on commander level
  const activeSkills = initializeActiveSkills(config.fortressClass, config.commanderLevel);

  // Initialize skill cooldowns
  const skillCooldowns: Record<string, number> = {};
  for (const skillId of activeSkills) {
    skillCooldowns[skillId] = 0;
  }

  return {
    tick: 0,
    wave: config.startingWave,
    ended: false,
    won: false,
    segmentStartWave: config.startingWave,
    segmentGoldEarned: 0,
    segmentDustEarned: 0,
    segmentXpEarned: 0,
    segmentMaterialsEarned: {},
    rngState: rng.getState(),
    fortressHp: maxHp,
    fortressMaxHp: maxHp,
    fortressLastAttackTick: 0,
    fortressClass: config.fortressClass,
    commanderLevel: config.commanderLevel,
    sessionXpEarned: 0,
    xpAtSessionStart: getTotalXpForLevel(config.commanderLevel),
    enemies: [],
    nextEnemyId: 1,
    gold: config.startingGold,
    dust: 0,
    relics: [],
    skillCooldown: 0,
    lastSkillTick: -config.skillCooldownTicks, // Start with skill ready
    activeSkills,
    skillCooldowns,
    inChoice: false,
    pendingChoice: null,
    pendingChoiceTick: 0,
    waveSpawnQueue: [],
    waveTotalEnemies: 0,
    waveSpawnedEnemies: 0,
    lastSpawnTick: 0,
    waveComplete: true, // Ready to start wave 1
    kills: 0,
    wavesCleared: 0,
    eliteKills: 0,
    goldEarned: 0,
    dustEarned: 0,
    modifiers: baseModifiers,

    // NEW: Pillar system
    currentPillar: config.currentPillar,
    pillarModifiers: {},

    // NEW: Heroes system
    heroes,
    nextHeroId: heroes.length + 1,
    heroSlots: maxHeroSlots,

    // NEW: Turrets system
    turrets,
    turretSlots: config.turretSlots.slice(0, maxTurretSlots),

    // NEW: Projectiles
    projectiles: [],
    nextProjectileId: 1,

    // Crystal system (ancient artifacts)
    crystalFragments: [],
    collectedCrystals: [],
    matrixState: null,
    // Legacy aliases
    infinityStoneFragments: [],
    collectedStones: [],
    gauntletState: null,

    // NEW: Materials
    materials: {},

    // NEW: Synergy modifiers
    synergyModifiers: {},

    // NEW: Analytics
    stats: {
      totalDamageDealt: 0,
      enemiesKilledByHero: 0,
      enemiesKilledByTurret: 0,
      enemiesKilledByFortress: 0,
    },

    // Endless mode: Retry system
    retryCount: 0,

    // NEW: Artifact drops
    artifactsEarnedThisRun: [],
    segmentArtifactsEarned: [],
    pendingArtifactDrops: [],

    // Kill streak system
    killStreak: 0,
    lastKillTick: -1000, // Start with no recent kill
    highestKillStreak: 0,

    // Wall system
    walls: [],
    nextWallId: 1,

    // Militia system
    militia: [],
    nextMilitiaId: 1,
  };
}

/**
 * Main Simulation class
 */
export class Simulation {
  state: GameState;
  config: SimConfig;
  private rng: Xorshift32;
  private eventQueue: GameEvent[] = [];
  private eventIndex = 0;
  private checkpoints: Checkpoint[] = [];
  private lastChainHash = 0;
  private checkpointTicks: Set<number> = new Set();
  private initialCommanderLevel: number;
  private xpNeededForInitialLevel: number;

  constructor(seed: number, config: SimConfig) {
    this.config = config;
    this.state = createInitialState(seed, config);
    this.rng = new Xorshift32(seed);

    // Track initial level for in-session level ups
    this.initialCommanderLevel = config.commanderLevel;
    this.xpNeededForInitialLevel = getTotalXpForLevel(config.commanderLevel);

    // Apply progression bonuses to modifiers (convert from multiplier to additive bonus)
    this.state.modifiers.damageBonus += (config.progressionDamageBonus - 1);
    this.state.modifiers.goldBonus += (config.progressionGoldBonus - 1);

    // Apply commander level damage bonus (fixed-point: 16384 = 1.0, convert to additive)
    const commanderDamageBonus = calculateTotalDamageBonus(config.commanderLevel);
    this.state.modifiers.damageBonus += (commanderDamageBonus / 16384) - 1;

    // Apply guild stat boost to damage and attack speed (additive: 0.20 = 20% more)
    if (config.guildStatBoost) {
      this.state.modifiers.damageBonus += config.guildStatBoost;
      this.state.modifiers.attackSpeedBonus += config.guildStatBoost;
    }
  }

  /**
   * Set events to be applied during simulation
   */
  setEvents(events: GameEvent[]): void {
    this.eventQueue = [...events].sort((a, b) => a.tick - b.tick);
    this.eventIndex = 0;
  }

  /**
   * Set ticks at which checkpoints should be created
   */
  setCheckpointTicks(ticks: number[]): void {
    this.checkpointTicks = new Set(ticks);
  }

  /**
   * Set audit ticks (must have checkpoints at these ticks)
   */
  setAuditTicks(ticks: number[]): void {
    // Add audit ticks to checkpoint ticks
    ticks.forEach(t => this.checkpointTicks.add(t));
  }

  /**
   * Advance simulation by one tick
   */
  step(): void {
    if (this.state.ended) return;

    // Sync RNG state
    this.rng.setState(this.state.rngState);

    // Apply any events at this tick
    this.processEvents();

    // Check if we should create a checkpoint
    if (this.checkpointTicks.has(this.state.tick)) {
      const checkpoint = createCheckpoint(this.state, this.lastChainHash);
      this.checkpoints.push(checkpoint);
      this.lastChainHash = checkpoint.chainHash32;
    }

    // Update synergy every tick, pillar modifiers periodically (every 30 ticks)
    this.updateSynergyModifiers();
    if (this.state.tick % 30 === 0) {
      this.updatePillarModifiers();
    }

    // Update game state
    this.updateWaves();
    this.updateEnemies();
    this.updateFortressAttack();
    this.updateRegeneration();

    // NEW: Analytics tick
    analytics.updateTick();

    // NEW: Update heroes system
    updateHeroes(this.state, this.config, this.rng);

    // NEW: Update turrets system
    updateTurrets(this.state, this.config, this.rng);

    // NEW: Update projectiles
    updateProjectiles(this.state, this.config);

    // NEW: Update fortress class skills
    updateFortressSkills(this.state, this.config, this.rng);

    // NEW: Update wall system (enemy-wall collisions, wall damage)
    updateWalls(this.state, this.config);

    // NEW: Update militia system (movement, combat, expiration)
    updateMilitia(this.state, this.config);

    // NEW: Update enemy special abilities (catapult, healer, shielder, etc.)
    updateEnemyAbilities(this.state, this.config, this.rng);

    // NEW: Update fortress auras (buff nearby heroes/turrets)
    updateFortressAuras(this.state, this.config);

    // Check win/lose conditions
    this.checkEndConditions();

    // Store RNG state
    this.state.rngState = this.rng.getState();

    // Advance tick
    this.state.tick++;
  }

  /**
   * Update synergy modifiers
   */
  private updateSynergyModifiers(): void {
    // Calculate previous HP bonus multiplier (additive system)
    const previousMaxHpBonus = this.state.synergyModifiers.maxHpBonus ?? 0;
    const safePreviousMultiplier = 1 + previousMaxHpBonus;
    const baseMaxHp = Math.floor(this.state.fortressMaxHp / safePreviousMultiplier);

    this.state.synergyModifiers = calculateSynergyBonuses(this.state);

    // Apply new HP bonus (additive system)
    const nextMaxHpBonus = this.state.synergyModifiers.maxHpBonus ?? 0;
    const nextMultiplier = 1 + nextMaxHpBonus;
    if (nextMultiplier !== safePreviousMultiplier) {
      const newMaxHp = Math.floor(baseMaxHp * nextMultiplier);
      if (newMaxHp !== this.state.fortressMaxHp) {
        const hpDelta = newMaxHp - this.state.fortressMaxHp;
        this.state.fortressMaxHp = newMaxHp;
        if (hpDelta > 0) {
          this.state.fortressHp = Math.min(this.state.fortressHp + hpDelta, newMaxHp);
        } else if (this.state.fortressHp > newMaxHp) {
          this.state.fortressHp = newMaxHp;
        }
      }
    }
  }

  /**
   * Update pillar modifiers based on current wave
   */
  private updatePillarModifiers(): void {
    this.state.pillarModifiers = calculatePillarModifiers(this.state);
  }

  /**
   * Process events at current tick
   */
  private processEvents(): void {
    while (
      this.eventIndex < this.eventQueue.length &&
      this.eventQueue[this.eventIndex].tick <= this.state.tick
    ) {
      const event = this.eventQueue[this.eventIndex];

      // Apply event
      applyEvent(event, this.state, this.config, () => this.generateRelicOptions());

      // If SNAP was activated, execute it
      if (event.type === 'ACTIVATE_SNAP') {
        this.executeSnap();
      }

      // If SKILL was activated, execute it at target location
      if (event.type === 'ACTIVATE_SKILL') {
        activateTargetedSkill(
          event.skillId,
          event.targetX,
          event.targetY,
          this.state,
          this.config,
          this.rng
        );
      }

      this.eventIndex++;
    }
  }

  /**
   * Update wave spawning
   */
  private updateWaves(): void {
    // Check if we should start a new wave
    if (this.state.waveComplete && !this.state.inChoice) {
      // Always start next wave in endless mode
      this.startNextWave();
      analytics.startWave(this.state.wave, this.state.fortressHp);
    }

    // Spawn enemies from queue
    if (this.state.waveSpawnQueue.length > 0) {
      const nextSpawn = this.state.waveSpawnQueue[0];
      if (this.state.tick >= nextSpawn.spawnTick) {
        this.spawnEnemy(nextSpawn);
        this.state.waveSpawnQueue.shift();
      }
    }

    // Check if wave is complete (all spawned and killed)
    if (
      !this.state.waveComplete &&
      this.state.waveSpawnQueue.length === 0 &&
      this.state.enemies.length === 0
    ) {
      this.completeWave();
    }
  }

  /**
   * Start the next wave
   */
  private startNextWave(): void {
    this.state.wave++;
    this.state.waveComplete = false;

    // Update current pillar based on wave (filtered by unlocked pillars if set)
    const newPillar = getPillarForWave(this.state.wave, this.config.unlockedPillars);
    if (newPillar && newPillar.id !== this.state.currentPillar) {
      this.state.currentPillar = newPillar.id;
      // Immediately recalculate pillar modifiers for new pillar
      this.updatePillarModifiers();
    }

    const composition = getWaveComposition(this.state.wave, this.config.tickHz, this.config.unlockedPillars);
    const queue: WaveSpawnEntry[] = [];

    let spawnTick = this.state.tick + this.config.waveIntervalTicks;

    for (const group of composition.enemies) {
      for (let i = 0; i < group.count; i++) {
        const isElite = this.rng.nextFloat() < composition.eliteChance;
        queue.push({
          type: group.type,
          isElite,
          spawnTick,
        });
        spawnTick += composition.spawnIntervalTicks;
      }
    }

    this.state.waveSpawnQueue = queue;
    this.state.waveTotalEnemies = queue.length;
    this.state.waveSpawnedEnemies = 0;
  }

  /**
   * Spawn a single enemy
   */
  private spawnEnemy(entry: WaveSpawnEntry): void {
    const stats = getEnemyStats(entry.type, this.state.wave, entry.isElite);

    // Get physics config for lane calculation
    const physicsConfig = {
      ...DEFAULT_PHYSICS_CONFIG,
      fieldMinY: FP.fromInt(0),
      fieldMaxY: this.config.fieldHeight,
    };

    // Assign random target lane - but spawn at center (portal position)
    const targetLane = getRandomLane(() => this.rng.nextFloat());
    const spawnLane = 1; // Center lane - portal position
    const spawnY = getLaneY(spawnLane, physicsConfig);

    // Add random Y offset so enemies spread out when exiting portal
    const yOffset = FP.fromFloat((this.rng.nextFloat() - 0.5) * 8);
    const initialY = FP.add(spawnY, yOffset);

    const enemy: Enemy = {
      id: this.state.nextEnemyId++,
      type: entry.type,
      hp: stats.hp,
      maxHp: stats.hp,

      // Position - start at portal (center), will move to target lane
      x: this.config.enemySpawnX,
      y: initialY,

      // Physics
      vx: FP.mul(stats.speed, FP.fromInt(-1)), // Moving left
      vy: 0,
      speed: stats.speed,
      baseSpeed: stats.speed, // Store original speed for effect recovery
      radius: ENEMY_PHYSICS.defaultRadius,
      mass: ENEMY_PHYSICS.defaultMass,

      damage: stats.damage,
      isElite: entry.isElite,
      hitFlashTicks: 0,
      lastAttackTick: 0,

      // Lane info - start at center, move towards target
      lane: spawnLane,
      targetLane: targetLane, // Will move towards this lane
      canSwitchLane: this.rng.nextFloat() < 0.15, // 15% of enemies can switch lanes later
      laneSwitchCooldown: 0,

      // Status effects
      activeEffects: [],
    };

    this.state.enemies.push(enemy);
    this.state.waveSpawnedEnemies++;
    analytics.trackSpawn();
  }

  /**
   * Complete current wave
   */
  private completeWave(): void {
    this.state.waveComplete = true;
    this.state.wavesCleared++;

    // Award XP for wave completion
    const waveXp = calculateWaveCompleteXp(this.state.wave);
    this.state.segmentXpEarned += waveXp;
    this.state.sessionXpEarned += waveXp;
    this.checkAndUpdateLevel();

    // Analytics: End wave
    const waveStats = analytics.endWave(this.state.fortressHp);
    if (waveStats) {
      // Add summary to history/logs if needed (later can be sent to server)
      // console.log(analytics.generateReport());
      this.state.stats = {
        totalDamageDealt: waveStats.totalDamageDealt,
        enemiesKilledByHero: Object.values(waveStats.damageByHero).reduce((a, b) => a + b, 0), // Approximation for now
        enemiesKilledByTurret: Object.values(waveStats.damageByTurret).reduce((a, b) => a + b, 0),
        enemiesKilledByFortress: waveStats.damageBySource.fortress,
      };
    }

    // Reduce annihilation cooldown if matrix is assembled
    if (this.state.matrixState && this.state.matrixState.annihilationCooldown > 0) {
      this.state.matrixState.annihilationCooldown--;
      // Keep legacy aliases in sync
      if (this.state.gauntletState) {
        this.state.gauntletState.annihilationCooldown = this.state.matrixState.annihilationCooldown;
        this.state.gauntletState.snapCooldown = this.state.matrixState.annihilationCooldown;
      }
    }

    // Roll for material drop from wave
    this.processWaveMaterialDrop();

    // Roll for artifact drop from wave
    this.processWaveArtifactDrop();

    // Create checkpoint at wave end
    const checkpoint = createCheckpoint(this.state, this.lastChainHash);
    this.checkpoints.push(checkpoint);
    this.lastChainHash = checkpoint.chainHash32;

    // Offer relic choice between waves
    this.state.pendingChoiceTick = this.state.tick;
    this.state.inChoice = true;
    this.state.pendingChoice = {
      options: this.generateRelicOptions(),
      wave: this.state.wave,
      offeredTick: this.state.tick,
    };
  }

  /**
   * Check if current wave is a segment boundary (every segmentSize waves)
   */
  isSegmentBoundary(): boolean {
    const wavesSinceStart = this.state.wave - this.state.segmentStartWave;
    return wavesSinceStart > 0 && wavesSinceStart % this.config.segmentSize === 0;
  }

  /**
   * Get segment summary for submission
   */
  getSegmentSummary(): {
    startWave: number;
    endWave: number;
    goldEarned: number;
    dustEarned: number;
    xpEarned: number;
    materialsEarned: Record<string, number>;
    artifactsEarned: string[];
    checkpoints: Checkpoint[];
    finalHash: number;
  } {
    return {
      startWave: this.state.segmentStartWave,
      endWave: this.state.wave,
      goldEarned: this.state.segmentGoldEarned,
      dustEarned: this.state.segmentDustEarned,
      xpEarned: this.state.segmentXpEarned,
      materialsEarned: { ...this.state.segmentMaterialsEarned },
      artifactsEarned: [...this.state.segmentArtifactsEarned],
      checkpoints: this.checkpoints,
      finalHash: this.getFinalHash(),
    };
  }

  /**
   * Reset segment tracking after successful submission
   */
  resetSegment(): void {
    this.state.segmentStartWave = this.state.wave;
    this.state.segmentGoldEarned = 0;
    this.state.segmentDustEarned = 0;
    this.state.segmentXpEarned = 0;
    this.state.segmentMaterialsEarned = {};
    this.state.segmentArtifactsEarned = [];
    this.checkpoints = [];
    this.lastChainHash = this.getFinalHash();
  }

  /**
   * Generate relic options for choice using weighted selection V2
   * Priorytet: dopasowanie do klasy twierdzy
   */
  private generateRelicOptions(): string[] {
    // Buduj rozszerzony kontekst selekcji
    const context: ExtendedRelicSelectionContext = {
      fortressClass: this.state.fortressClass,
      pillarId: this.state.currentPillar,
      heroIds: this.state.heroes.map(h => h.definitionId),
      equippedStones: this.state.collectedStones ?? [],
      fortressLevel: this.state.commanderLevel,
      wave: this.state.wave,
      fortressHpPercent: this.state.fortressMaxHp > 0
        ? this.state.fortressHp / this.state.fortressMaxHp
        : 1.0,
      ownedRelicIds: this.state.relics.map(r => r.id),
      gold: this.state.gold,
    };

    // Wykryj typ buildu gracza
    context.detectedBuildType = detectBuildType(context.ownedRelicIds ?? []);

    // Użyj weighted selection V2 z deterministycznym RNG
    const choices = getRelicChoicesV2(
      this.config.relicsPerChoice,
      context,
      this.rng
    );

    // Jeśli brak wyników (wszystkie reliki posiadane), fallback do prostego losowania
    if (choices.length === 0) {
      const availableRelics = getAvailableRelics(
        this.state.fortressClass,
        this.state.currentPillar,
        this.state.commanderLevel
      );
      return this.rng.pickN(availableRelics, this.config.relicsPerChoice).map((r: { id: string }) => r.id);
    }

    return choices.map((r: { id: string }) => r.id);
  }

  /**
   * Calculate turret world positions for collision detection
   * @returns Map of slotIndex to {x, y} position
   */
  private calculateTurretPositions(): Map<number, { x: number; y: number }> {
    const positions = new Map<number, { x: number; y: number }>();

    for (const turret of this.state.turrets) {
      const slot = TURRET_SLOTS.find(s => s.id === turret.slotIndex);
      if (!slot) continue;

      const turretX = FP.add(this.config.fortressX, FP.fromFloat(slot.offsetX));
      const turretY = FP.fromFloat(7 + slot.offsetY);

      positions.set(turret.slotIndex, { x: turretX, y: turretY });
    }

    return positions;
  }

  /**
   * Try to attack a defender (hero or turret) in melee range
   * @returns true if an attack was made
   */
  private tryAttackDefender(
    enemy: Enemy,
    turretPositions: Map<number, { x: number; y: number }>
  ): boolean {
    // Priority 1: Attack heroes in melee range
    for (const hero of this.state.heroes) {
      // Skip inactive heroes
      if (hero.state === 'idle') {
        continue;
      }

      // Melee range = sum of radii (contact)
      const combinedRadius = FP.add(enemy.radius, hero.radius);
      const meleeRangeSq = FP.mul(combinedRadius, combinedRadius);
      const distSq = FP.add(
        FP.mul(FP.sub(enemy.x, hero.x), FP.sub(enemy.x, hero.x)),
        FP.mul(FP.sub(enemy.y, hero.y), FP.sub(enemy.y, hero.y))
      );

      if (distSq <= meleeRangeSq) {
        // Attack hero
        const { damageTaken, reflectDamage } = applyDamageToHero(hero, enemy.damage, this.rng);

        // Apply reflect damage back to enemy
        if (reflectDamage > 0) {
          enemy.hp -= reflectDamage;
          enemy.hitFlashTicks = 3; // Visual feedback for reflect
        }

        // Leech special: heal on attack (only if dealt damage)
        if (enemy.type === 'leech' && damageTaken > 0) {
          const healAmount = Math.floor(enemy.maxHp * LEECH_HEAL_PERCENT);
          enemy.hp = Math.min(enemy.hp + healAmount, enemy.maxHp);
        }

        return true;
      }
    }

    // Priority 2: Attack turrets in melee range
    for (const turret of this.state.turrets) {
      const pos = turretPositions.get(turret.slotIndex);
      if (!pos) continue;

      // Melee range = enemy radius + turret radius
      const combinedRadius = FP.add(enemy.radius, TURRET_COLLISION_RADIUS);
      const meleeRangeSq = FP.mul(combinedRadius, combinedRadius);
      const distSq = FP.add(
        FP.mul(FP.sub(enemy.x, pos.x), FP.sub(enemy.x, pos.x)),
        FP.mul(FP.sub(enemy.y, pos.y), FP.sub(enemy.y, pos.y))
      );

      if (distSq <= meleeRangeSq) {
        // Attack turret
        applyDamageToTurret(turret, enemy.damage);

        // Check if turret destroyed
        if (turret.currentHp <= 0) {
          this.destroyTurret(turret.slotIndex);
        }

        // Leech special: heal on attack
        if (enemy.type === 'leech') {
          const healAmount = Math.floor(enemy.maxHp * LEECH_HEAL_PERCENT);
          enemy.hp = Math.min(enemy.hp + healAmount, enemy.maxHp);
        }

        return true;
      }
    }

    return false;
  }

  /**
   * Remove a destroyed turret from the game
   */
  private destroyTurret(slotIndex: number): void {
    const idx = this.state.turrets.findIndex(t => t.slotIndex === slotIndex);
    if (idx >= 0) {
      this.state.turrets.splice(idx, 1);
    }
  }

  /**
   * Update enemy positions and check for fortress damage
   */
  private updateEnemies(): void {
    // Update status effects first (tick down, apply DOT, remove expired)
    updateEnemyStatusEffects(this.state);

    const toRemove: number[] = [];
    // Position where enemies stop (fortress + attack range)
    const stopPosition = FP.add(this.config.fortressX, this.config.enemyAttackRange);

    // Calculate turret positions once per frame for collision detection
    const turretPositions = this.calculateTurretPositions();

    for (const enemy of this.state.enemies) {
      // Decrement hit flash
      if (enemy.hitFlashTicks > 0) {
        enemy.hitFlashTicks--;
      }

      // Check if enemy has reached attack range
      if (enemy.x <= stopPosition) {
        // Stop at the attack position (don't go further)
        enemy.x = stopPosition;
        enemy.vx = 0;
        enemy.vy = 0;

        // Attack fortress periodically
        if (this.state.tick - enemy.lastAttackTick >= this.config.enemyAttackInterval) {
          enemy.lastAttackTick = this.state.tick;

          // Deal damage to fortress
          this.state.fortressHp -= enemy.damage;
          analytics.trackFortressDamage(enemy.damage);

          // Leech special: heal back some HP on attack
          if (enemy.type === 'leech') {
            const healAmount = Math.floor(enemy.maxHp * LEECH_HEAL_PERCENT);
            enemy.hp = Math.min(enemy.hp + healAmount, enemy.maxHp);
          }
        }
      } else {
        // Try to attack defenders (heroes/turrets) while moving
        if (this.state.tick - enemy.lastAttackTick >= this.config.enemyAttackInterval) {
          if (this.tryAttackDefender(enemy, turretPositions)) {
            enemy.lastAttackTick = this.state.tick;
          }
        }

        // Apply friction for smooth movement
        applyFriction(enemy, ENEMY_PHYSICS.friction);

        // Lane switching logic for enemies that can switch lanes randomly
        if (enemy.canSwitchLane) {
          // Cooldown decrement
          if (enemy.laneSwitchCooldown > 0) {
            enemy.laneSwitchCooldown--;
          }

          // Decide to switch lane randomly when off cooldown
          if (enemy.laneSwitchCooldown === 0 && enemy.lane === enemy.targetLane) {
            // 1% chance per tick to decide to switch (when ready)
            if (this.rng.nextFloat() < 0.01) {
              // Pick a different lane
              const possibleLanes = [0, 1, 2].filter(l => l !== enemy.lane);
              const newLane = possibleLanes[Math.floor(this.rng.nextFloat() * possibleLanes.length)];
              enemy.targetLane = newLane;
              enemy.laneSwitchCooldown = 90; // 3 seconds before can switch again
            }
          }
        }

        // Move towards target lane (ALL enemies - for spawning from portal)
        if (enemy.lane !== enemy.targetLane) {
          const physicsConfig = {
            ...DEFAULT_PHYSICS_CONFIG,
            fieldMinY: FP.fromInt(0),
            fieldMaxY: this.config.fieldHeight,
          };
          const targetY = getLaneY(enemy.targetLane, physicsConfig);
          const diff = FP.sub(targetY, enemy.y);
          const switchSpeed = FP.mul(enemy.speed, FP.fromFloat(0.6)); // Move at 60% speed

          if (Math.abs(FP.toFloat(diff)) < 2) {
            // Close enough - snap to lane
            enemy.y = targetY;
            enemy.lane = enemy.targetLane;
            enemy.vy = 0;
          } else if (diff > 0) {
            enemy.vy = switchSpeed;
          } else {
            enemy.vy = FP.mul(switchSpeed, FP.fromInt(-1));
          }
        }

        // Ensure minimum velocity towards fortress
        if (enemy.vx > FP.mul(enemy.speed, FP.fromInt(-1))) {
          enemy.vx = FP.mul(enemy.speed, FP.fromInt(-1));
        }

        // Clamp velocity to max speed
        clampVelocity(enemy, enemy.speed);

        // Integrate position (apply velocity)
        integratePosition(enemy);

        // Clamp Y to field boundaries
        const minY = FP.add(FP.fromInt(0), enemy.radius);
        const maxY = FP.sub(this.config.fieldHeight, enemy.radius);
        enemy.y = FP.clamp(enemy.y, minY, maxY);
      }

      // Check if dead
      if (enemy.hp <= 0) {
        toRemove.push(enemy.id);
      }
    }

    // Remove dead enemies
    for (const id of toRemove) {
      const idx = this.state.enemies.findIndex(e => e.id === id);
      if (idx >= 0) {
        const enemy = this.state.enemies[idx];

        // Grant rewards (convert additive bonuses to multipliers for reward calculation)
        // Rewards now scale with wave number and cycle
        const rewards = getEnemyRewards(
          enemy.type,
          enemy.isElite,
          1 + this.state.modifiers.goldBonus + this.state.modifiers.goldFindBonus,
          1 + this.state.modifiers.dustBonus,
          this.state.wave
        );
        this.state.gold += rewards.gold;
        this.state.dust += rewards.dust;
        this.state.goldEarned += rewards.gold;
        this.state.dustEarned += rewards.dust;
        
        analytics.trackKill();
        analytics.trackEconomy('earn', 'gold', rewards.gold);
        analytics.trackEconomy('earn', 'dust', rewards.dust);

        // Track segment earnings (for endless mode)
        this.state.segmentGoldEarned += rewards.gold;
        this.state.segmentDustEarned += rewards.dust;

        // XP earned per kill (scales with wave and elite status)
        const xpEarned = calculateEnemyKillXp(this.state.wave, enemy.isElite);
        this.state.segmentXpEarned += xpEarned;
        this.state.sessionXpEarned += xpEarned;
        this.checkAndUpdateLevel();

        // Check for Crystal, Material, and Artifact drops from bosses
        if (isBossEnemy(enemy.type)) {
          this.processBossStoneDrop(enemy.type);
          this.processBossMaterialDrop(enemy.type);
          this.processBossArtifactDrop(enemy.type);
        }

        // Update stats
        this.state.kills++;
        if (enemy.isElite) {
          this.state.eliteKills++;
        }

        // Kill streak tracking (combo window = 30 ticks = 1 second)
        const KILL_STREAK_WINDOW = 30;
        if (this.state.tick - this.state.lastKillTick <= KILL_STREAK_WINDOW) {
          this.state.killStreak++;
        } else {
          this.state.killStreak = 1;
        }
        this.state.lastKillTick = this.state.tick;
        if (this.state.killStreak > this.state.highestKillStreak) {
          this.state.highestKillStreak = this.state.killStreak;
        }

        this.state.enemies.splice(idx, 1);
      }
    }
  }

  /**
   * Process potential Crystal drop from a killed boss
   */
  private processBossStoneDrop(enemyType: string): void {
    const bossId = getBossIdForEnemy(enemyType, this.state.wave);
    if (!bossId) return;

    const drop = rollStoneDrop(bossId, this.state.currentPillar, this.rng.nextFloat());
    if (!drop) return;

    const crystalType = drop.crystalType;

    if (drop.isFullCrystal) {
      // Full crystal dropped!
      if (!this.state.collectedCrystals.includes(crystalType)) {
        this.state.collectedCrystals.push(crystalType);
        this.state.collectedStones.push(crystalType); // Legacy sync
      }
      // Also remove any fragments for this crystal
      const fragmentIdx = this.state.crystalFragments.findIndex(
        f => f.crystalType === crystalType
      );
      if (fragmentIdx >= 0) {
        this.state.crystalFragments.splice(fragmentIdx, 1);
        this.state.infinityStoneFragments.splice(fragmentIdx, 1); // Legacy sync
      }
    } else {
      // Fragment dropped - only if we don't have the full crystal
      if (this.state.collectedCrystals.includes(crystalType)) return;

      // Find or create fragment entry
      let fragment = this.state.crystalFragments.find(
        f => f.crystalType === crystalType
      );
      if (!fragment) {
        fragment = { crystalType, stoneType: crystalType, count: 0 };
        this.state.crystalFragments.push(fragment);
        this.state.infinityStoneFragments.push(fragment); // Legacy sync
      }

      fragment.count++;

      // Check if we have enough fragments for a full crystal
      if (fragment.count >= FRAGMENTS_PER_STONE) {
        this.state.collectedCrystals.push(crystalType);
        this.state.collectedStones.push(crystalType); // Legacy sync
        // Remove the fragment entry
        const idx = this.state.crystalFragments.findIndex(
          f => f.crystalType === crystalType
        );
        if (idx >= 0) {
          this.state.crystalFragments.splice(idx, 1);
          this.state.infinityStoneFragments.splice(idx, 1); // Legacy sync
        }
      }
    }

    // Check if all 6 crystals are collected - enable matrix
    this.checkMatrixAssembly();
  }

  /**
   * Check if all 6 Crystals are collected to assemble the Matrix
   */
  private checkMatrixAssembly(): void {
    const allCrystals: CrystalType[] = ['power', 'space', 'time', 'reality', 'soul', 'mind'];
    const hasAllCrystals = allCrystals.every(c => this.state.collectedCrystals.includes(c));

    if (hasAllCrystals && !this.state.matrixState) {
      const newMatrixState: CrystalMatrixState = {
        isAssembled: true,
        crystalsCollected: [...this.state.collectedCrystals],
        annihilationCooldown: 0,
        annihilationUsedCount: 0,
        // Legacy aliases
        stonesCollected: [...this.state.collectedCrystals],
        snapCooldown: 0,
        snapUsedCount: 0,
      };
      this.state.matrixState = newMatrixState;
      this.state.gauntletState = newMatrixState; // Legacy sync
    }
  }

  /**
   * Process potential material drop from a killed boss
   */
  private processBossMaterialDrop(enemyType: string): void {
    const bossId = getBossIdForEnemy(enemyType, this.state.wave);
    if (!bossId) return;

    const drop = rollMaterialDropFromBoss(bossId, this.state.currentPillar, this.rng.nextFloat());
    if (!drop) return;

    this.addMaterial(drop.materialId, drop.amount);
  }

  /**
   * Process potential material drop from wave completion
   */
  private processWaveMaterialDrop(): void {
    const drop = rollMaterialDropFromWave(
      this.state.currentPillar,
      this.state.wave,
      this.rng.nextFloat()
    );
    if (!drop) return;

    this.addMaterial(drop.materialId, drop.amount);
  }

  /**
   * Add material to player's inventory
   */
  private addMaterial(materialId: MaterialType, amount: number): void {
    // Add to session total
    const current = this.state.materials[materialId] || 0;
    this.state.materials[materialId] = current + amount;

    // Track for segment verification
    const segmentCurrent = this.state.segmentMaterialsEarned[materialId] || 0;
    this.state.segmentMaterialsEarned[materialId] = segmentCurrent + amount;
  }

  /**
   * Process potential artifact drop from a killed boss
   */
  private processBossArtifactDrop(enemyType: string): void {
    const bossId = getBossIdForEnemy(enemyType, this.state.wave);
    if (!bossId) return;

    // Combine already-owned with this run's earned artifacts
    const ownedArtifacts = [
      ...(this.config.playerOwnedArtifacts ?? []),
      ...this.state.artifactsEarnedThisRun,
    ];

    const drop = rollArtifactDropFromBoss(
      bossId,
      this.state.currentPillar,
      this.rng.nextFloat(),
      ownedArtifacts
    );

    if (!drop) return;

    this.handleArtifactDrop(drop, 'boss');
  }

  /**
   * Process potential artifact drop from wave completion
   */
  private processWaveArtifactDrop(): void {
    const ownedArtifacts = [
      ...(this.config.playerOwnedArtifacts ?? []),
      ...this.state.artifactsEarnedThisRun,
    ];

    const drop = rollArtifactDropFromWave(
      this.state.currentPillar,
      this.state.wave,
      this.rng.nextFloat(),
      ownedArtifacts
    );

    if (!drop) return;

    this.handleArtifactDrop(drop, 'wave');
  }

  /**
   * Handle an artifact drop (new or duplicate)
   */
  private handleArtifactDrop(
    drop: { artifactId: string; isDuplicate: boolean; dustValue: number },
    source: 'boss' | 'wave'
  ): void {
    if (drop.isDuplicate) {
      // Convert to dust immediately
      this.state.dust += drop.dustValue;
      this.state.dustEarned += drop.dustValue;
      this.state.segmentDustEarned += drop.dustValue;
    } else {
      // Track new artifact
      this.state.artifactsEarnedThisRun.push(drop.artifactId);
      this.state.segmentArtifactsEarned.push(drop.artifactId);
    }

    // Store pending drop for UI notification
    this.state.pendingArtifactDrops.push({
      artifactId: drop.artifactId,
      isDuplicate: drop.isDuplicate,
      dustValue: drop.dustValue,
      dropTick: this.state.tick,
      source,
    });
  }

  /**
   * Execute the Annihilation Wave ability (deals 30% of max HP to all enemies)
   * @deprecated Use executeAnnihilation() instead
   */
  executeSnap(): boolean {
    return this.executeAnnihilation();
  }

  /**
   * Execute the Annihilation Wave ability (deals 30% of max HP to all enemies)
   */
  executeAnnihilation(): boolean {
    if (!this.state.matrixState?.isAssembled) return false;
    if (this.state.matrixState.annihilationCooldown > 0) return false;
    if (this.state.enemies.length === 0) return false;

    // Deal 30% of max HP damage to ALL enemies
    const ANNIHILATION_DAMAGE_PERCENT = 0.3;
    for (const enemy of this.state.enemies) {
      const damage = Math.floor(enemy.maxHp * ANNIHILATION_DAMAGE_PERCENT);
      enemy.hp = Math.max(0, enemy.hp - damage);
    }

    // Set cooldown (in waves, not ticks)
    const cooldownWaves = CRYSTAL_MATRIX.annihilationWave?.cooldownWaves ?? 3;
    this.state.matrixState.annihilationCooldown = cooldownWaves;
    this.state.matrixState.annihilationUsedCount++;
    // Keep legacy aliases in sync
    if (this.state.gauntletState) {
      this.state.gauntletState.annihilationCooldown = cooldownWaves;
      this.state.gauntletState.snapCooldown = cooldownWaves;
      this.state.gauntletState.annihilationUsedCount = this.state.matrixState.annihilationUsedCount;
      this.state.gauntletState.snapUsedCount = this.state.matrixState.annihilationUsedCount;
    }

    return true;
  }

  /**
   * Fortress auto-attack
   */
  private updateFortressAttack(): void {
    // Calculate attack speed bonus (additive system)
    const synergyAttackSpeedBonus = this.state.synergyModifiers.attackSpeedBonus ?? 0;
    const totalAttackSpeedBonus = this.state.modifiers.attackSpeedBonus + synergyAttackSpeedBonus;
    const attackInterval = Math.floor(
      this.config.fortressAttackInterval / (1 + totalAttackSpeedBonus)
    );

    if (this.state.tick - this.state.fortressLastAttackTick >= attackInterval) {
      this.state.fortressLastAttackTick = this.state.tick;

      // Find closest enemy
      const closest = this.findClosestEnemy();
      if (!closest) return;

      // Calculate and apply primary damage
      const critChance = Math.min(
        this.state.modifiers.critChance + (this.state.synergyModifiers.critChance ?? 0),
        1.0
      );
      const isCrit = shouldCrit(critChance, this.rng.nextFloat());

      // Apply synergy and pillar damage bonuses (additive system)
      let damageBonus = this.state.modifiers.damageBonus;
      if (this.state.synergyModifiers.damageBonus) {
        damageBonus += this.state.synergyModifiers.damageBonus;
      }
      if (this.state.pillarModifiers.damageBonus) {
        damageBonus += this.state.pillarModifiers.damageBonus;
      }

      const baseDamage = Math.floor(this.config.fortressBaseDamage * (1 + damageBonus));
      const damage = calculateDamage(
        baseDamage,
        this.state,
        closest,
        isCrit
      );

      // Create projectile instead of instant damage
      createFortressProjectile(closest, this.state, this.config, damage);

      // Apply secondary effects (still instant for now, can be moved to projectile system later)
      this.applyPierceDamage(closest, damage);
      this.applyChainDamage(closest, damage);
      this.applySplashDamage(closest, damage);
    }
  }

  /**
   * Find the best enemy to target (priority targeting)
   */
  private findClosestEnemy(): Enemy | null {
    if (this.state.enemies.length === 0) return null;

    // Priority targeting: consider position, HP, and danger level
    let bestTarget = this.state.enemies[0];
    let bestScore = this.calculateTargetScore(bestTarget);

    for (const enemy of this.state.enemies) {
      const score = this.calculateTargetScore(enemy);
      if (score > bestScore) {
        bestTarget = enemy;
        bestScore = score;
      }
    }
    return bestTarget;
  }

  /**
   * Calculate priority score for targeting
   * Higher score = higher priority target
   */
  private calculateTargetScore(enemy: Enemy): number {
    let score = 0;

    // Priority 1: Distance to fortress (closer = higher priority)
    // Scale: 0-100 points, inversely proportional to distance
    const distToFortress = FP.toFloat(FP.sub(enemy.x, this.config.fortressX));
    score += Math.max(0, 100 - distToFortress * 3);

    // Priority 2: Low HP enemies (finish kills)
    // Scale: 0-50 points, inversely proportional to HP percentage
    const hpPercent = enemy.hp / enemy.maxHp;
    score += (1 - hpPercent) * 50;

    // Priority 3: Dangerous enemy types
    switch (enemy.type) {
      case 'leech':
        score += 30; // High priority - heals on attack
        break;
      case 'bruiser':
        score += 20; // High HP enemy, needs focused damage
        break;
      // Boss-type enemies
      case 'mafia_boss':
      case 'ai_core':
      case 'cosmic_beast':
      case 'dimensional_being':
      case 'god':
        score += 25;
        break;
      case 'runner':
        score += 10; // Fast enemies, prioritize slightly
        break;
    }

    // Priority 4: Elite enemies (more dangerous)
    if (enemy.isElite) {
      score += 25;
    }

    return score;
  }

  /**
   * Apply pierce damage to enemies behind the primary target
   */
  private applyPierceDamage(primary: Enemy, damage: number): void {
    if (this.state.modifiers.pierceCount <= 0) return;

    const pierced = this.state.enemies
      .filter(e => e.id !== primary.id)
      .sort((a, b) => a.x - b.x)
      .slice(0, this.state.modifiers.pierceCount);

    for (const target of pierced) {
      this.damageEnemy(target, damage);
    }
  }

  /**
   * Apply chain lightning damage to random enemies
   */
  private applyChainDamage(primary: Enemy, damage: number): void {
    const shouldDoChain = shouldChain(
      this.state.modifiers.chainChance,
      this.rng.nextFloat()
    );

    if (!shouldDoChain) return;

    const chainDamage = Math.floor(damage * this.state.modifiers.chainDamagePercent);
    const candidates = this.state.enemies.filter(e => e.id !== primary.id);

    // Use deterministic Fisher-Yates shuffle instead of non-deterministic sort
    const shuffled = this.rng.shuffle([...candidates]);
    const chainTargets = shuffled.slice(0, this.state.modifiers.chainCount);

    for (const target of chainTargets) {
      this.damageEnemy(target, chainDamage);
    }
  }

  /**
   * Apply splash damage to enemies near the primary target
   */
  private applySplashDamage(primary: Enemy, damage: number): void {
    if (this.state.modifiers.splashRadiusBonus <= 0) return;

    const splashDamage = Math.floor(damage * this.state.modifiers.splashDamagePercent);
    const splashRadiusFP = FP.fromInt(this.state.modifiers.splashRadiusBonus);

    // Use squared distance for efficiency (avoids sqrt)
    const splashRadiusSq = FP.mul(splashRadiusFP, splashRadiusFP);

    for (const enemy of this.state.enemies) {
      if (enemy.id === primary.id) continue;

      // Calculate 2D distance (not just X-axis!)
      const dx = FP.sub(enemy.x, primary.x);
      const dy = FP.sub(enemy.y, primary.y);
      const distSq = FP.add(FP.mul(dx, dx), FP.mul(dy, dy));

      if (distSq <= splashRadiusSq) {
        this.damageEnemy(enemy, splashDamage);
      }
    }
  }

  /**
   * Apply damage to an enemy
   */
  private damageEnemy(enemy: Enemy, damage: number): void {
    enemy.hp -= damage;
    enemy.hitFlashTicks = HIT_FLASH_TICKS;
  }

  /**
   * Update HP regeneration
   */
  private updateRegeneration(): void {
    if (this.state.modifiers.hpRegen > 0) {
      if (this.state.tick % REGEN_INTERVAL_TICKS === 0) {
        this.state.fortressHp = Math.min(
          this.state.fortressHp + this.state.modifiers.hpRegen,
          this.state.fortressMaxHp
        );
      }
    }
  }

  /**
   * Check end conditions
   */
  private checkEndConditions(): void {
    if (this.state.fortressHp <= 0) {
      this.state.fortressHp = 0;
      this.state.ended = true;
      this.state.won = false;
      // Endless mode: Track death wave for retry
      this.state.deathWave = this.state.wave;
    }
  }

  /**
   * Retry the current wave after death (Endless mode)
   * Keeps: gold, dust, relics, XP, upgrades
   * Resets: fortress HP, enemies, wave spawn queue
   */
  retryWave(): void {
    if (!this.state.ended || this.state.won) return;

    // Reset fortress HP to max
    this.state.fortressHp = this.state.fortressMaxHp;

    // Clear enemies and wave state
    this.state.enemies = [];
    this.state.waveSpawnQueue = [];
    this.state.waveComplete = true;

    // Decrement wave to retry the same wave on next startNextWave
    this.state.wave--;

    // Reset ended state
    this.state.ended = false;
    this.state.deathWave = undefined;

    // Track retry count
    this.state.retryCount++;
  }

  /**
   * Get all checkpoints generated during simulation
   */
  getCheckpoints(): Checkpoint[] {
    return this.checkpoints;
  }

  /**
   * Get final hash
   */
  getFinalHash(): number {
    return computeFinalHash(this.state);
  }

  /**
   * Calculate score from current state
   */
  calculateScore(): number {
    let score = 0;

    // Waves cleared (major component)
    score += this.state.wavesCleared * 1000;

    // Kills
    score += this.state.kills * 10;

    // Elite kills bonus
    score += this.state.eliteKills * 50;

    // Gold earned
    score += this.state.goldEarned;

    // Time survived bonus (if didn't win)
    if (!this.state.won) {
      score += Math.floor(this.state.tick / TICKS_PER_SECOND) * SCORE_POINTS_PER_SECOND;
    }

    // Win bonus
    if (this.state.won) {
      score += 5000;
      // Speed bonus for winning quickly
      const timeBonus = Math.max(0, SPEED_BONUS_CUTOFF_TICKS - this.state.tick) * SPEED_BONUS_MULTIPLIER;
      score += timeBonus;
    }

    return score;
  }

  // ============================================
  // INTERNAL HELPERS
  // ============================================

  /**
   * Check if player has earned enough XP to level up during session
   * Updates commanderLevel based on sessionXpEarned
   */
  private checkAndUpdateLevel(): void {
    // Calculate effective total XP (XP at session start + session XP earned)
    // Since we don't have the exact starting XP, we use the threshold for the starting level
    const effectiveTotalXp = this.xpNeededForInitialLevel + this.state.sessionXpEarned;

    // Calculate new level based on effective total XP
    let newLevel = this.initialCommanderLevel;
    let xpThreshold = this.xpNeededForInitialLevel;

    // Keep leveling up while we have enough XP
    while (newLevel < 50) { // Cap at level 50
      const xpForNextLevel = getXpForLevel(newLevel);
      if (effectiveTotalXp >= xpThreshold + xpForNextLevel) {
        xpThreshold += xpForNextLevel;
        newLevel++;
      } else {
        break;
      }
    }

    // Update commander level if it changed
    if (newLevel !== this.state.commanderLevel) {
      this.state.commanderLevel = newLevel;
    }
  }

  // ============================================
  // INTERNAL TEST HELPERS (DO NOT USE IN PRODUCTION)
  // ============================================

  /**
   * @internal - FOR TESTING ONLY
   * Add XP for level-up testing
   */
  public cheat_AddXp(amount: number): void {
    this.state.segmentXpEarned += amount;
    this.state.sessionXpEarned += amount;
    this.checkAndUpdateLevel();
  }
}
