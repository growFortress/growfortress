/**
 * Boss Rush Mode
 *
 * Arena mode where players face a gauntlet of bosses in rapid succession.
 * Primary ranking metric: total damage dealt (allows scoring even after death).
 */

import { EnemyType, PillarId } from './types.js';
import { ENEMY_ARCHETYPES } from './data/enemies.js';
import { FP } from './fixed.js';

// ============================================================================
// BOSS SEQUENCE
// ============================================================================

export interface BossRushBoss {
  /** Pillar this boss belongs to */
  pillarId: PillarId;
  /** Enemy type for this boss */
  bossType: EnemyType;
  /** Display name */
  name: string;
}

/**
 * Boss sequence for Boss Rush mode.
 * Players face each boss in order. After completing all bosses, the cycle repeats
 * with increased difficulty.
 */
export const BOSS_RUSH_SEQUENCE: BossRushBoss[] = [
  { pillarId: 'streets', bossType: 'mafia_boss', name: 'Mafia Boss' },
  { pillarId: 'science', bossType: 'ai_core', name: 'AI Core' },
  { pillarId: 'mutants', bossType: 'sentinel', name: 'Sentinel' },
  { pillarId: 'cosmos', bossType: 'cosmic_beast', name: 'Cosmic Beast' },
  { pillarId: 'magic', bossType: 'dimensional_being', name: 'Dimensional Being' },
  { pillarId: 'gods', bossType: 'titan', name: 'Titan' },
  { pillarId: 'gods', bossType: 'god', name: 'God' },
];

/** Number of bosses in one full cycle */
export const BOSS_RUSH_CYCLE_LENGTH = BOSS_RUSH_SEQUENCE.length;

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface BossRushConfig {
  /** Game mode identifier */
  mode: 'boss_rush';

  /** Ticks of intermission between bosses (90 = 3 sec at 30Hz) */
  intermissionTicks: number;

  /** HP/damage scaling per boss position (1.10 = +10% per boss) */
  scalingPerBoss: number;

  /** Multiplier applied per full cycle (2.0 = 2x stats after completing all bosses) */
  cycleScaling: number;

  /** Boss HP multiplier (bosses have more HP than normal enemies) */
  bossHpMultiplier: number;

  /** Boss damage multiplier */
  bossDamageMultiplier: number;

  /** Boss speed reduction (0.5 = half speed) */
  bossSpeedMultiplier: number;
}

/** Default Boss Rush configuration */
export const DEFAULT_BOSS_RUSH_CONFIG: BossRushConfig = {
  mode: 'boss_rush',
  intermissionTicks: 90, // 3 seconds at 30Hz
  scalingPerBoss: 1.10, // +10% per boss
  cycleScaling: 2.0, // 2x per cycle
  bossHpMultiplier: 5.0, // Bosses have 5x HP compared to base archetype
  bossDamageMultiplier: 2.0, // Bosses deal 2x damage
  bossSpeedMultiplier: 0.5, // Bosses move at half speed
};

// ============================================================================
// BOSS STATS
// ============================================================================

export interface BossRushBossStats {
  type: EnemyType;
  pillarId: PillarId;
  name: string;
  hp: number;
  damage: number;
  speed: number; // Fixed-point
  bossIndex: number;
  cycle: number;
}

/**
 * Get boss stats for Boss Rush mode.
 * Stats scale based on position in sequence and current cycle.
 *
 * @param bossIndex - Zero-based index of the boss (0 = first boss, 7 = first boss of cycle 2)
 * @param config - Boss Rush configuration
 * @returns Boss stats including HP, damage, speed
 */
export function getBossRushBossStats(
  bossIndex: number,
  config: BossRushConfig = DEFAULT_BOSS_RUSH_CONFIG
): BossRushBossStats {
  const sequenceIndex = bossIndex % BOSS_RUSH_CYCLE_LENGTH;
  const cycle = Math.floor(bossIndex / BOSS_RUSH_CYCLE_LENGTH);

  const boss = BOSS_RUSH_SEQUENCE[sequenceIndex];
  const archetype = ENEMY_ARCHETYPES[boss.bossType];

  // Position scaling: compound per boss
  const positionScale = Math.pow(config.scalingPerBoss, bossIndex);

  // Cycle scaling: exponential per cycle
  const cycleScale = Math.pow(config.cycleScaling, cycle);

  // Total scaling
  const totalScale = positionScale * cycleScale;

  return {
    type: boss.bossType,
    pillarId: boss.pillarId,
    name: boss.name,
    hp: Math.floor(archetype.baseHp * totalScale * config.bossHpMultiplier),
    damage: Math.floor(archetype.baseDamage * totalScale * config.bossDamageMultiplier),
    speed: FP.fromFloat((archetype.baseSpeed * config.bossSpeedMultiplier) / 30), // Convert to fixed-point
    bossIndex,
    cycle,
  };
}

