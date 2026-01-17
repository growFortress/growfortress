/**
 * Boss Rush Simulation
 *
 * Server-side simulation for Boss Rush mode verification.
 * Replays player events and verifies checkpoints/final hash.
 */

import type { Checkpoint, GameEvent } from '@arcade/protocol';
import { Xorshift32 } from './rng.js';
import { FP } from './fixed.js';
import type { FortressClass, ActiveHero, ActiveTurret, ActiveProjectile, ModifierSet } from './types.js';
import {
  BossRushConfig,
  DEFAULT_BOSS_RUSH_CONFIG,
  BossRushState,
  createBossRushState,
  getBossRushBossStats,
  processBossKill,
  startIntermission,
  endIntermission,
  generateBossRushSummary,
  type BossRushSummary,
} from './boss-rush.js';
import { fnv1a32, computeChainHash } from './checkpoints.js';
import { initializeHeroes, initializeTurrets } from './systems.js';
import { DEFAULT_MODIFIERS } from './data/relics.js';
import {
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  getMaxHeroSlots,
  getMaxTurretSlots,
} from './data/fortress-progression.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Boss Rush game state for simulation
 */
export interface BossRushGameState {
  tick: number;
  ended: boolean;
  rngState: number;

  // Fortress
  fortressHp: number;
  fortressMaxHp: number;
  fortressClass: FortressClass;
  fortressLastAttackTick: number;

  // Boss Rush specific
  bossRush: BossRushState;

  // Current boss (the enemy)
  currentBoss: {
    hp: number;
    maxHp: number;
    damage: number;
    lastAttackTick: number;
  } | null;

  // Heroes and turrets
  heroes: ActiveHero[];
  turrets: ActiveTurret[];
  projectiles: ActiveProjectile[];
  nextProjectileId: number;

  // Modifiers
  modifiers: ModifierSet;

  // Commander level
  commanderLevel: number;

  // Stats
  timeSurvived: number;
}

/**
 * Turret config for Boss Rush
 */
export interface BossRushTurretConfig {
  definitionId: string;
  slotIndex: number;
  class: FortressClass;
  tier?: 1 | 2 | 3;
}

/**
 * Boss Rush simulation config
 */
export interface BossRushSimConfig {
  tickHz: number;
  fortressBaseHp: number;
  fortressBaseDamage: number;
  fortressAttackInterval: number;
  fieldWidth: number;
  fieldHeight: number;
  fortressX: number;
  fortressClass: FortressClass;
  commanderLevel: number;
  startingHeroes: string[];
  startingTurrets: BossRushTurretConfig[];
  bossRush: BossRushConfig;
}

/**
 * Default Boss Rush simulation config
 */
export function getDefaultBossRushConfig(): BossRushSimConfig {
  return {
    tickHz: 30,
    fortressBaseHp: 200,
    fortressBaseDamage: 10,
    fortressAttackInterval: 15,
    fieldWidth: FP.fromInt(40),
    fieldHeight: FP.fromInt(15),
    fortressX: FP.fromInt(2),
    fortressClass: 'natural',
    commanderLevel: 1,
    startingHeroes: [],
    startingTurrets: [],
    bossRush: DEFAULT_BOSS_RUSH_CONFIG,
  };
}

/**
 * Boss Rush replay result
 */
export interface BossRushReplayResult {
  success: boolean;
  reason?: string;
  finalHash: number;
  checkpoints: Checkpoint[];
  summary: BossRushSummary;
}

/**
 * Boss Rush verify options
 */
export interface BossRushVerifyOptions {
  seed: number;
  events: GameEvent[];
  expectedCheckpoints: Checkpoint[];
  expectedFinalHash: number;
  config?: Partial<BossRushSimConfig>;
  loadout?: {
    fortressClass?: FortressClass;
    heroIds?: string[];
    turrets?: BossRushTurretConfig[];
  };
}

// ============================================================================
// STATE CREATION
// ============================================================================

/**
 * Create initial Boss Rush game state
 */
