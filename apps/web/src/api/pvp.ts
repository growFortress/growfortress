/**
 * PvP Arena API Client
 */
import type {
  PvpOpponentsResponse,
  PvpCreateChallengeResponse,
  PvpChallengesResponse,
  PvpChallengeWithResult,
  PvpAcceptResponse,
  PvpReplayResponse,
  PvpUserStats,
  PvpChallengeStatus,
} from '@arcade/protocol';
import { CONFIG } from '../config.js';
import { getAccessToken, getRefreshToken, setTokens, setDisplayName, clearTokens } from './auth.js';

export class PvpApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'PvpApiError';
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
    throw new PvpApiError(
      response.status,
      data.error || 'Request failed',
      data.code,
      data
    );
  }

  // Handle empty responses (204 No Content)
  const contentType = response.headers.get('content-type');
  if (response.status === 204 || !contentType?.includes('application/json')) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// OPPONENTS API
// ============================================================================

/**
 * Get list of opponents within power range
 */
export async function getOpponents(
  limit = 20,
  offset = 0
): Promise<PvpOpponentsResponse> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return request<PvpOpponentsResponse>(`/v1/pvp/opponents?${params}`);
}

// ============================================================================
// CHALLENGES API
// ============================================================================

/**
 * Create a new challenge
 */
export async function createChallenge(
  challengedId: string
): Promise<PvpCreateChallengeResponse> {
  return request<PvpCreateChallengeResponse>('/v1/pvp/challenges', {
    method: 'POST',
    body: JSON.stringify({ challengedId }),
  });
}

/**
 * Get user's challenges
 */
export async function getChallenges(
  type: 'sent' | 'received' | 'all' = 'all',
  status?: PvpChallengeStatus,
  limit = 20,
  offset = 0
): Promise<PvpChallengesResponse> {
  const params = new URLSearchParams();
  params.set('type', type);
  if (status) params.set('status', status);
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return request<PvpChallengesResponse>(`/v1/pvp/challenges?${params}`);
}

/**
 * Get a single challenge with result
 */
export async function getChallenge(
  challengeId: string
): Promise<PvpChallengeWithResult | null> {
  try {
    return await request<PvpChallengeWithResult>(
      `/v1/pvp/challenges/${encodeURIComponent(challengeId)}`
    );
  } catch (error) {
    if (error instanceof PvpApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Accept a challenge (triggers battle simulation)
 */
export async function acceptChallenge(
  challengeId: string
): Promise<PvpAcceptResponse> {
  return request<PvpAcceptResponse>(
    `/v1/pvp/challenges/${encodeURIComponent(challengeId)}/accept`,
    { method: 'POST' }
  );
}

/**
 * Decline a challenge
 */
export async function declineChallenge(
  challengeId: string
): Promise<{ id: string; status: PvpChallengeStatus }> {
  return request<{ id: string; status: PvpChallengeStatus }>(
    `/v1/pvp/challenges/${encodeURIComponent(challengeId)}/decline`,
    { method: 'POST' }
  );
}

/**
 * Cancel a challenge (by challenger)
 */
export async function cancelChallenge(
  challengeId: string
): Promise<{ id: string; status: PvpChallengeStatus }> {
  return request<{ id: string; status: PvpChallengeStatus }>(
    `/v1/pvp/challenges/${encodeURIComponent(challengeId)}/cancel`,
    { method: 'POST' }
  );
}

// ============================================================================
// REPLAY API
// ============================================================================

/**
 * Get replay data for a resolved challenge
 */
export async function getReplayData(
  challengeId: string
): Promise<PvpReplayResponse | null> {
  try {
    return await request<PvpReplayResponse>(
      `/v1/pvp/replay/${encodeURIComponent(challengeId)}`
    );
  } catch (error) {
    if (error instanceof PvpApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// ============================================================================
// STATS API
// ============================================================================

/**
 * Get user's PvP stats
 */
export async function getPvpStats(): Promise<PvpUserStats> {
  return request<PvpUserStats>('/v1/pvp/stats');
}

// Re-export types for convenience
export type {
  PvpOpponent,
  PvpOpponentsResponse,
  PvpChallenge,
  PvpCreateChallengeResponse,
  PvpChallengesResponse,
  PvpChallengeWithResult,
  PvpAcceptResponse,
  PvpBattleStats,
  PvpResult,
  PvpReplayResponse,
  PvpUserStats,
  PvpChallengeStatus,
  PvpWinReason,
} from '@arcade/protocol';
