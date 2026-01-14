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
import { ApiError, request } from './base.js';

/**
 * PvP specific API error for backwards compatibility
 */
export class PvpApiError extends ApiError {
  constructor(status: number, message: string, code?: string, data?: unknown) {
    super(status, message, code, data);
    this.name = 'PvpApiError';
  }
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
