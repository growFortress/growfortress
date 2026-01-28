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

  /** Boss speed reduction (0.5 = half speed) - unused in stationary mode */
  bossSpeedMultiplier: number;

  // ============================================================================
  // STATIONARY BOSS MODE
  // ============================================================================

  /** Boss spawn X position in fixed-point (distance from left edge) */
  bossSpawnX?: number;

  /** Boss attack cooldown in ticks (default: 60 = 2 seconds at 30Hz) */
  bossAttackCooldownTicks?: number;

  /** Boss projectile travel time in ticks (default: 45 = 1.5 seconds at 30Hz) */
  bossProjectileTravelTicks?: number;
}

/** Default Boss Rush configuration */
export const DEFAULT_BOSS_RUSH_CONFIG: BossRushConfig = {
  mode: 'boss_rush',
  intermissionTicks: 300, // 10 seconds at 30Hz (extended for relic/shop selection)
  scalingPerBoss: 1.10, // +10% per boss
  cycleScaling: 2.0, // 2x per cycle
  bossHpMultiplier: 8.0, // Bosses have 8x HP (increased - stationary target)
  bossDamageMultiplier: 1.5, // Bosses deal 1.5x damage (reduced - ranged attacks)
  bossSpeedMultiplier: 0.5, // Unused in stationary mode
  // Stationary boss settings
  bossSpawnX: FP.fromInt(35), // 35 units from left (near right edge of 40-unit field)
  bossAttackCooldownTicks: 60, // 2 seconds between attacks
  bossProjectileTravelTicks: 45, // 1.5 seconds travel time
};

// ============================================================================
// BOSS RUSH SHOP
// ============================================================================

export interface BossRushShopItem {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  descriptionKey: string;
  cost: number;
  type: 'heal' | 'reroll' | 'stat_boost' | 'relic_upgrade';
  effect: {
    healPercent?: number;
    statBonus?: { stat: string; value: number };
    relicSlot?: number;
  };
}

/**
 * Available shop items in Boss Rush mode
 */
export const BOSS_RUSH_SHOP_ITEMS: BossRushShopItem[] = [
  {
    id: 'heal_small',
    name: 'Minor Repair',
    nameKey: 'data:bossRush.shop.healSmall.name',
    description: 'Restore 25% fortress HP',
    descriptionKey: 'data:bossRush.shop.healSmall.description',
    cost: 100,
    type: 'heal',
    effect: { healPercent: 0.25 },
  },
  {
    id: 'heal_large',
    name: 'Major Repair',
    nameKey: 'data:bossRush.shop.healLarge.name',
    description: 'Restore 50% fortress HP',
    descriptionKey: 'data:bossRush.shop.healLarge.description',
    cost: 250,
    type: 'heal',
    effect: { healPercent: 0.50 },
  },
  {
    id: 'reroll_relics',
    name: 'Relic Reroll',
    nameKey: 'data:bossRush.shop.rerollRelics.name',
    description: 'Get 3 new relic options',
    descriptionKey: 'data:bossRush.shop.rerollRelics.description',
    cost: 75,
    type: 'reroll',
    effect: {},
  },
  {
    id: 'damage_boost',
    name: 'Power Cell',
    nameKey: 'data:bossRush.shop.damageBoost.name',
    description: '+10% damage for rest of run',
    descriptionKey: 'data:bossRush.shop.damageBoost.description',
    cost: 200,
    type: 'stat_boost',
    effect: { statBonus: { stat: 'damageBonus', value: 0.10 } },
  },
  {
    id: 'speed_boost',
    name: 'Overclock',
    nameKey: 'data:bossRush.shop.speedBoost.name',
    description: '+15% attack speed for rest of run',
    descriptionKey: 'data:bossRush.shop.speedBoost.description',
    cost: 175,
    type: 'stat_boost',
    effect: { statBonus: { stat: 'attackSpeedBonus', value: 0.15 } },
  },
  {
    id: 'crit_boost',
    name: 'Precision Matrix',
    nameKey: 'data:bossRush.shop.critBoost.name',
    description: '+5% crit chance for rest of run',
    descriptionKey: 'data:bossRush.shop.critBoost.description',
    cost: 150,
    type: 'stat_boost',
    effect: { statBonus: { stat: 'critChance', value: 0.05 } },
  },
];

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

  /** Gold spent in shop this session */
  goldSpent: number;

  /** Dust earned this session */
  dustEarned: number;

  /** XP earned this session */
  xpEarned: number;

  /** Materials earned: { materialId: count } */
  materialsEarned: Record<string, number>;

  /** Achieved milestones (by bossCount) */
  achievedMilestones: number[];

  // ============================================================================
  // ROGUELIKE MODE ADDITIONS
  // ============================================================================

  /** Current relic options (generated after each boss kill) */
  relicOptions: string[];

  /** Whether relic has been chosen this intermission */
  relicChosen: boolean;

  /** Collected relics this run */
  collectedRelics: string[];

  /** Number of rerolls used this run */
  rerollsUsed: number;

  /** Shop purchases this run: { itemId: count } */
  shopPurchases: Record<string, number>;

  /** Stat boosts from shop purchases */
  shopStatBoosts: {
    damageBonus: number;
    attackSpeedBonus: number;
    critChance: number;
  };

  // ============================================================================
  // RUN STATS (for end screen)
  // ============================================================================

  /** Number of synergies activated this run */
  synergiesActivated: number;

  /** Damage dealt per synergy type: { synergyId: totalDamage } */
  synergyDamage: Record<string, number>;

  /** Best single hit damage */
  bestSingleHit: number;

  /** Total heals purchased */
  totalHealing: number;
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
    goldSpent: 0,
    dustEarned: 0,
    xpEarned: 0,
    materialsEarned: {},
    achievedMilestones: [],
    // Roguelike additions
    relicOptions: [],
    relicChosen: false,
    collectedRelics: [],
    rerollsUsed: 0,
    shopPurchases: {},
    shopStatBoosts: {
      damageBonus: 0,
      attackSpeedBonus: 0,
      critChance: 0,
    },
    // Run stats
    synergiesActivated: 0,
    synergyDamage: {},
    bestSingleHit: 0,
    totalHealing: 0,
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
 * Also generates new relic options for the player to choose.
 */