export function createBossRushGameState(
  seed: number,
  config: BossRushSimConfig
): BossRushGameState {
  const rng = new Xorshift32(seed);

  // Apply commander level HP bonus
  const hpBonus = calculateTotalHpBonus(config.commanderLevel);
  const maxHp = Math.floor((config.fortressBaseHp * hpBonus) / 16384);

  // Initialize heroes
  const maxHeroSlots = getMaxHeroSlots(config.commanderLevel);
  const heroes = initializeHeroes(
    config.startingHeroes.slice(0, maxHeroSlots),
    config.fortressX
  );

  // Initialize turrets
  const maxTurretSlots = getMaxTurretSlots(config.commanderLevel);
  const turrets = initializeTurrets(
    config.startingTurrets.slice(0, maxTurretSlots)
  );

  // Initialize modifiers with commander damage bonus
  const damageBonusFP = calculateTotalDamageBonus(config.commanderLevel);
  const modifiers: ModifierSet = {
    ...DEFAULT_MODIFIERS,
    damageBonus: (damageBonusFP / 16384) - 1, // Convert from fixed-point multiplier to additive bonus
  };

  return {
    tick: 0,
    ended: false,
    rngState: rng.getState(),

    fortressHp: maxHp,
    fortressMaxHp: maxHp,
    fortressClass: config.fortressClass,
    fortressLastAttackTick: 0,

    bossRush: createBossRushState(),
    currentBoss: null,

    heroes,
    turrets,
    projectiles: [],
    nextProjectileId: 1,

    modifiers,
    commanderLevel: config.commanderLevel,
    timeSurvived: 0,
  };
}

// ============================================================================
// CHECKPOINT HASH
// ============================================================================

function numberToBytes(n: number, byteCount: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    bytes.push((n >>> (i * 8)) & 0xff);
  }
  return bytes;
}

function appendNumber(data: number[], value: number, byteCount = 4): void {
  data.push(...numberToBytes(value, byteCount));
}

function appendBool(data: number[], value: boolean): void {
  data.push(value ? 1 : 0);
}

/**
 * Compute checkpoint hash for Boss Rush state
 */
export function computeBossRushCheckpointHash(state: BossRushGameState): number {
  const data: number[] = [];

  // Core state
  appendNumber(data, state.tick);
  appendBool(data, state.ended);
  appendNumber(data, state.rngState);

  // Fortress
  appendNumber(data, state.fortressHp);
  appendNumber(data, state.fortressMaxHp);
  appendNumber(data, state.fortressLastAttackTick);

  // Boss Rush state
  appendNumber(data, state.bossRush.currentBossIndex);
  appendNumber(data, state.bossRush.bossesKilled);
  appendNumber(data, Math.floor(state.bossRush.totalDamageDealt));
  appendNumber(data, Math.floor(state.bossRush.currentBossDamage));
  appendBool(data, state.bossRush.inIntermission);
  appendNumber(data, state.bossRush.intermissionEndTick);
  appendNumber(data, state.bossRush.goldEarned);
  appendNumber(data, state.bossRush.dustEarned);

  // Current boss
  appendBool(data, state.currentBoss !== null);
  if (state.currentBoss) {
    appendNumber(data, state.currentBoss.hp);
    appendNumber(data, state.currentBoss.maxHp);
    appendNumber(data, state.currentBoss.damage);
    appendNumber(data, state.currentBoss.lastAttackTick);
  }

  // Heroes (simplified - just count and total HP)
  appendNumber(data, state.heroes.length);
  let totalHeroHp = 0;
  for (const hero of state.heroes) {
    totalHeroHp += hero.currentHp;
  }
  appendNumber(data, totalHeroHp);

  // Turrets
  appendNumber(data, state.turrets.length);

  // Projectiles count
  appendNumber(data, state.projectiles.length);

  return fnv1a32(data);
}

/**
 * Create Boss Rush checkpoint
 */
export function createBossRushCheckpoint(
  state: BossRushGameState,
  prevChainHash: number
): Checkpoint {
  const hash32 = computeBossRushCheckpointHash(state);
  const chainHash32 = computeChainHash(prevChainHash, state.tick, hash32);

  return {
    tick: state.tick,
    hash32,
    chainHash32,
  };
}

/**
 * Compute final hash for Boss Rush
 */
export function computeBossRushFinalHash(state: BossRushGameState): number {
  const data: number[] = [];

  // Include checkpoint hash
  data.push(...numberToBytes(computeBossRushCheckpointHash(state), 4));

  // Add final stats
  data.push(...numberToBytes(state.bossRush.bossesKilled, 4));
  data.push(...numberToBytes(Math.floor(state.bossRush.totalDamageDealt), 4));
  data.push(...numberToBytes(state.bossRush.goldEarned, 4));
  data.push(...numberToBytes(state.bossRush.dustEarned, 4));
  data.push(...numberToBytes(state.tick, 4)); // Time survived

  return fnv1a32(data);
}

// ============================================================================
// SIMULATION CLASS
// ============================================================================

/**
 * Boss Rush Simulation
 */
export class BossRushSimulation {
  state: BossRushGameState;
  config: BossRushSimConfig;
  private rng: Xorshift32;
  private eventQueue: GameEvent[] = [];
  private eventIndex = 0;
  private checkpoints: Checkpoint[] = [];
  private lastChainHash = 0;
  private checkpointTicks: Set<number> = new Set();

