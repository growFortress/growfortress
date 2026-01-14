/**
 * Boss Rush Mode API Client
 */
import type {
  BossRushStartRequest,
  BossRushStartResponse,
  BossRushFinishRequest,
  BossRushFinishResponse,
  BossRushLeaderboardResponse,
  BossRushHistoryResponse,
} from '@arcade/protocol';
import { ApiError, request } from './base.js';

/**
 * Boss Rush specific API error for backwards compatibility
 */
export class BossRushApiError extends ApiError {
  constructor(status: number, message: string, data?: unknown) {
    super(status, message, undefined, data);
    this.name = 'BossRushApiError';
  }
}

// ============================================================================
// BOSS RUSH SESSION API
// ============================================================================

/**
 * Start a new Boss Rush session
 */
export async function startBossRush(
  options: BossRushStartRequest = {}
): Promise<BossRushStartResponse> {
  return request<BossRushStartResponse>('/v1/boss-rush/start', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

/**
 * Finish a Boss Rush session with results
 */
export async function finishBossRush(
  sessionId: string,
  data: BossRushFinishRequest
): Promise<BossRushFinishResponse> {
  return request<BossRushFinishResponse>(
    `/v1/boss-rush/${encodeURIComponent(sessionId)}/finish`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    }
  );
}

/**
 * Get Boss Rush session details
 */
export interface BossRushSessionResponse {
  sessionId: string;
  totalDamageDealt: number;
  bossesKilled: number;
  goldEarned: number;
  dustEarned: number;
  verified: boolean;
  startedAt: string;
  endedAt?: string;
}

export async function getBossRushSession(
  sessionId: string
): Promise<BossRushSessionResponse | null> {
  try {
    return await request<BossRushSessionResponse>(
      `/v1/boss-rush/${encodeURIComponent(sessionId)}`
    );
  } catch (error) {
    if (error instanceof BossRushApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// BOSS RUSH LEADERBOARD API
// ============================================================================

/**
 * Get Boss Rush leaderboard
 */
export async function getBossRushLeaderboard(
  weekKey?: string,
  limit = 10,
  offset = 0
): Promise<BossRushLeaderboardResponse> {
  const params = new URLSearchParams();
  if (weekKey) params.set('week', weekKey);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return request<BossRushLeaderboardResponse>(
    `/v1/boss-rush/leaderboard?${params}`
  );
}

/**
 * Get available week keys for Boss Rush leaderboard
 */
export interface BossRushWeeksResponse {
  weeks: string[];
}

export async function getBossRushAvailableWeeks(): Promise<BossRushWeeksResponse> {
  return request<BossRushWeeksResponse>('/v1/boss-rush/leaderboard/weeks');
}

// ============================================================================
// BOSS RUSH HISTORY API
// ============================================================================

/**
 * Get user's Boss Rush history
 */
export async function getBossRushHistory(
  limit = 10,
  offset = 0
): Promise<BossRushHistoryResponse> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return request<BossRushHistoryResponse>(`/v1/boss-rush/history?${params}`);
}

// Re-export types for convenience
export type {
  BossRushStartRequest,
  BossRushStartResponse,
  BossRushFinishRequest,
  BossRushFinishResponse,
  BossRushLeaderboardResponse,
  BossRushHistoryResponse,
  BossRushLeaderboardEntry,
  BossRushHistoryEntry,
} from '@arcade/protocol';