export function startIntermission(
  state: BossRushState,
  currentTick: number,
  config: BossRushConfig = DEFAULT_BOSS_RUSH_CONFIG,
  relicOptions?: string[]
): void {
  state.inIntermission = true;
  state.intermissionEndTick = currentTick + config.intermissionTicks;
  state.relicChosen = false;

  // Set relic options (generated externally to use RNG properly)
  if (relicOptions) {
    state.relicOptions = relicOptions;
  }
}

/**
 * End intermission and prepare for next boss.
 */
export function endIntermission(state: BossRushState, currentTick: number): void {
  state.inIntermission = false;
  state.currentBossStartTick = currentTick;
  state.relicOptions = [];
}

/**
 * Choose a relic during intermission.
 * @returns true if relic was successfully chosen
 */
export function chooseBossRushRelic(state: BossRushState, relicId: string): boolean {
  // Can only choose during intermission and if not already chosen
  if (!state.inIntermission || state.relicChosen) {
    return false;
  }

  // Verify relic is in options
  if (!state.relicOptions.includes(relicId)) {
    return false;
  }

  state.collectedRelics.push(relicId);
  state.relicChosen = true;
  return true;
}

/**
 * Reroll relic options (costs gold via shop)
 * @returns new relic options or null if can't afford
 */
export function rerollBossRushRelics(
  state: BossRushState,
  newOptions: string[]
): boolean {
  const rerollItem = BOSS_RUSH_SHOP_ITEMS.find(i => i.id === 'reroll_relics');
  if (!rerollItem) return false;

  const cost = rerollItem.cost;
  const availableGold = state.goldEarned - state.goldSpent;

  if (availableGold < cost) {
    return false;
  }

  state.goldSpent += cost;
  state.rerollsUsed += 1;
  state.shopPurchases['reroll_relics'] = (state.shopPurchases['reroll_relics'] || 0) + 1;
  state.relicOptions = newOptions;
  return true;
}

/**
 * Purchase a shop item.
 * @returns true if purchase was successful
 */
export function purchaseBossRushShopItem(
  state: BossRushState,
  itemId: string,
  fortressHp: number,
  fortressMaxHp: number
): { success: boolean; newFortressHp?: number; statBonus?: { stat: string; value: number } } {
  const item = BOSS_RUSH_SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) {
    return { success: false };
  }

  const availableGold = state.goldEarned - state.goldSpent;
  if (availableGold < item.cost) {
    return { success: false };
  }

  // Deduct gold
  state.goldSpent += item.cost;
  state.shopPurchases[itemId] = (state.shopPurchases[itemId] || 0) + 1;

  // Apply effect based on type
  switch (item.type) {
    case 'heal': {
      const healAmount = Math.floor(fortressMaxHp * (item.effect.healPercent || 0));
      const newHp = Math.min(fortressHp + healAmount, fortressMaxHp);
      state.totalHealing += (newHp - fortressHp);
      return { success: true, newFortressHp: newHp };
    }

    case 'stat_boost': {
      if (item.effect.statBonus) {
        const { stat, value } = item.effect.statBonus;
        if (stat === 'damageBonus') {
          state.shopStatBoosts.damageBonus += value;
        } else if (stat === 'attackSpeedBonus') {
          state.shopStatBoosts.attackSpeedBonus += value;
        } else if (stat === 'critChance') {
          state.shopStatBoosts.critChance += value;
        }
        return { success: true, statBonus: item.effect.statBonus };
      }
      return { success: true };
    }

    case 'reroll':
      // Reroll is handled separately
      return { success: true };

    default:
      return { success: true };
  }
}

/**
 * Get available gold (earned minus spent)
 */
export function getAvailableGold(state: BossRushState): number {
  return state.goldEarned - state.goldSpent;
}

// ============================================================================
// SUMMARY
// ============================================================================

export interface BossRushSummary {
  totalDamageDealt: number;
  bossesKilled: number;
  cyclesCompleted: number;
  goldEarned: number;
  goldSpent: number;
  dustEarned: number;
  xpEarned: number;
  materialsEarned: Record<string, number>;
  fastestBossKillTicks: number | null;
  achievedMilestones: number[];
  // Roguelike stats
  collectedRelics: string[];
  rerollsUsed: number;
  shopPurchases: Record<string, number>;
  synergiesActivated: number;
  synergyDamage: Record<string, number>;
  bestSingleHit: number;
  totalHealing: number;
  timeSurvived?: number;
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
    goldSpent: state.goldSpent,
    dustEarned: state.dustEarned,
    xpEarned: state.xpEarned,
    materialsEarned: { ...state.materialsEarned },
    fastestBossKillTicks: state.fastestBossKillTicks,
    achievedMilestones: [...state.achievedMilestones],
    // Roguelike stats
    collectedRelics: [...state.collectedRelics],
    rerollsUsed: state.rerollsUsed,
    shopPurchases: { ...state.shopPurchases },
    synergiesActivated: state.synergiesActivated,
    synergyDamage: { ...state.synergyDamage },
    bestSingleHit: state.bestSingleHit,
    totalHealing: state.totalHealing,
  };
}
