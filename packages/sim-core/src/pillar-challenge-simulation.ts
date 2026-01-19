/**
 * PillarChallengeSimulation
 *
 * Specjalizowana symulacja dla trybu Pillar Challenge.
 * Różnice od standardowej Simulation:
 * - Stała liczba fal (zależna od tieru)
 * - Limit czasu
 * - Skalowanie wrogów (HP/DMG/Speed)
 * - Brak losowych dropów (deterministyczne nagrody)
 * - Śledzenie performance bonuses
 * - Weryfikacja server-side
 */

import type { GameEvent } from '@arcade/protocol';
import { Xorshift32 } from './rng.js';
import { FP } from './fixed.js';
import type {
  GameState,
  SimConfig,
  Enemy,
  FortressClass,
  PillarId,
  EnemyType,
} from './types.js';
import { getLaneY, DEFAULT_PHYSICS_CONFIG } from './physics.js';
import { DEFAULT_MODIFIERS } from './data/relics.js';
import { getEnemyStats, getWaveComposition } from './data/enemies.js';
import { applyEvent } from './events.js';
import { fnv1a32, computeChainHash } from './checkpoints.js';
import {
  updateHeroes,
  updateTurrets,
  updateProjectiles,
  updateFortressSkills,
  calculateSynergyBonuses,
  calculatePillarModifiers,
  initializeHeroes,
  initializeTurrets,
  initializeActiveSkills,
} from './systems.js';
import { TURRET_SLOTS } from './data/turrets.js';
import { getPillarById } from './data/pillars.js';
import {
  calculateTotalHpBonus,
  calculateTotalDamageBonus,
  getMaxHeroSlots,
  getMaxTurretSlots,
  getTotalXpForLevel,
} from './data/fortress-progression.js';
import {
  PillarChallengeTier,
  PillarChallengeState,
  TIER_CONFIGS,
  createPillarChallengeState,
  finishChallengeSession,
  generateChallengeSummary,
  PillarChallengeSummary,
} from './pillar-challenge.js';

// ============================================================================
// TYPY
// ============================================================================

/**
 * Konfiguracja symulacji Pillar Challenge
 */
export interface PillarChallengeSimConfig extends SimConfig {
  /** ID filaru */
  pillarId: PillarId;
  /** Tier trudności */
  tier: PillarChallengeTier;
  /** Czy to pierwszy perfect clear na tym tierze */
  isFirstPerfectClear: boolean;
}

/**
 * Wynik weryfikacji replaya
 */
export interface PillarChallengeReplayResult {
  valid: boolean;
  state: PillarChallengeState;
  summary: PillarChallengeSummary;
  finalHash: number;
  error?: string;
}

/**
 * Opcje weryfikacji
 */
export interface PillarChallengeVerifyOptions {
  /** Oczekiwany końcowy hash */
  expectedFinalHash?: number;
  /** Checkpointy do weryfikacji */
  checkpoints?: { tick: number; hash: number }[];
}

/**
 * Checkpoint dla Pillar Challenge
 */
export interface PillarChallengeCheckpoint {
  tick: number;
  wave: number;
  fortressHp: number;
  fortressDamageTaken: number;
  heroesLost: number;
  wavesCleared: number;
  hash: number;
  chainHash: number;
}

/**
 * Rozszerzony wpis spawnu dla Pillar Challenge
 */
interface ChallengeWaveSpawnEntry {
  type: EnemyType;
  isElite: boolean;
  spawnTick: number;
  lane: number;
  hpMultiplier: number;
  damageMultiplier: number;
  speedMultiplier: number;
}

// ============================================================================
// STAŁE
// ============================================================================

const TICKS_PER_SECOND = 30;

// ============================================================================
// FUNKCJE POMOCNICZE
// ============================================================================

/**
 * Konwertuje liczbę na bajty
 */
function numberToBytes(n: number, byteCount: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < byteCount; i++) {
    bytes.push((n >>> (i * 8)) & 0xff);
  }
  return bytes;
}

/**
 * Dodaje liczbę do tablicy bajtów
 */
