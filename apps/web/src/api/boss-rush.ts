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
import { CONFIG } from '../config.js';
import { getAccessToken, getRefreshToken, setTokens, setDisplayName, clearTokens } from './auth.js';

export class BossRushApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'BossRushApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return false;
      }

      const data = await response.json();
      setTokens(data.accessToken, data.refreshToken);
      setDisplayName(data.displayName);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retry = true
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
    // Try to refresh token on 401
    if (response.status === 401 && retry) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return request<T>(path, options, false);
      }
    }

    const data = await response.json().catch(() => ({}));
    throw new BossRushApiError(response.status, data.error || 'Request failed', data);
  }

  // Handle empty responses (204 No Content)
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {} as T;
  }

  return response.json();
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