  constructor(seed: number, config: BossRushSimConfig) {
    this.config = config;
    this.state = createBossRushGameState(seed, config);
    this.rng = new Xorshift32(seed);

    // Spawn first boss
    this.spawnNextBoss();
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
      const checkpoint = createBossRushCheckpoint(this.state, this.lastChainHash);
      this.checkpoints.push(checkpoint);
      this.lastChainHash = checkpoint.chainHash32;
    }

    // Update game state
    this.updateBossRush();
    this.updateBossAttack();
    this.updateFortressAttack();

    // Check end condition
    this.checkEndCondition();

    // Store RNG state
    this.state.rngState = this.rng.getState();

    // Advance tick
    this.state.tick++;
    this.state.timeSurvived = this.state.tick;
  }

  /**
   * Run simulation until end or max ticks
   */
  run(maxTicks: number = 2 * 60 * 60 * 30): void {
    while (!this.state.ended && this.state.tick < maxTicks) {
      this.step();
    }
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
      this.applyBossRushEvent(event);
      this.eventIndex++;
    }
  }

  /**
   * Apply a Boss Rush event
   */
  private applyBossRushEvent(event: GameEvent): void {
    // Handle events - Boss Rush uses same event types as regular runs
    switch (event.type) {
      case 'HERO_COMMAND': {
        // Handle hero positioning command
        const commandType = event.commandType || 'move';
        if (commandType === 'move') {
          // Find hero by definitionId and set command target
          const hero = this.state.heroes.find(h => h.definitionId === event.heroId);
          if (hero && hero.state !== 'dead' && hero.state !== 'cooldown' &&
              event.targetX !== undefined && event.targetY !== undefined) {
            hero.commandTarget = { x: event.targetX, y: event.targetY };
            hero.isCommanded = true;
            hero.state = 'commanded';
          }
        } else if (commandType === 'focus') {
          // Focus on target enemy - set for all heroes
          for (const hero of this.state.heroes) {
            if (hero.state !== 'dead' && hero.state !== 'cooldown') {
              hero.focusTargetId = event.targetEnemyId;
            }
          }
        } else if (commandType === 'retreat') {
          // All heroes retreat
          for (const hero of this.state.heroes) {
            if (hero.state !== 'dead' && hero.state !== 'cooldown') {
              hero.isRetreating = true;
              hero.focusTargetId = undefined;
              hero.commandTarget = undefined;
              hero.isCommanded = false;
            }
          }
        }
        break;
      }

      case 'ACTIVATE_SNAP':
        // Snap ability - deal massive damage to current boss
        if (this.state.currentBoss) {
          const snapDamage = Math.floor(this.state.currentBoss.maxHp * 0.5);
          this.damageCurrentBoss(snapDamage);
        }
        break;

      case 'CHOOSE_RELIC':
      case 'REROLL_RELICS':
        // Not applicable in Boss Rush mode
        break;
    }
  }

  /**
   * Damage the current boss
   */
  private damageCurrentBoss(damage: number): void {
    if (!this.state.currentBoss || this.state.bossRush.inIntermission) return;

    const actualDamage = Math.min(damage, this.state.currentBoss.hp);
    this.state.currentBoss.hp -= actualDamage;
    this.state.bossRush.currentBossDamage += actualDamage;
    this.state.bossRush.totalDamageDealt += actualDamage;

    // Check if boss is killed
    if (this.state.currentBoss.hp <= 0) {
      this.onBossKilled();
    }
  }

  /**
   * Handle boss killed
   */
  private onBossKilled(): void {
    // Process boss kill - updates bossRush state with rewards
    processBossKill(
      this.state.bossRush,
      this.state.tick,
      this.config.bossRush
    );

    // Start intermission
    startIntermission(this.state.bossRush, this.state.tick, this.config.bossRush);
    this.state.currentBoss = null;
  }

  /**
   * Update Boss Rush state (intermission, spawning)
   */
  private updateBossRush(): void {
    // Check if intermission ended
    if (
      this.state.bossRush.inIntermission &&
      this.state.tick >= this.state.bossRush.intermissionEndTick
    ) {
      endIntermission(this.state.bossRush, this.state.tick);
      this.spawnNextBoss();
    }
  }

  /**
   * Spawn the next boss
   */
  private spawnNextBoss(): void {
    const bossStats = getBossRushBossStats(
      this.state.bossRush.currentBossIndex,
      this.config.bossRush
    );

    this.state.currentBoss = {
      hp: bossStats.hp,
      maxHp: bossStats.hp,
      damage: bossStats.damage,
      lastAttackTick: this.state.tick,
    };

    this.state.bossRush.currentBossMaxHp = bossStats.hp;
  }

  /**
   * Update boss attack on fortress
   */
  private updateBossAttack(): void {
    if (!this.state.currentBoss || this.state.bossRush.inIntermission) return;

    // Boss attacks every second (30 ticks)
    const attackInterval = 30;
    if (this.state.tick - this.state.currentBoss.lastAttackTick >= attackInterval) {
      this.state.fortressHp -= this.state.currentBoss.damage;
      this.state.currentBoss.lastAttackTick = this.state.tick;

      if (this.state.fortressHp <= 0) {
        this.state.fortressHp = 0;
        // Don't end yet - let end condition check handle it
      }
    }
  }

  /**
   * Update fortress auto-attack on boss
   */
  private updateFortressAttack(): void {
    if (!this.state.currentBoss || this.state.bossRush.inIntermission) return;

    if (
      this.state.tick - this.state.fortressLastAttackTick >=
      this.config.fortressAttackInterval
    ) {
      const damage = Math.floor(
        this.config.fortressBaseDamage * (1 + this.state.modifiers.damageBonus)
      );
      this.damageCurrentBoss(damage);
      this.state.fortressLastAttackTick = this.state.tick;
    }
  }

  /**
   * Check if game should end
   */
  private checkEndCondition(): void {
    if (this.state.fortressHp <= 0) {
      this.state.ended = true;
    }
  }

  /**
   * Get checkpoints
   */
  getCheckpoints(): Checkpoint[] {
    return this.checkpoints;
  }

  /**
   * Get final hash
   */
  getFinalHash(): number {
    return computeBossRushFinalHash(this.state);
  }

  /**
   * Get summary
   */
  getSummary(): BossRushSummary {
    return {
      ...generateBossRushSummary(this.state.bossRush),
      timeSurvived: this.state.tick,
    } as BossRushSummary;
  }
}