function appendNumber(data: number[], value: number, byteCount = 4): void {
  data.push(...numberToBytes(value, byteCount));
}

/**
 * Dodaje boolean do tablicy bajtów
 */
function appendBool(data: number[], value: boolean): void {
  data.push(value ? 1 : 0);
}

/**
 * Dodaje string do tablicy bajtów
 */
function appendString(data: number[], str: string): void {
  for (let i = 0; i < str.length; i++) {
    data.push(str.charCodeAt(i) & 0xff);
  }
}

/**
 * Tworzy domyślną konfigurację Pillar Challenge
 */
export function getDefaultPillarChallengeConfig(
  pillarId: PillarId,
  tier: PillarChallengeTier,
  baseConfig?: Partial<SimConfig>
): PillarChallengeSimConfig {
  const tierConfig = TIER_CONFIGS[tier];

  return {
    tickHz: 30,
    segmentSize: tierConfig.waveCount,
    startingWave: 0,
    fortressBaseHp: 200,
    fortressBaseDamage: 10,
    fortressAttackInterval: 15,
    skillCooldownTicks: 300,
    skillDamage: 50,
    skillRadius: FP.fromInt(8),
    waveIntervalTicks: 90,
    choiceDelayTicks: 30,
    relicsPerChoice: 0, // Brak relików w challenge
    fieldWidth: FP.fromInt(40),
    fieldHeight: FP.fromInt(15),
    fortressX: FP.fromInt(2),
    enemySpawnX: FP.fromInt(44), // Spawn off-screen so enemies emerge from portal
    enemyAttackRange: FP.fromInt(4),
    enemyAttackInterval: 30,
    availableRelics: [], // Brak relików

    commanderLevel: 1,
    progressionDamageBonus: 1.0,
    progressionGoldBonus: 1.0,
    startingGold: 0,

    fortressClass: 'natural' as FortressClass,
    startingHeroes: [],
    maxHeroSlots: 4,
    startingTurrets: [],
    turretSlots: TURRET_SLOTS.map((slot) => ({
      index: slot.id,
      x: FP.fromFloat(2 + slot.offsetX),
      y: FP.fromFloat(7 + slot.offsetY),
      isUnlocked: slot.id <= 6,
    })),

    currentPillar: pillarId,

    // Challenge-specific
    pillarId,
    tier,
    isFirstPerfectClear: false,

    ...baseConfig,
  };
}

/**
 * Tworzy stan gry dla Pillar Challenge
 */
