import { signal, computed } from '@preact/signals';
import type { PillarId } from '@arcade/sim-core';

/**
 * Boss Rush damage history entry
 */
export interface BossRushDamageEntry {
  bossIndex: number;
  bossName: string;
  pillarId: PillarId;
  damage: number;
  timeMs: number;
  killed: boolean;
}

/**
 * Boss Rush session result from API
 */
export interface BossRushResult {
  verified: boolean;
  rewards?: {
    gold: number;
    dust: number;
    xp: number;
    materials: Record<string, number>;
    levelUp: boolean;
    newLevel?: number;
  };
  rejectReason?: string;
  leaderboardRank?: number;
}

/**
 * Boss Rush leaderboard entry
 */
export interface BossRushLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalDamage: number;
  bossesKilled: number;
  createdAt: string;
}

// ============================================================================
// SESSION STATE
// ============================================================================

/** Whether Boss Rush mode is currently active */
export const bossRushActive = signal(false);

/** Current Boss Rush session ID */
export const bossRushSessionId = signal<string | null>(null);

/** Session token for verification */
export const bossRushSessionToken = signal<string | null>(null);

/** Session seed for deterministic boss generation */
export const bossRushSeed = signal(0);

/** Session start timestamp */
export const bossRushStartTime = signal<number | null>(null);

// ============================================================================
// CURRENT BOSS STATE
// ============================================================================

/** Index of current boss in the sequence (0-6 within cycle) */
export const currentBossIndex = signal(0);

/** Current boss type (e.g., 'mafia_boss', 'ai_core') */
export const currentBossType = signal<string | null>(null);

/** Current boss display name */
export const currentBossName = signal('');

/** Current boss's pillar */
export const currentBossPillar = signal<PillarId | null>(null);

/** Current boss HP */
export const bossHp = signal(0);

/** Current boss max HP */
export const bossMaxHp = signal(100);

/** Current cycle number (0 = first cycle, 1 = second cycle with 2x scaling, etc.) */
export const currentCycle = signal(0);

// ============================================================================
// DAMAGE TRACKING
// ============================================================================

/** Total damage dealt across all bosses */
export const totalDamageDealt = signal(0);

/** Damage dealt to current boss */
export const currentBossDamage = signal(0);

/** Current DPS (damage per second) */
export const damagePerSecond = signal(0);

/** Damage history per boss */
export const damageHistory = signal<BossRushDamageEntry[]>([]);

// ============================================================================
// PROGRESS & MILESTONES
// ============================================================================

/** Total bosses killed */
export const bossesKilled = signal(0);

/** Gold earned in session */
export const bossRushGoldEarned = signal(0);

/** Dust earned in session */
export const bossRushDustEarned = signal(0);

/** Materials earned in session */
export const bossRushMaterialsEarned = signal<Record<string, number>>({});

/** Milestone thresholds */
export const BOSS_RUSH_MILESTONES = [
  { bosses: 3, reward: 'boss_essence', label: '3 Bosses' },
  { bosses: 7, reward: 'boss_trophy_gold', label: '7 Bosses (Full Cycle)' },
  { bosses: 14, reward: 'boss_trophy_platinum', label: '14 Bosses (2 Cycles)' },
  { bosses: 21, reward: 'boss_trophy_diamond', label: '21 Bosses (3 Cycles)' },
];

/** Achieved milestone indices */
export const achievedMilestones = signal<number[]>([]);

// ============================================================================
// UI STATE
// ============================================================================

/** Show Boss Rush setup modal */
export const showBossRushSetup = signal(false);

/** Show Boss Rush end screen */
export const showBossRushEndScreen = signal(false);

/** Boss Rush end result (for end screen) */
export const bossRushEndResult = signal<BossRushResult | null>(null);

/** Show expanded details in HUD */
export const showBossRushDetails = signal(false);

/** Intermission state (between bosses) */
export const bossRushIntermission = signal(false);

/** Intermission countdown (seconds remaining) */
export const intermissionCountdown = signal(0);

/** Loading state for Boss Rush operations */
export const bossRushLoading = signal(false);

/** Error state for Boss Rush operations */
export const bossRushError = signal<string | null>(null);

// ============================================================================
// LEADERBOARD STATE
// ============================================================================

/** User's best total damage */
export const userBestDamage = signal(0);

/** User's best bosses killed */
export const userBestBossesKilled = signal(0);

/** User's current leaderboard rank */
export const userBossRushRank = signal<number | null>(null);

/** Current week's leaderboard entries */
export const bossRushLeaderboard = signal<BossRushLeaderboardEntry[]>([]);

/** Leaderboard loading state */
export const bossRushLeaderboardLoading = signal(false);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/** Boss HP percentage (0-100) */
export const bossHpPercent = computed(() => {
  const max = bossMaxHp.value;
  if (max <= 0) return 0;
  return (bossHp.value / max) * 100;
});

