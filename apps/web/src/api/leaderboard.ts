/**
 * Leaderboard API client
 */
import type {
  PlayerLeaderboardResponse,
  PlayerLeaderboardCategory,
  UserRanksResponse,
  AvailableRewardsResponse,
  ClaimRewardRequest,
  ClaimRewardResponse,
  PlayerWeeksResponse,
  ExclusiveItemsResponse,
} from '@arcade/protocol';
import { CONFIG } from '../config.js';
import { getAccessToken } from './auth.js';
import { ApiError } from './client.js';
import {
  setUserRanks,
  setAvailableRewards,
  removeClaimedReward,
  setAvailableWeeks,
  setExclusiveItems,
  userRanksLoading,
  rewardsLoading,
} from '../state/leaderboard.signals.js';

async function leaderboardRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CONFIG.API_URL}${path}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.error || 'Request failed', data);
  }

  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// LEADERBOARDS
// ============================================================================

/**
 * Fetch player leaderboard by category
 * Note: Does not auto-update state - caller handles state updates for infinite scroll support
 */
export async function fetchPlayerLeaderboard(
  category: PlayerLeaderboardCategory,
  options: { limit?: number; offset?: number; week?: string; search?: string } = {}
): Promise<PlayerLeaderboardResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.week) params.set('week', options.week);
  if (options.search) params.set('search', options.search);

  const queryString = params.toString();
  const path = `/v1/leaderboards/players/${category}${queryString ? `?${queryString}` : ''}`;

  return leaderboardRequest<PlayerLeaderboardResponse>(path);
}

/**
 * Fetch user's ranks across all categories
 */
export async function fetchUserRanks(week?: string): Promise<UserRanksResponse> {
  userRanksLoading.value = true;

  try {
    const params = new URLSearchParams();
    if (week) params.set('week', week);

    const queryString = params.toString();
    const path = `/v1/leaderboards/players/my-ranks${queryString ? `?${queryString}` : ''}`;

    const response = await leaderboardRequest<UserRanksResponse>(path);

    setUserRanks(response.ranks, response.weekKey, response.timeUntilReset);

    return response;
  } finally {
    userRanksLoading.value = false;
  }
}

/**
 * Fetch available weeks for weekly leaderboards
 */
export async function fetchPlayerWeeks(limit?: number): Promise<PlayerWeeksResponse> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit.toString());

  const queryString = params.toString();
  const path = `/v1/leaderboards/players/weeks${queryString ? `?${queryString}` : ''}`;

  const response = await leaderboardRequest<PlayerWeeksResponse>(path);

  setAvailableWeeks(response.weeks, response.currentWeek);

  return response;
}

// ============================================================================
// REWARDS
// ============================================================================

/**
 * Fetch available rewards for current user
 */
export async function fetchAvailableRewards(): Promise<AvailableRewardsResponse> {
  rewardsLoading.value = true;

  try {
    const response = await leaderboardRequest<AvailableRewardsResponse>(
      '/v1/leaderboards/players/rewards'
    );

    setAvailableRewards(response.rewards);

    return response;
  } finally {
    rewardsLoading.value = false;
  }
}

/**
 * Claim a weekly reward
 */
export async function claimReward(rewardId: string): Promise<ClaimRewardResponse> {
  const body: ClaimRewardRequest = { rewardId };

  const response = await leaderboardRequest<ClaimRewardResponse>(
    '/v1/leaderboards/players/rewards/claim',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

  if (response.success) {
    removeClaimedReward(rewardId);
  }

  return response;
}

// ============================================================================
// EXCLUSIVE ITEMS
// ============================================================================

/**
 * Fetch all exclusive items definitions
 */
export async function fetchExclusiveItems(): Promise<ExclusiveItemsResponse> {
  const response = await leaderboardRequest<ExclusiveItemsResponse>(
    '/v1/leaderboards/exclusive-items'
  );

  setExclusiveItems(response.items);

  return response;
}

// ============================================================================
// LOAD ALL DATA
// ============================================================================

/**
 * Load all leaderboard data at once (for modal initialization)
 */
export async function loadLeaderboardData(): Promise<void> {
  await Promise.all([
    fetchPlayerWeeks(),
    fetchExclusiveItems(),
    fetchAvailableRewards().catch(() => {}), // May fail if not logged in
    fetchUserRanks().catch(() => {}), // May fail if not logged in
  ]);
}

/**
 * Refresh leaderboard data for current category
 */
export async function refreshCurrentLeaderboard(
  category: PlayerLeaderboardCategory,
  options: { limit?: number; offset?: number; week?: string } = {}
): Promise<void> {
  await fetchPlayerLeaderboard(category, options);
}
