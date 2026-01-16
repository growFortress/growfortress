/**
 * Leaderboard system state management using Preact Signals
 */
import { signal, computed } from '@preact/signals';
import type {
  PlayerLeaderboardEntry,
  PlayerLeaderboardCategory,
  UserRankInfo,
  AvailableReward,
  TimeUntilReset,
  ExclusiveItem,
  GuildLeaderboardEntry,
} from '@arcade/protocol';

// ============================================================================
// MODAL STATE
// ============================================================================

/** Whether the leaderboard modal is visible */
export const showLeaderboardModal = signal(false);

/** Current main tab: 'permanent' | 'weekly' | 'guild' */
export type MainTab = 'permanent' | 'weekly' | 'guild';
export const activeMainTab = signal<MainTab>('permanent');

/** Current sub tab based on main tab */
export type SubTab = PlayerLeaderboardCategory | 'guildHonor';
export const activeSubTab = signal<SubTab>('totalWaves');

/** Selected week for weekly leaderboards */
export const selectedWeek = signal<string | null>(null);

/** Search query for filtering leaderboard */
export const leaderboardSearchQuery = signal('');

// ============================================================================
// LEADERBOARD DATA
// ============================================================================

/** Current leaderboard entries */
export const leaderboardEntries = signal<PlayerLeaderboardEntry[]>([]);

/** Total count of entries */
export const leaderboardTotal = signal(0);

/** Current offset for infinite scroll */
export const leaderboardOffset = signal(0);

/** Batch size for loading */
export const leaderboardLimit = signal(50);

/** Loading state (initial load) */
export const leaderboardLoading = signal(false);

/** Loading more state (infinite scroll) */
export const leaderboardLoadingMore = signal(false);

/** Error message */
export const leaderboardError = signal<string | null>(null);

/** Time until weekly reset */
export const timeUntilReset = signal<TimeUntilReset | null>(null);

/** Available weeks for weekly leaderboards */
export const availableWeeks = signal<string[]>([]);

/** Current week key */
export const currentWeekKey = signal<string>('');

// ============================================================================
// GUILD LEADERBOARD DATA
// ============================================================================

/** Current guild leaderboard entries */
export const guildLeaderboardEntries = signal<GuildLeaderboardEntry[]>([]);

/** Total count of guild entries */
export const guildLeaderboardTotal = signal(0);

/** User's guild rank */
export const myGuildRank = signal<number | null>(null);

// ============================================================================
// USER RANKS
// ============================================================================

/** User's ranks across all categories */
export const userRanks = signal<UserRankInfo[]>([]);

/** Loading state for user ranks */
export const userRanksLoading = signal(false);

/** Get user rank for specific category */
export const getUserRankForCategory = (category: PlayerLeaderboardCategory): UserRankInfo | undefined => {
  return userRanks.value.find(r => r.category === category);
};

/** Player's primary rank (totalWaves) - convenience computed */
export const playerPrimaryRank = computed(() => {
  const rank = userRanks.value.find(r => r.category === 'totalWaves');
  return rank?.rank ?? null;
});

// ============================================================================
// REWARDS
// ============================================================================

/** Available rewards to claim */
export const availableRewards = signal<AvailableReward[]>([]);

/** Loading state for rewards */
export const rewardsLoading = signal(false);

/** Whether user has unclaimed rewards */
export const hasUnclaimedRewards = computed(() => availableRewards.value.length > 0);

/** Total unclaimed rewards count */
export const unclaimedRewardsCount = computed(() => availableRewards.value.length);

// ============================================================================
// EXCLUSIVE ITEMS
// ============================================================================

/** All exclusive items definitions */
export const exclusiveItems = signal<ExclusiveItem[]>([]);

/** Get exclusive item by ID */
export const getExclusiveItemById = (id: string): ExclusiveItem | undefined => {
  return exclusiveItems.value.find(item => item.id === id);
};

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/** Has more entries to load (player leaderboard) */
export const hasMoreEntries = computed(() => {
  return leaderboardEntries.value.length < leaderboardTotal.value;
});

/** Has more entries to load (guild leaderboard) */
export const hasMoreGuildEntries = computed(() => {
  return guildLeaderboardEntries.value.length < guildLeaderboardTotal.value;
});