/** Current cycle display string */
export const currentCycleDisplay = computed(() => {
  return `Cycle ${currentCycle.value + 1}`;
});

/** Current boss number within cycle (1-7) */
export const bossNumberInCycle = computed(() => {
  return (currentBossIndex.value % 7) + 1;
});

/** Total boss number across all cycles */
export const totalBossNumber = computed(() => {
  return currentCycle.value * 7 + bossNumberInCycle.value;
});

/** Session duration in milliseconds */
export const sessionDuration = computed(() => {
  const start = bossRushStartTime.value;
  if (!start) return 0;
  return Date.now() - start;
});

/** Session duration formatted as MM:SS */
export const sessionDurationFormatted = computed(() => {
  const ms = sessionDuration.value;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
});

/** Format large damage numbers (e.g., 1,234,567) */
export function formatDamage(damage: number): string {
  return damage.toLocaleString('en-US');
}

/** Format damage with K/M suffix for compact display */
export function formatDamageCompact(damage: number): string {
  if (damage >= 1_000_000) {
    return `${(damage / 1_000_000).toFixed(1)}M`;
  }
  if (damage >= 1_000) {
    return `${(damage / 1_000).toFixed(1)}K`;
  }
  return damage.toString();
}

// ============================================================================
// ACTIONS
// ============================================================================

/** Reset all Boss Rush state (including roguelike state) */
export function resetBossRushState(): void {
  bossRushActive.value = false;
  bossRushSessionId.value = null;
  bossRushSessionToken.value = null;
  bossRushSeed.value = 0;
  bossRushStartTime.value = null;

  currentBossIndex.value = 0;
  currentBossType.value = null;
  currentBossName.value = '';
  currentBossPillar.value = null;
  bossHp.value = 0;
  bossMaxHp.value = 100;
  currentCycle.value = 0;

  totalDamageDealt.value = 0;
  currentBossDamage.value = 0;
  damagePerSecond.value = 0;
  damageHistory.value = [];

  bossesKilled.value = 0;
  bossRushGoldEarned.value = 0;
  bossRushDustEarned.value = 0;
  bossRushMaterialsEarned.value = {};
  achievedMilestones.value = [];

  showBossRushDetails.value = false;
  bossRushIntermission.value = false;
  intermissionCountdown.value = 0;
  bossRushError.value = null;

  // Reset roguelike state
  bossRushRelicOptions.value = [];
  bossRushRelicChosen.value = false;
  bossRushCollectedRelics.value = [];
  bossRushRerollsUsed.value = 0;
  bossRushGoldSpent.value = 0;
  bossRushShopStatBoosts.value = {
    damageBonus: 0,
    attackSpeedBonus: 0,
    critChance: 0,
  };
  bossRushShopPurchases.value = {};
  bossRushSynergiesActivated.value = 0;
  bossRushSynergyDamage.value = {};
  bossRushBestSingleHit.value = 0;
  bossRushTotalHealing.value = 0;
  showBossRushShop.value = false;

  // Reset stationary boss state
  bossPosition.value = null;
  bossProjectiles.value = [];
  bossRushHeroPositions.value = [];
}

/** Initialize Boss Rush session */
export function initBossRushSession(
  sessionId: string,
  sessionToken: string,
  seed: number
): void {
  resetBossRushState();
  bossRushSessionId.value = sessionId;
  bossRushSessionToken.value = sessionToken;
  bossRushSeed.value = seed;
  bossRushStartTime.value = Date.now();
  bossRushActive.value = true;
}

/** Update boss state */
export function updateBossState(
  bossIndex: number,
  bossType: string,
  bossName: string,
  pillarId: PillarId,
  hp: number,
  maxHp: number,
  cycle: number
): void {
  currentBossIndex.value = bossIndex;
  currentBossType.value = bossType;
  currentBossName.value = bossName;
  currentBossPillar.value = pillarId;
  bossHp.value = hp;
  bossMaxHp.value = maxHp;
  currentCycle.value = cycle;
  currentBossDamage.value = 0;
}

/** Update damage dealt */
export function updateDamageDealt(damage: number): void {
  totalDamageDealt.value += damage;
  currentBossDamage.value += damage;
}

/** Record boss kill and update history */
export function recordBossKill(timeMs: number): void {
  const entry: BossRushDamageEntry = {
    bossIndex: currentBossIndex.value,
    bossName: currentBossName.value,
    pillarId: currentBossPillar.value!,
    damage: currentBossDamage.value,
    timeMs,
    killed: true,
  };
  damageHistory.value = [...damageHistory.value, entry];
  bossesKilled.value += 1;

  // Check milestones
  const newMilestones: number[] = [];
  BOSS_RUSH_MILESTONES.forEach((milestone, index) => {
    if (
      bossesKilled.value >= milestone.bosses &&
      !achievedMilestones.value.includes(index)
    ) {
      newMilestones.push(index);
    }
  });
  if (newMilestones.length > 0) {
    achievedMilestones.value = [...achievedMilestones.value, ...newMilestones];
  }
}