// ============================================================================
// REPLAY FUNCTION
// ============================================================================

/**
 * Replay a Boss Rush session and verify checkpoints
 */
export function replayBossRush(options: BossRushVerifyOptions): BossRushReplayResult {
  const {
    seed,
    events,
    expectedCheckpoints,
    expectedFinalHash,
    config: configOverrides,
    loadout,
  } = options;

  // Build config
  const baseConfig = getDefaultBossRushConfig();
  const config: BossRushSimConfig = {
    ...baseConfig,
    ...configOverrides,
  };

  // Apply loadout
  if (loadout) {
    if (loadout.fortressClass) config.fortressClass = loadout.fortressClass;
    if (loadout.heroIds) config.startingHeroes = loadout.heroIds;
    if (loadout.turrets) config.startingTurrets = loadout.turrets;
  }

  // Create simulation
  const sim = new BossRushSimulation(seed, config);

  // Set events
  sim.setEvents(events);

  // Set checkpoint ticks (every 300 ticks)
  const maxTicks = 2 * 60 * 60 * config.tickHz;
  const checkpointTicks: number[] = [];
  for (let t = 300; t < maxTicks; t += 300) {
    checkpointTicks.push(t);
  }
  sim.setCheckpointTicks(checkpointTicks);

  // Validate event ticks are monotonic
  let lastTick = -1;
  for (const event of events) {
    if (event.tick < lastTick) {
      return {
        success: false,
        reason: 'TICKS_NOT_MONOTONIC',
        finalHash: 0,
        checkpoints: [],
        summary: sim.getSummary(),
      };
    }
    lastTick = event.tick;
  }

  // Run simulation
  sim.run(maxTicks);

  // Get generated checkpoints
  const generatedCheckpoints = sim.getCheckpoints();

  // Verify checkpoint chain
  for (const expected of expectedCheckpoints) {
    const generated = generatedCheckpoints.find((c) => c.tick === expected.tick);

    if (!generated) {
      continue; // Missing checkpoint at non-required tick is OK
    }

    if (generated.hash32 !== expected.hash32) {
      return {
        success: false,
        reason: 'CHECKPOINT_MISMATCH',
        finalHash: sim.getFinalHash(),
        checkpoints: generatedCheckpoints,
        summary: sim.getSummary(),
      };
    }

    if (generated.chainHash32 !== expected.chainHash32) {
      return {
        success: false,
        reason: 'CHECKPOINT_CHAIN_MISMATCH',
        finalHash: sim.getFinalHash(),
        checkpoints: generatedCheckpoints,
        summary: sim.getSummary(),
      };
    }
  }

  // Verify final hash
  const finalHash = sim.getFinalHash();
  if (finalHash !== expectedFinalHash) {
    return {
      success: false,
      reason: 'FINAL_HASH_MISMATCH',
      finalHash,
      checkpoints: generatedCheckpoints,
      summary: sim.getSummary(),
    };
  }

  return {
    success: true,
    finalHash,
    checkpoints: generatedCheckpoints,
    summary: sim.getSummary(),
  };
}
