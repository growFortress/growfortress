/**
 * Test factories for creating test data
 */
import type { GameEvent } from '@arcade/protocol';
import {
  GameState,
  SimConfig,
  Enemy,
  EnemyType,
  ActiveRelic,
  ModifierSet,
  RelicChoice,
} from '../../types.js';
import { DEFAULT_MODIFIERS } from '../../data/relics.js';
import { FP } from '../../fixed.js';

/**
 * Create a GameState with optional overrides
 */
export function createGameState(overrides: Partial<GameState> = {}): GameState {
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
    rngState: 12345,
    fortressHp: 100,
    fortressMaxHp: 100,
    fortressLastAttackTick: 0,
    fortressClass: 'natural',
    commanderLevel: 1,
    levelsGainedInSession: 0,
    sessionXpEarned: 0,
    xpAtSessionStart: 0,
    enemies: [],
    nextEnemyId: 1,
    gold: 0,
    dust: 0,
    relics: [],
    skillCooldown: 0,
    lastSkillTick: -300,
    activeSkills: [],
    skillCooldowns: {},
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
    currentPillar: 'streets',
    pillarModifiers: {},
    heroes: [],
    nextHeroId: 1,
    heroSlots: 1,
    turrets: [],
    turretSlots: [],
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
    militiaSpawnCooldowns: {
      infantry: 0,
      archer: 0,
      shield_bearer: 0,
    },
    maxMilitiaCount: 8,
    // Directed wave system
    earlyRelicOffered: false,
    ...overrides,
  };
}

/**
 * Create an Enemy with optional overrides
 */
export function createEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 1,
    type: 'runner',
    hp: 20,
    maxHp: 20,
    x: FP.fromInt(15),
    y: FP.fromFloat(7.5), // Center of field
    vx: FP.fromFloat(-0.1), // Moving left
    vy: 0,
    speed: FP.fromFloat(0.1),
    baseSpeed: FP.fromFloat(0.1),
    radius: FP.fromFloat(0.8),
    mass: FP.fromFloat(1.0),
    damage: 5,
    isElite: false,
    hitFlashTicks: 0,
    lastAttackTick: 0,
    lane: 1, // Middle lane
    targetLane: 1, // Same as current lane
    canSwitchLane: false, // No lane switching by default in tests
    laneSwitchCooldown: 0,
    // Pathfinding variation
    laneChangeSpeed: 0.6,
    pathDrift: 0,
    laneChangeDelay: 0,
    // Spawn animation
    spawnTick: 0,
    activeEffects: [],
    ...overrides,
  };
}

/**
 * Create an ActiveRelic
 */
export function createActiveRelic(
  relicId: string,
  wave: number = 1,
  tick: number = 0
): ActiveRelic {
  return {
    id: relicId,
    acquiredWave: wave,
    acquiredTick: tick,
  };
}

/**
 * Create a SimConfig with optional overrides
 */
export function createSimConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  return {
    tickHz: 30,
    segmentSize: 5,
    startingWave: 0,
    fortressBaseHp: 100,
    fortressBaseDamage: 10,
    fortressAttackInterval: 15,
    skillCooldownTicks: 300,
    skillDamage: 50,
    skillRadius: FP.fromInt(8),
    waveIntervalTicks: 90,
    choiceDelayTicks: 30,
    relicsPerChoice: 3,
    fieldWidth: FP.fromInt(40),
    fieldHeight: FP.fromInt(15),
    fortressX: FP.fromInt(2),
    enemySpawnX: FP.fromInt(38),
    enemyAttackRange: FP.fromInt(4),
    enemyAttackInterval: 30,
    availableRelics: [
      'splash-master',
      'piercing-shot',
      'chain-lightning',
      'executioner',
      'critical-engine',
      'gold-rush',
      'fortress-shield',
      'quick-reload',
      'damage-boost',
      'speed-demon',
    ],
    progressionDamageBonus: 1.0,
    progressionGoldBonus: 1.0,
    startingGold: 0,
    fortressClass: 'natural',
    startingHeroes: [],
    maxHeroSlots: 4,
    startingTurrets: [],
    turretSlots: [],
    currentPillar: 'streets',
    pillarRotation: true,
    commanderLevel: 1,
    ...overrides,
  };
}

/**
 * Create a ModifierSet with optional overrides
 */
export function createModifiers(overrides: Partial<ModifierSet> = {}): ModifierSet {
  return {
    ...DEFAULT_MODIFIERS,
    ...overrides,
  };
}

/**
 * Create a RelicChoice
 */
export function createRelicChoice(
  options: string[] = ['damage-boost', 'fortress-shield', 'speed-demon'],
  wave: number = 1,
  offeredTick: number = 100
): RelicChoice {
  return {
    options,
    wave,
    offeredTick,
  };
}

/**
 * Create a CHOOSE_RELIC event
 */
export function createChooseRelicEvent(
  tick: number,
  wave: number,
  optionIndex: number
): GameEvent {
  return {
    type: 'CHOOSE_RELIC',
    tick,
    wave,
    optionIndex,
  };
}

/**
 * Create an ACTIVATE_SNAP event
 */
export function createActivateSnapEvent(tick: number): GameEvent {
  return {
    type: 'ACTIVATE_SNAP',
    tick,
  };
}

/**
 * Create a REROLL_RELICS event
 */
export function createRerollRelicsEvent(tick: number): GameEvent {
  return {
    type: 'REROLL_RELICS',
    tick,
  };
}

/**
 * Create multiple enemies of specified type
 */
export function createEnemies(
  count: number,
  type: EnemyType = 'runner',
  baseOverrides: Partial<Enemy> = {}
): Enemy[] {
  return Array.from({ length: count }, (_, i) =>
    createEnemy({
      id: i + 1,
      type,
      x: FP.fromInt(15 + i),
      ...baseOverrides,
    })
  );
}

/**
 * Create a state in choice mode
 */
export function createStateInChoiceMode(
  options: string[] = ['sharpened-blades', 'iron-hide', 'swift-strikes'],
  wave: number = 1,
  tick: number = 100
): GameState {
  return createGameState({
    tick,
    wave,
    inChoice: true,
    pendingChoice: createRelicChoice(options, wave, tick),
    pendingChoiceTick: tick,
    gold: 50,
  });
}

/**
 * Create a state with enemies
 */
export function createStateWithEnemies(
  enemyCount: number = 3,
  enemyType: EnemyType = 'runner'
): GameState {
  return createGameState({
    enemies: createEnemies(enemyCount, enemyType),
    nextEnemyId: enemyCount + 1,
  });
}

/**
 * Create a state with relics
 */
export function createStateWithRelics(relicIds: string[]): GameState {
  return createGameState({
    relics: relicIds.map((id, i) => createActiveRelic(id, i + 1, i * 100)),
  });
}