/**
 * Get the boss at a specific index without calculating stats.
 */
export function getBossAtIndex(bossIndex: number): BossRushBoss {
  const sequenceIndex = bossIndex % BOSS_RUSH_CYCLE_LENGTH;
  return BOSS_RUSH_SEQUENCE[sequenceIndex];
}

/**
 * Get the current cycle number for a given boss index.
 */
export function getCycleForBossIndex(bossIndex: number): number {
  return Math.floor(bossIndex / BOSS_RUSH_CYCLE_LENGTH);
}

// ============================================================================
// REWARDS
// ============================================================================

export interface BossRushBossRewards {
  /** Gold earned from killing this boss */
  gold: number;
  /** Dust earned from killing this boss */
  dust: number;
  /** Chance to drop pillar essence (0-1) */
  essenceDropChance: number;
  /** Material ID for the essence drop */
  essenceMaterialId: string;
  /** XP earned */
  xp: number;
}

/**
 * Calculate rewards for killing a boss in Boss Rush mode.
 *
 * @param bossIndex - Zero-based index of the boss killed
 * @param config - Boss Rush configuration
 * @returns Rewards including gold, dust, XP, and material drop chances
 */
export function getBossRushBossRewards(
  bossIndex: number,
  _config: BossRushConfig = DEFAULT_BOSS_RUSH_CONFIG
): BossRushBossRewards {
  const sequenceIndex = bossIndex % BOSS_RUSH_CYCLE_LENGTH;
  const cycle = Math.floor(bossIndex / BOSS_RUSH_CYCLE_LENGTH);
  const boss = BOSS_RUSH_SEQUENCE[sequenceIndex];

  // Base rewards scale with boss position (dust reduced by 50%)
  const baseGold = 50 + bossIndex * 20;
  const baseDust = 12 + bossIndex * 5;
  const baseXp = 30 + bossIndex * 15;

  // Cycle bonus (+50% per cycle)
  const cycleBonus = 1 + cycle * 0.5;

  // Essence drop chance: 30% base, +10% per cycle, capped at 80%
  const essenceDropChance = Math.min(0.3 + cycle * 0.1, 0.8);

  return {
    gold: Math.floor(baseGold * cycleBonus),
    dust: Math.floor(baseDust * cycleBonus),
    xp: Math.floor(baseXp * cycleBonus),
    essenceDropChance,
    essenceMaterialId: `boss_essence_${boss.pillarId}`,
  };
}

// ============================================================================
// MILESTONE REWARDS
// ============================================================================

export interface BossRushMilestoneReward {
  /** Boss count threshold */
  bossCount: number;
  /** Materials awarded */
  materials: { id: string; count: number }[];
  /** Description of the milestone */
  description: string;
}

/**
 * Milestone rewards for reaching certain boss kill counts.
 */
export const BOSS_RUSH_MILESTONES: BossRushMilestoneReward[] = [
  {
    bossCount: 3,
    materials: [{ id: 'boss_essence_random', count: 1 }],
    description: 'First Blood - Kill 3 bosses',
  },
  {
    bossCount: 7,
    materials: [{ id: 'boss_trophy_gold', count: 1 }],
    description: 'Full Cycle - Complete one full boss rotation',
  },
  {
    bossCount: 14,
    materials: [
      { id: 'boss_trophy_gold', count: 2 },
      { id: 'boss_trophy_platinum', count: 1 },
    ],
    description: 'Double Trouble - Complete two full rotations',
  },
  {
    bossCount: 21,
    materials: [
      { id: 'boss_trophy_gold', count: 3 },
      { id: 'boss_trophy_platinum', count: 2 },
    ],
    description: 'Triple Threat - Complete three full rotations',
  },
];

/**
 * Get all milestones achieved for a given boss kill count.
 */
export function getAchievedMilestones(bossesKilled: number): BossRushMilestoneReward[] {
  return BOSS_RUSH_MILESTONES.filter(m => bossesKilled >= m.bossCount);
}

/**
 * Get the next milestone to achieve.
 */
export function getNextMilestone(bossesKilled: number): BossRushMilestoneReward | null {
  return BOSS_RUSH_MILESTONES.find(m => bossesKilled < m.bossCount) || null;
}

// ============================================================================
// BOSS RUSH STATE
// ============================================================================

export interface BossRushState {
  /** Current boss index (0-based, includes cycles) */
  currentBossIndex: number;

  /** Current cycle (0-based) */
  currentCycle: number;

  /** Number of bosses killed */
  bossesKilled: number;

  /** Total damage dealt to all bosses (primary score metric) */
  totalDamageDealt: number;