/** Formatted time until reset */
export const formattedTimeUntilReset = computed(() => {
  const t = timeUntilReset.value;
  if (!t) return '';

  if (t.days > 0) {
    return `${t.days}d ${t.hours}h ${t.minutes}m`;
  }
  if (t.hours > 0) {
    return `${t.hours}h ${t.minutes}m`;
  }
  return `${t.minutes}m`;
});

// ============================================================================
// ACTIONS
// ============================================================================

/** Open leaderboard modal */
export function openLeaderboardModal(tab: MainTab = 'permanent') {
  activeMainTab.value = tab;

  // Set default sub-tab based on main tab
  switch (tab) {
    case 'permanent':
      activeSubTab.value = 'totalWaves';
      break;
    case 'weekly':
      activeSubTab.value = 'weeklyWaves';
      break;
    case 'guild':
      activeSubTab.value = 'guildHonor';
      break;
  }

  showLeaderboardModal.value = true;
}

/** Close leaderboard modal */
export function closeLeaderboardModal() {
  showLeaderboardModal.value = false;
}

/** Change main tab */
export function setMainTab(tab: MainTab) {
  activeMainTab.value = tab;
  leaderboardSearchQuery.value = '';
  resetLeaderboardData();

  // Set default sub-tab
  switch (tab) {
    case 'permanent':
      activeSubTab.value = 'totalWaves';
      break;
    case 'weekly':
      activeSubTab.value = 'weeklyWaves';
      break;
    case 'guild':
      activeSubTab.value = 'guildHonor';
      break;
  }
}

/** Change sub tab */
export function setSubTab(tab: SubTab) {
  activeSubTab.value = tab;
  leaderboardSearchQuery.value = '';
  resetLeaderboardData();
}

/** Set search query */
export function setLeaderboardSearch(query: string) {
  leaderboardSearchQuery.value = query;
  resetLeaderboardData();
}

/** Reset leaderboard data for fresh load */
export function resetLeaderboardData() {
  leaderboardOffset.value = 0;
  leaderboardEntries.value = [];
  guildLeaderboardEntries.value = [];
  leaderboardTotal.value = 0;
  guildLeaderboardTotal.value = 0;
}

/** Set selected week */
export function setSelectedWeek(week: string | null) {
  selectedWeek.value = week;
  resetLeaderboardData();
}

// ============================================================================
// DATA SETTERS (called from API)
// ============================================================================

/** Update leaderboard data from API response */
export function setLeaderboardData(
  entries: PlayerLeaderboardEntry[],
  total: number,
  reset?: TimeUntilReset,
  append = false
) {
  if (append) {
    leaderboardEntries.value = [...leaderboardEntries.value, ...entries];
  } else {
    leaderboardEntries.value = entries;
  }
  leaderboardTotal.value = total;
  leaderboardOffset.value = leaderboardEntries.value.length;
  if (reset) {
    timeUntilReset.value = reset;
  }
  leaderboardError.value = null;
}

/** Update user ranks from API response */
export function setUserRanks(
  ranks: UserRankInfo[],
  weekKey: string,
  reset: TimeUntilReset
) {
  userRanks.value = ranks;
  currentWeekKey.value = weekKey;
  timeUntilReset.value = reset;
}

/** Update available rewards from API response */
export function setAvailableRewards(rewards: AvailableReward[]) {
  availableRewards.value = rewards;
}

/** Remove a claimed reward */
export function removeClaimedReward(rewardId: string) {
  availableRewards.value = availableRewards.value.filter(r => r.id !== rewardId);
}

/** Update available weeks from API response */
export function setAvailableWeeks(weeks: string[], current: string) {
  availableWeeks.value = weeks;
  currentWeekKey.value = current;
}

/** Update exclusive items from API response */
export function setExclusiveItems(items: ExclusiveItem[]) {
  exclusiveItems.value = items;
}

/** Update guild leaderboard data from API response */
export function setGuildLeaderboardData(
  entries: GuildLeaderboardEntry[],
  total: number,
  myRank: number | null,
  append = false
) {
  if (append) {
    guildLeaderboardEntries.value = [...guildLeaderboardEntries.value, ...entries];
  } else {
    guildLeaderboardEntries.value = entries;
  }
  guildLeaderboardTotal.value = total;
  leaderboardOffset.value = guildLeaderboardEntries.value.length;
  myGuildRank.value = myRank;
  leaderboardError.value = null;
}