/** Record death (boss not killed) */
export function recordBossDeath(timeMs: number): void {
  const entry: BossRushDamageEntry = {
    bossIndex: currentBossIndex.value,
    bossName: currentBossName.value,
    pillarId: currentBossPillar.value!,
    damage: currentBossDamage.value,
    timeMs,
    killed: false,
  };
  damageHistory.value = [...damageHistory.value, entry];
}

/** Start intermission between bosses */
export function startIntermission(seconds: number): void {
  bossRushIntermission.value = true;
  intermissionCountdown.value = seconds;
}

/** End intermission */
export function endIntermission(): void {
  bossRushIntermission.value = false;
  intermissionCountdown.value = 0;
}

/** Update intermission countdown */
export function updateIntermissionCountdown(seconds: number): void {
  intermissionCountdown.value = seconds;
}

/** Update rewards earned */
export function updateBossRushRewards(
  gold: number,
  dust: number,
  materials: Record<string, number>
): void {
  bossRushGoldEarned.value = gold;
  bossRushDustEarned.value = dust;
  bossRushMaterialsEarned.value = materials;
}

/** Show Boss Rush setup modal */
export function openBossRushSetup(): void {
  showBossRushSetup.value = true;
}

/** Hide Boss Rush setup modal */
export function closeBossRushSetup(): void {
  showBossRushSetup.value = false;
}

/** Show Boss Rush end screen with result */
export function showBossRushEnd(result: BossRushResult): void {
  bossRushEndResult.value = result;
  showBossRushEndScreen.value = true;
}

/** Hide Boss Rush end screen */
export function closeBossRushEndScreen(): void {
  showBossRushEndScreen.value = false;
  bossRushEndResult.value = null;
}

/** Update leaderboard data */
export function updateBossRushLeaderboard(
  entries: BossRushLeaderboardEntry[],
  userRank?: number
): void {
  bossRushLeaderboard.value = entries;
  if (userRank !== undefined) {
    userBossRushRank.value = userRank;
  }
}

/** Update user's personal best */
export function updateUserBestScore(damage: number, bosses: number): void {
  if (damage > userBestDamage.value) {
    userBestDamage.value = damage;
  }
  if (bosses > userBestBossesKilled.value) {
    userBestBossesKilled.value = bosses;
  }
}

// ============================================================================
// ROGUELIKE MODE STATE
// ============================================================================

/** Available relic options during intermission */
export const bossRushRelicOptions = signal<string[]>([]);

/** Whether player has chosen a relic this intermission */
export const bossRushRelicChosen = signal(false);

/** All relics collected this run */
export const bossRushCollectedRelics = signal<string[]>([]);

/** Number of relic rerolls used */
export const bossRushRerollsUsed = signal(0);

/** Gold spent in shop */
export const bossRushGoldSpent = signal(0);

/** Shop stat boosts accumulated */
export const bossRushShopStatBoosts = signal({
  damageBonus: 0,
  attackSpeedBonus: 0,
  critChance: 0,
});

/** Shop purchases by item ID */
export const bossRushShopPurchases = signal<Record<string, number>>({});

/** Synergies activated this run */
export const bossRushSynergiesActivated = signal(0);

/** Damage dealt per synergy type */
export const bossRushSynergyDamage = signal<Record<string, number>>({});

/** Best single hit damage */
export const bossRushBestSingleHit = signal(0);

/** Total healing from shop */
export const bossRushTotalHealing = signal(0);

/** Show shop panel during intermission */
export const showBossRushShop = signal(false);

// ============================================================================
// STATIONARY BOSS STATE (Boss position & projectiles)
// ============================================================================

/** Boss projectile in flight toward fortress */
export interface BossProjectile {
  id: number;
  damage: number;
  spawnTick: number;
  arrivalTick: number;
  /** Progress 0-1 for rendering interpolation */
  progress: number;
}

/** Boss position (fixed-point converted to float for rendering) */
export const bossPosition = signal<{ x: number; y: number } | null>(null);

/** Boss projectiles currently in flight */
export const bossProjectiles = signal<BossProjectile[]>([]);

/** Hero positions for Boss Rush (advancing toward boss) */
export interface BossRushHeroPosition {
  heroId: string;
  x: number;
  y: number;
  visualX: number; // Interpolated for smooth rendering
  visualY: number;
  inRange: boolean; // Whether hero is in attack range of boss
}

/** Hero positions during Boss Rush */
export const bossRushHeroPositions = signal<BossRushHeroPosition[]>([]);