  /** Damage dealt to the current boss */
  currentBossDamage: number;

  /** Current boss's max HP (for damage tracking) */
  currentBossMaxHp: number;

  /** Whether currently in intermission between bosses */
  inIntermission: boolean;

  /** Tick when intermission ends */
  intermissionEndTick: number;

  /** Tick when current boss fight started */
  currentBossStartTick: number;

  /** Fastest boss kill time in ticks (optional stat) */
  fastestBossKillTicks: number | null;

  /** Gold earned this session */
  goldEarned: number;

  /** Dust earned this session */
  dustEarned: number;

  /** XP earned this session */
  xpEarned: number;

  /** Materials earned: { materialId: count } */
  materialsEarned: Record<string, number>;

  /** Achieved milestones (by bossCount) */
  achievedMilestones: number[];
}

/**
 * Create initial Boss Rush state.
 */
export function createBossRushState(): BossRushState {
  return {
    currentBossIndex: 0,
    currentCycle: 0,
    bossesKilled: 0,
    totalDamageDealt: 0,
    currentBossDamage: 0,
    currentBossMaxHp: 0,
    inIntermission: false,
    intermissionEndTick: 0,
    currentBossStartTick: 0,
    fastestBossKillTicks: null,
    goldEarned: 0,
    dustEarned: 0,
    xpEarned: 0,
    materialsEarned: {},
    achievedMilestones: [],
  };
}

/**
 * Record damage dealt to current boss.
 */
export function recordBossRushDamage(state: BossRushState, damage: number): void {
  state.currentBossDamage += damage;
  state.totalDamageDealt += damage;
}

/**
 * Process boss kill and calculate rewards.
 * @returns The rewards earned for this boss kill
 */
export function processBossKill(
  state: BossRushState,
  currentTick: number,
  config: BossRushConfig = DEFAULT_BOSS_RUSH_CONFIG
): BossRushBossRewards {
  const rewards = getBossRushBossRewards(state.currentBossIndex, config);

  // Add rewards
  state.goldEarned += rewards.gold;
  state.dustEarned += rewards.dust;
  state.xpEarned += rewards.xp;

  // Track boss kill time
  const killTime = currentTick - state.currentBossStartTick;
  if (state.fastestBossKillTicks === null || killTime < state.fastestBossKillTicks) {
    state.fastestBossKillTicks = killTime;
  }

  // Increment counters
  state.bossesKilled += 1;
  state.currentBossIndex += 1;
  state.currentCycle = getCycleForBossIndex(state.currentBossIndex);

  // Reset current boss damage
  state.currentBossDamage = 0;

  // Check milestones
  checkMilestones(state);

  return rewards;
}

/**
 * Check and award milestone rewards.
 */
function checkMilestones(state: BossRushState): void {
  for (const milestone of BOSS_RUSH_MILESTONES) {
    if (
      state.bossesKilled >= milestone.bossCount &&
      !state.achievedMilestones.includes(milestone.bossCount)
    ) {
      state.achievedMilestones.push(milestone.bossCount);

      // Award milestone materials
      for (const mat of milestone.materials) {
        state.materialsEarned[mat.id] = (state.materialsEarned[mat.id] || 0) + mat.count;
      }
    }
  }
}

/**
 * Start intermission between bosses.
 */
export function startIntermission(
  state: BossRushState,
  currentTick: number,
  config: BossRushConfig = DEFAULT_BOSS_RUSH_CONFIG
): void {
  state.inIntermission = true;
  state.intermissionEndTick = currentTick + config.intermissionTicks;
}

/**
 * End intermission and prepare for next boss.
 */
export function endIntermission(state: BossRushState, currentTick: number): void {
  state.inIntermission = false;
  state.currentBossStartTick = currentTick;
}

// ============================================================================
// SUMMARY
// ============================================================================

export interface BossRushSummary {
  totalDamageDealt: number;
  bossesKilled: number;
  cyclesCompleted: number;
  goldEarned: number;
  dustEarned: number;
  xpEarned: number;
  materialsEarned: Record<string, number>;
  fastestBossKillTicks: number | null;
  achievedMilestones: number[];
}

/**
 * Generate a summary of the Boss Rush session.
 */
export function generateBossRushSummary(state: BossRushState): BossRushSummary {
  return {
    totalDamageDealt: state.totalDamageDealt,
    bossesKilled: state.bossesKilled,
    cyclesCompleted: state.currentCycle,
    goldEarned: state.goldEarned,
    dustEarned: state.dustEarned,
    xpEarned: state.xpEarned,
    materialsEarned: { ...state.materialsEarned },
    fastestBossKillTicks: state.fastestBossKillTicks,
    achievedMilestones: [...state.achievedMilestones],
  };
}