export function createPillarChallengeGameState(
  seed: number,
  config: PillarChallengeSimConfig
): GameState {
  const rng = new Xorshift32(seed);

  // Oblicz HP z bonusem poziomu
  const hpBonus = calculateTotalHpBonus(config.commanderLevel);
  const maxHp = Math.floor((config.fortressBaseHp * hpBonus) / 16384);

  const maxHeroSlots = getMaxHeroSlots(config.commanderLevel);
  const heroes = initializeHeroes(config.startingHeroes || [], config.fortressX);

  const maxTurretSlots = getMaxTurretSlots(config.commanderLevel);
  const turrets = initializeTurrets(config.startingTurrets || []);

  const activeSkills = initializeActiveSkills(config.fortressClass, config.commanderLevel);

  const skillCooldowns: Record<string, number> = {};
  for (const skillId of activeSkills) {
    skillCooldowns[skillId] = 0;
  }

  return {
    tick: 0,
    wave: 0,
    ended: false,
    won: false,
    segmentStartWave: 0,
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
    gold: 0,
    dust: 0,
    relics: [],
    skillCooldown: 0,
    lastSkillTick: -config.skillCooldownTicks,
    activeSkills,
    skillCooldowns,
    inChoice: false,
    pendingChoice: null,
    pendingChoiceTick: 0,
    waveSpawnQueue: [],
    waveTotalEnemies: 0,
    waveSpawnedEnemies: 0,
    lastSpawnTick: 0,
    waveComplete: true,
    kills: 0,
    wavesCleared: 0,
    eliteKills: 0,
    goldEarned: 0,
    dustEarned: 0,
    modifiers: { ...DEFAULT_MODIFIERS },
    currentPillar: config.pillarId,
    pillarModifiers: {},
    heroes,
    nextHeroId: heroes.length + 1,
    heroSlots: maxHeroSlots,
    turrets,
    turretSlots: config.turretSlots.slice(0, maxTurretSlots),
    projectiles: [],
    nextProjectileId: 1,
    crystalFragments: [],
    collectedCrystals: [],
    matrixState: null,
    infinityStoneFragments: [],
    collectedStones: [],
    gauntletState: null,
    materials: {},
    synergyModifiers: {},
    stats: {
      totalDamageDealt: 0,
      enemiesKilledByHero: 0,
      enemiesKilledByTurret: 0,
      enemiesKilledByFortress: 0,
    },
    retryCount: 0,
    artifactsEarnedThisRun: [],
    segmentArtifactsEarned: [],
    pendingArtifactDrops: [],
    // Kill streak system
    killStreak: 0,
    lastKillTick: -1000,
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
 * Oblicza hash checkpointu dla Pillar Challenge
 */
export function computePillarChallengeCheckpointHash(
  state: GameState,
  challengeState: PillarChallengeState
): number {
  const data: number[] = [];

  appendNumber(data, state.tick);
  appendNumber(data, state.wave);
  appendNumber(data, state.fortressHp);
  appendNumber(data, state.fortressMaxHp);
  appendNumber(data, challengeState.fortressDamageTaken);
  appendNumber(data, challengeState.heroesLost);
  appendNumber(data, challengeState.wavesCleared);
  appendNumber(data, state.rngState);
  appendNumber(data, state.kills);

  return fnv1a32(data);
}

/**
 * Oblicza końcowy hash sesji
 */
export function computePillarChallengeFinalHash(
  challengeState: PillarChallengeState,
  lastChainHash: number
): number {
  const data: number[] = [];

  appendString(data, challengeState.sessionId);
  appendString(data, challengeState.pillarId);
  appendString(data, challengeState.tier);
  appendNumber(data, challengeState.wavesCleared);
  appendNumber(data, challengeState.fortressDamageTaken);
  appendNumber(data, challengeState.heroesLost);
  appendBool(data, challengeState.victory);
  appendNumber(data, lastChainHash);

  return fnv1a32(data);
}

// ============================================================================
// KLASA SYMULACJI
// ============================================================================

/**
 * Klasa symulacji Pillar Challenge
 */
export class PillarChallengeSimulation {
  state: GameState;
  config: PillarChallengeSimConfig;
  challengeState: PillarChallengeState;

  private rng: Xorshift32;
  private eventQueue: GameEvent[] = [];
  private eventIndex = 0;
  private checkpoints: PillarChallengeCheckpoint[] = [];
  private lastChainHash = 0;
  private checkpointTicks: Set<number> = new Set();

  private tierConfig;
  private timeLimitTicks: number;
  private challengeWaveQueue: ChallengeWaveSpawnEntry[] = [];

  constructor(
    seed: number,
    sessionId: string,
    userId: string,
    config: PillarChallengeSimConfig
  ) {
    this.config = config;
    this.tierConfig = TIER_CONFIGS[config.tier];
    this.timeLimitTicks = this.tierConfig.timeLimit * TICKS_PER_SECOND;

    this.state = createPillarChallengeGameState(seed, config);
    this.rng = new Xorshift32(seed);

    // Utwórz stan challenge
    this.challengeState = createPillarChallengeState(
      sessionId,
      userId,
      config.pillarId,
      config.tier,
      seed,
      this.state.fortressMaxHp
    );

    // Aplikuj bonusy poziomu
    const commanderDamageBonus = calculateTotalDamageBonus(config.commanderLevel);
    this.state.modifiers.damageBonus += (commanderDamageBonus / 16384) - 1;
  }

  /**
   * Ustawia eventy do przetworzenia podczas symulacji
   */
  setEvents(events: GameEvent[]): void {
    this.eventQueue = [...events].sort((a, b) => a.tick - b.tick);
    this.eventIndex = 0;
  }

  /**
   * Ustawia ticki dla checkpointów
   */
  setCheckpointTicks(ticks: number[]): void {
    this.checkpointTicks = new Set(ticks);
  }

  /**
   * Wykonuje jeden tick symulacji
   */
  step(): void {
    if (this.state.ended) return;

    // Synchronizuj RNG
    this.rng.setState(this.state.rngState);

    // Sprawdź limit czasu
    if (this.state.tick >= this.timeLimitTicks) {
      this.endChallenge(false);
      return;
    }

    // Przetwórz eventy
    this.processEvents();

    // Utwórz checkpoint jeśli trzeba
    if (this.checkpointTicks.has(this.state.tick)) {
      this.createCheckpoint();
    }

    // Aktualizuj synergię i modyfikatory filaru
    this.updateSynergyModifiers();
    if (this.state.tick % 30 === 0) {
      this.updatePillarModifiers();
    }

    // Śledź HP przed aktualizacją
    const hpBefore = this.state.fortressHp;

    // Aktualizuj stan gry
    this.updateWaves();
    this.updateEnemies();
    this.updateFortressAttack();

    // Aktualizuj systemy
    updateHeroes(this.state, this.config, this.rng);
    updateTurrets(this.state, this.config, this.rng);
    updateProjectiles(this.state, this.config);
    updateFortressSkills(this.state, this.config, this.rng);

    // Śledź obrażenia twierdzy
    const hpLost = hpBefore - this.state.fortressHp;
    if (hpLost > 0) {
      this.challengeState.fortressDamageTaken += hpLost;
      this.challengeState.fortressCurrentHp = this.state.fortressHp;
    }

    // Sprawdź warunki końcowe
    this.checkEndConditions();

    // Zapisz stan RNG
    this.state.rngState = this.rng.getState();

    // Następny tick
    this.state.tick++;
  }

  /**
   * Uruchamia symulację do końca lub limitu ticków
   */
  runToCompletion(maxTicks?: number): void {
    const limit = maxTicks ?? this.timeLimitTicks + 1000;
    let ticks = 0;

    while (!this.state.ended && ticks < limit) {
      this.step();
      ticks++;
    }

    // Jeśli nie zakończono, zakończ z błędem
    if (!this.state.ended) {
      this.endChallenge(false);
    }
  }

  /**
   * Pobiera aktualny stan challenge
   */
  getChallengeState(): PillarChallengeState {
    return this.challengeState;
  }

  /**
   * Pobiera checkpointy
   */
  getCheckpoints(): PillarChallengeCheckpoint[] {
    return this.checkpoints;
  }

  /**
   * Pobiera końcowy hash
   */
  getFinalHash(): number {
    return computePillarChallengeFinalHash(this.challengeState, this.lastChainHash);
  }

  /**
   * Generuje podsumowanie sesji
   */
  getSummary(): PillarChallengeSummary {
    return generateChallengeSummary(this.challengeState);
  }

  // ==========================================================================
  // METODY PRYWATNE
  // ==========================================================================

  private processEvents(): void {
    while (
      this.eventIndex < this.eventQueue.length &&
      this.eventQueue[this.eventIndex].tick <= this.state.tick
    ) {
      const event = this.eventQueue[this.eventIndex];
      applyEvent(event, this.state, this.config, () => []);
      this.eventIndex++;
    }
  }

  private createCheckpoint(): void {
    const hash = computePillarChallengeCheckpointHash(this.state, this.challengeState);
    const chainHash = computeChainHash(this.lastChainHash, this.state.tick, hash);

    this.checkpoints.push({
      tick: this.state.tick,
      wave: this.state.wave,
      fortressHp: this.state.fortressHp,
      fortressDamageTaken: this.challengeState.fortressDamageTaken,
      heroesLost: this.challengeState.heroesLost,
      wavesCleared: this.challengeState.wavesCleared,
      hash,
      chainHash,
    });

    this.lastChainHash = chainHash;
  }

  private updateSynergyModifiers(): void {
    const previousMaxHpBonus = this.state.synergyModifiers.maxHpBonus ?? 0;
    const safePreviousMultiplier = 1 + previousMaxHpBonus;
    const baseMaxHp = Math.floor(this.state.fortressMaxHp / safePreviousMultiplier);

    this.state.synergyModifiers = calculateSynergyBonuses(this.state);

    const nextMaxHpBonus = this.state.synergyModifiers.maxHpBonus ?? 0;
    const nextMultiplier = 1 + nextMaxHpBonus;

    if (nextMultiplier !== safePreviousMultiplier) {
      const newMaxHp = Math.floor(baseMaxHp * nextMultiplier);
      if (newMaxHp !== this.state.fortressMaxHp) {
        const hpDelta = newMaxHp - this.state.fortressMaxHp;
        this.state.fortressMaxHp = newMaxHp;
        this.challengeState.fortressMaxHp = newMaxHp;

        if (hpDelta > 0) {
          this.state.fortressHp = Math.min(this.state.fortressHp + hpDelta, newMaxHp);
        } else if (this.state.fortressHp > newMaxHp) {
          this.state.fortressHp = newMaxHp;
        }
        this.challengeState.fortressCurrentHp = this.state.fortressHp;
      }
    }
  }

  private updatePillarModifiers(): void {
    this.state.pillarModifiers = calculatePillarModifiers(this.state);
  }

  private updateWaves(): void {
    // Sprawdź czy rozpocząć nową falę
    if (this.state.waveComplete && !this.state.inChoice) {
      // Sprawdź czy osiągnięto limit fal
      if (this.challengeState.wavesCleared >= this.tierConfig.waveCount) {
        this.endChallenge(true);
        return;
      }

      this.startNextWave();
    }

    // Spawnuj wrogów z kolejki
    if (this.challengeWaveQueue.length > 0) {
      const nextSpawn = this.challengeWaveQueue[0];
      if (this.state.tick >= nextSpawn.spawnTick) {
        this.spawnEnemy(nextSpawn);
        this.challengeWaveQueue.shift();
      }
    }

    // Sprawdź czy fala zakończona
    if (
      !this.state.waveComplete &&
      this.challengeWaveQueue.length === 0 &&
      this.state.enemies.length === 0
    ) {
      this.completeWave();
    }
  }

  private startNextWave(): void {
    this.state.wave++;
    this.state.waveComplete = false;

    // Pobierz kompozycję fali dla filaru
    const pillar = getPillarById(this.config.pillarId);
    const effectiveWave = pillar
      ? pillar.waveRange.start + ((this.state.wave - 1) % (pillar.waveRange.end - pillar.waveRange.start + 1))
      : this.state.wave;

    const composition = getWaveComposition(effectiveWave, this.config.tickHz);

    // Aplikuj skalowanie wrogów według tieru
    const scaledEntries: ChallengeWaveSpawnEntry[] = [];
    let spawnIndex = 0;

    for (const enemyDef of composition.enemies) {
      // Szansa na elite bazując na fali
      const eliteChance = Math.min(0.05 + this.state.wave * 0.005, 0.3);

      for (let c = 0; c < enemyDef.count; c++) {
        const isElite = this.rng.next() / 0xffffffff < eliteChance;

        scaledEntries.push({
          type: enemyDef.type,
          isElite,
          spawnTick: this.state.tick + this.config.waveIntervalTicks + spawnIndex * 15,
          lane: this.rng.next() % 3,
          hpMultiplier: FP.mul(FP.ONE, this.tierConfig.enemyHpMultiplier),
          damageMultiplier: FP.mul(FP.ONE, this.tierConfig.enemyDmgMultiplier),
          speedMultiplier: FP.mul(FP.ONE, this.tierConfig.enemySpeedMultiplier),
        });
        spawnIndex++;
      }
    }

    this.challengeWaveQueue = scaledEntries;
    this.state.waveTotalEnemies = scaledEntries.length;
    this.state.waveSpawnedEnemies = 0;
    this.state.lastSpawnTick = this.state.tick;
  }

  private spawnEnemy(entry: ChallengeWaveSpawnEntry): void {
    const baseStats = getEnemyStats(entry.type, this.state.wave, entry.isElite);

    // Aplikuj mnożniki tieru
    const hpMult = entry.hpMultiplier ?? FP.ONE;
    const dmgMult = entry.damageMultiplier ?? FP.ONE;
    const spdMult = entry.speedMultiplier ?? FP.ONE;

    // baseStats.hp jest już przeskalowane dla fali
    const scaledHp = Math.floor((baseStats.hp * hpMult) / FP.ONE);
    const scaledDmg = Math.floor((baseStats.damage * dmgMult) / FP.ONE);
    const scaledSpd = FP.mul(baseStats.speed, spdMult);

    // Spawn at center (portal), move to target lane
    const targetLane = entry.lane ?? 1;
    const spawnLane = 1; // Center - portal position
    const spawnY = getLaneY(spawnLane, DEFAULT_PHYSICS_CONFIG);
    // Add random Y offset so enemies spread out when exiting portal
    const yOffset = FP.fromFloat((Math.random() - 0.5) * 8);
    const initialY = FP.add(spawnY, yOffset);

    const enemy: Enemy = {
      id: this.state.nextEnemyId++,
      type: entry.type,
      x: this.config.enemySpawnX,
      y: initialY,
      vx: 0,
      vy: 0,
      hp: scaledHp,
      maxHp: scaledHp,
      damage: scaledDmg,
      speed: scaledSpd,
      baseSpeed: scaledSpd, // Store original speed for effect recovery
      radius: FP.fromFloat(0.5),
      mass: FP.ONE,
      lastAttackTick: 0,
      isElite: entry.isElite,
      hitFlashTicks: 0,
      lane: spawnLane,
      targetLane: targetLane,
      canSwitchLane: false, // No lane switching in Pillar Challenge
      laneSwitchCooldown: 0,
      // Pathfinding variation for unique movement
      laneChangeSpeed: 0.3 + Math.random() * 0.6,
      pathDrift: (Math.random() - 0.5) * 0.6,
      laneChangeDelay: Math.floor(Math.random() * 30),
      // Spawn animation
      spawnTick: this.state.tick,
      activeEffects: [],
    };

    this.state.enemies.push(enemy);
    this.state.waveSpawnedEnemies++;
  }

  private completeWave(): void {
    this.state.waveComplete = true;
    this.state.wavesCleared++;
    this.challengeState.wavesCleared++;
    this.challengeState.currentWave = this.state.wave;
  }

  private updateEnemies(): void {
    const enemiesToRemove: number[] = [];

    for (const enemy of this.state.enemies) {
      // Aktualizuj status effects
      this.updateEnemyStatusEffects(enemy);

      // Move towards target lane (for spawning from portal)
      // Each enemy has unique pathfinding: different speeds, delays, and drift
      if (enemy.lane !== enemy.targetLane) {
        // Wait for lane change delay (each enemy starts lane change at different time)
        if (enemy.laneChangeDelay > 0) {
          enemy.laneChangeDelay--;
          // Add small drift while waiting - enemies spread out from portal
          const driftVy = FP.mul(enemy.speed, FP.fromFloat(enemy.pathDrift * 0.5));
          enemy.vy = driftVy;
          enemy.y = FP.add(enemy.y, enemy.vy);
        } else {
          const targetY = getLaneY(enemy.targetLane, DEFAULT_PHYSICS_CONFIG);
          const diff = FP.sub(targetY, enemy.y);
          // Each enemy has unique lane change speed (0.3-0.9)
          const switchSpeed = FP.mul(enemy.speed, FP.fromFloat(enemy.laneChangeSpeed));

          if (Math.abs(FP.toFloat(diff)) < 2) {
            enemy.y = targetY;
            enemy.lane = enemy.targetLane;
            enemy.vy = 0;
          } else {
            // Add drift to make paths more organic
            const driftAmount = FP.mul(enemy.speed, FP.fromFloat(enemy.pathDrift * 0.3));
            if (diff > 0) {
              enemy.vy = FP.add(switchSpeed, driftAmount);
            } else {
              enemy.vy = FP.add(FP.mul(switchSpeed, FP.fromInt(-1)), driftAmount);
            }
            enemy.y = FP.add(enemy.y, enemy.vy);
          }
        }
      } else {
        // Already in target lane - add small random drift for organic movement
        const driftVy = FP.mul(enemy.speed, FP.fromFloat(enemy.pathDrift * 0.15));
        enemy.vy = driftVy;
        enemy.y = FP.add(enemy.y, enemy.vy);
      }

      // Ruch wroga
      const targetX = this.config.enemyAttackRange;
      if (enemy.x > targetX) {
        // Ruch w kierunku twierdzy
        const effectiveSpeed = this.calculateEffectiveSpeed(enemy);
        enemy.vx = -effectiveSpeed;
        enemy.x = enemy.x + enemy.vx;

        if (enemy.x < targetX) {
          enemy.x = targetX;
          enemy.vx = 0;
        }
      } else {
        // W zasięgu ataku - atakuj twierdzę
        enemy.vx = 0;

        const attackInterval = this.config.enemyAttackInterval ?? 30;
        if (this.state.tick - enemy.lastAttackTick >= attackInterval) {
          this.enemyAttackFortress(enemy);
          enemy.lastAttackTick = this.state.tick;
        }
      }

      // Sprawdź czy wróg zginął
      if (enemy.hp <= 0) {
        enemiesToRemove.push(enemy.id);
      }
    }

    // Usuń martwych wrogów
    for (const id of enemiesToRemove) {
      this.killEnemyById(id);
    }
  }

  private calculateEffectiveSpeed(enemy: Enemy): number {
    // Użyj baseSpeed jako podstawy (jeśli istnieje)
    let speed = enemy.baseSpeed ?? enemy.speed;

    // Sprawdź hard CC (freeze/stun)
    const hasHardCC = enemy.activeEffects.some(
      e => (e.type === 'freeze' || e.type === 'stun') && e.remainingTicks > 0
    );
    if (hasHardCC) {
      return 0;
    }

    // Aplikuj slow ze status effects
    for (const effect of enemy.activeEffects) {
      if (effect.type === 'slow' && effect.strength > 0 && effect.remainingTicks > 0) {
        // strength jest zapisane jako decimal (0.3 = 30% slow)
        const slowMult = 1 - effect.strength;
        speed = FP.fromFloat(FP.toFloat(speed) * slowMult);
      }
    }

    return speed;
  }

  private updateEnemyStatusEffects(enemy: Enemy): void {
    // Zmniejsz pozostałe ticki i usuń wygasłe efekty
    enemy.activeEffects = enemy.activeEffects
      .map(effect => ({ ...effect, remainingTicks: effect.remainingTicks - 1 }))
      .filter(effect => effect.remainingTicks > 0);

    // Aplikuj DOT
    for (const effect of enemy.activeEffects) {
      if (effect.type === 'burn' && effect.strength && this.state.tick % 30 === 0) {
        enemy.hp -= effect.strength;
      }
    }
  }

  private enemyAttackFortress(enemy: Enemy): void {
    // Aplikuj modyfikatory obrażeń filaru
    let damage = enemy.damage;

    // Obniżenie z pillar defense bonus (jeśli istnieje)
    const pillarDefense = (this.state.pillarModifiers as Record<string, number>).defenseBonus ?? 0;
    damage = Math.floor(damage * (1 - pillarDefense));

    this.state.fortressHp -= damage;

    if (this.state.fortressHp <= 0) {
      this.state.fortressHp = 0;
      this.endChallenge(false);
    }
  }

  private killEnemyById(id: number): void {
    const index = this.state.enemies.findIndex(e => e.id === id);
    if (index !== -1) {
      const enemy = this.state.enemies[index];
      this.state.enemies.splice(index, 1);
      this.state.kills++;
      this.challengeState.totalDamageDealt += enemy.maxHp;

      if (enemy.isElite) {
        this.state.eliteKills++;
      }
    }
  }

  private updateFortressAttack(): void {
    // Podstawowy atak twierdzy
    if (this.state.tick - this.state.fortressLastAttackTick >= this.config.fortressAttackInterval) {
      // Znajdź najbliższego wroga
      let closest: Enemy | null = null;
      let closestDist = Infinity;

      for (const enemy of this.state.enemies) {
        const dist = FP.toFloat(enemy.x);
        if (dist < closestDist) {
          closest = enemy;
          closestDist = dist;
        }
      }

      if (closest) {
        // Oblicz obrażenia z modyfikatorami
        const baseDamage = this.config.fortressBaseDamage;
        const damageBonus = this.state.modifiers.damageBonus;
        const damage = Math.floor(baseDamage * (1 + damageBonus));

        closest.hp -= damage;
        closest.hitFlashTicks = 3;

        if (closest.hp <= 0) {
          this.killEnemyById(closest.id);
          this.state.stats.enemiesKilledByFortress++;
        }

        this.state.fortressLastAttackTick = this.state.tick;
      }
    }
  }

  private checkEndConditions(): void {
    // Już zakończone?
    if (this.state.ended) return;

    // Twierdza zniszczona
    if (this.state.fortressHp <= 0) {
      this.endChallenge(false);
      return;
    }

    // Wszystkie fale ukończone
    if (
      this.challengeState.wavesCleared >= this.tierConfig.waveCount &&
      this.state.enemies.length === 0 &&
      this.challengeWaveQueue.length === 0
    ) {
      this.endChallenge(true);
      return;
    }

    // Limit czasu
    if (this.state.tick >= this.timeLimitTicks) {
      this.endChallenge(false);
    }
  }

  private endChallenge(victory: boolean): void {
    this.state.ended = true;
    this.state.won = victory;

    // Finalizuj stan challenge
    this.challengeState = finishChallengeSession(
      this.challengeState,
      victory,
      this.config.isFirstPerfectClear
    );

    // Utwórz końcowy checkpoint
    this.createCheckpoint();
  }

  /**
   * Śledzi śmierć bohatera (wywoływane z zewnątrz przez system heroes)
   */
  recordHeroDeath(): void {
    this.challengeState.heroesLost++;
  }
}

// ============================================================================
// FUNKCJE REPLAY
// ============================================================================

/**
 * Weryfikuje replay sesji Pillar Challenge
 */
export function replayPillarChallenge(
  seed: number,
  sessionId: string,
  userId: string,
  config: PillarChallengeSimConfig,
  events: GameEvent[],
  options?: PillarChallengeVerifyOptions
): PillarChallengeReplayResult {
  const sim = new PillarChallengeSimulation(seed, sessionId, userId, config);

  // Ustaw eventy
  sim.setEvents(events);

  // Ustaw checkpoint ticks jeśli podano
  if (options?.checkpoints) {
    sim.setCheckpointTicks(options.checkpoints.map(c => c.tick));
  }

  // Uruchom symulację
  sim.runToCompletion();

  // Pobierz wyniki
  const challengeState = sim.getChallengeState();
  const summary = sim.getSummary();
  const finalHash = sim.getFinalHash();

  // Weryfikuj hash jeśli podano oczekiwany
  if (options?.expectedFinalHash !== undefined) {
    if (finalHash !== options.expectedFinalHash) {
      return {
        valid: false,
        state: challengeState,
        summary,
        finalHash,
        error: `Hash mismatch: expected ${options.expectedFinalHash}, got ${finalHash}`,
      };
    }
  }

  // Weryfikuj checkpointy jeśli podano
  if (options?.checkpoints) {
    const simCheckpoints = sim.getCheckpoints();

    for (const expected of options.checkpoints) {
      const actual = simCheckpoints.find(c => c.tick === expected.tick);
      if (!actual) {
        return {
          valid: false,
          state: challengeState,
          summary,
          finalHash,
          error: `Missing checkpoint at tick ${expected.tick}`,
        };
      }
      if (actual.chainHash !== expected.hash) {
        return {
          valid: false,
          state: challengeState,
          summary,
          finalHash,
          error: `Checkpoint hash mismatch at tick ${expected.tick}: expected ${expected.hash}, got ${actual.chainHash}`,
        };
      }
    }
  }

  return {
    valid: true,
    state: challengeState,
    summary,
    finalHash,
  };
}