// ============================================================================
// ROGUELIKE COMPUTED VALUES
// ============================================================================

/** Available gold to spend (earned - spent) */
export const bossRushAvailableGold = computed(() => {
  return bossRushGoldEarned.value - bossRushGoldSpent.value;
});

// ============================================================================
// ROGUELIKE ACTIONS
// ============================================================================

/** Set relic options for current intermission */
export function setBossRushRelicOptions(options: string[]): void {
  bossRushRelicOptions.value = options;
  bossRushRelicChosen.value = false;
}

/** Player chose a relic */
export function chooseBossRushRelic(relicId: string): void {
  if (bossRushRelicOptions.value.includes(relicId)) {
    bossRushCollectedRelics.value = [...bossRushCollectedRelics.value, relicId];
    bossRushRelicChosen.value = true;
  }
}

/** Reroll relic options (deducts gold) */
export function rerollBossRushRelics(newOptions: string[], cost: number): boolean {
  if (bossRushAvailableGold.value < cost) {
    return false;
  }
  bossRushGoldSpent.value += cost;
  bossRushRerollsUsed.value += 1;
  bossRushRelicOptions.value = newOptions;
  bossRushRelicChosen.value = false;
  return true;
}

/** Purchase shop item */
export function purchaseBossRushShopItem(
  itemId: string,
  cost: number,
  healAmount?: number,
  statBonus?: { stat: 'damageBonus' | 'attackSpeedBonus' | 'critChance'; value: number }
): boolean {
  if (bossRushAvailableGold.value < cost) {
    return false;
  }

  bossRushGoldSpent.value += cost;
  bossRushShopPurchases.value = {
    ...bossRushShopPurchases.value,
    [itemId]: (bossRushShopPurchases.value[itemId] || 0) + 1,
  };

  if (healAmount) {
    bossRushTotalHealing.value += healAmount;
  }

  if (statBonus) {
    const current = bossRushShopStatBoosts.value;
    bossRushShopStatBoosts.value = {
      ...current,
      [statBonus.stat]: current[statBonus.stat] + statBonus.value,
    };
  }

  return true;
}

/** Update synergy tracking */
export function updateBossRushSynergyStats(synergiesActivated: number, synergyDamage: Record<string, number>): void {
  bossRushSynergiesActivated.value = synergiesActivated;
  bossRushSynergyDamage.value = synergyDamage;
}

/** Update best single hit */
export function updateBossRushBestHit(damage: number): void {
  if (damage > bossRushBestSingleHit.value) {
    bossRushBestSingleHit.value = damage;
  }
}

/** Show/hide shop panel */
export function openBossRushShop(): void {
  showBossRushShop.value = true;
}

export function closeBossRushShop(): void {
  showBossRushShop.value = false;
}

// ============================================================================
// STATIONARY BOSS ACTIONS
// ============================================================================

/** Update boss position (called when boss spawns) */
export function updateBossPosition(x: number, y: number): void {
  bossPosition.value = { x, y };
}

/** Clear boss position (called when boss dies) */
export function clearBossPosition(): void {
  bossPosition.value = null;
}

/** Add a boss projectile in flight */
export function addBossProjectile(projectile: Omit<BossProjectile, 'progress'>): void {
  bossProjectiles.value = [
    ...bossProjectiles.value,
    { ...projectile, progress: 0 },
  ];
}

/** Update projectile progress (0-1) based on current tick */
export function updateBossProjectiles(currentTick: number): void {
  bossProjectiles.value = bossProjectiles.value.map(proj => {
    const totalTicks = proj.arrivalTick - proj.spawnTick;
    const elapsedTicks = currentTick - proj.spawnTick;
    const progress = Math.min(1, elapsedTicks / totalTicks);
    return { ...proj, progress };
  });
}

/** Remove projectile after it hits fortress */
export function removeBossProjectile(id: number): void {
  bossProjectiles.value = bossProjectiles.value.filter(p => p.id !== id);
}

/** Clear all projectiles (called on boss death or session end) */
export function clearBossProjectiles(): void {
  bossProjectiles.value = [];
}

/** Update hero positions during Boss Rush */
export function updateBossRushHeroPositions(positions: BossRushHeroPosition[]): void {
  bossRushHeroPositions.value = positions;
}

/** Interpolate hero visual positions for smooth rendering */
export function interpolateBossRushHeroPositions(lerpFactor: number = 0.15): void {
  bossRushHeroPositions.value = bossRushHeroPositions.value.map(hero => ({
    ...hero,
    visualX: hero.visualX + (hero.x - hero.visualX) * lerpFactor,
    visualY: hero.visualY + (hero.y - hero.visualY) * lerpFactor,
  }));
}

/** Clear hero positions (called on session end) */
export function clearBossRushHeroPositions(): void {
  bossRushHeroPositions.value = [];
}

