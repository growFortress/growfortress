/**
 * PvP Arena API Client
 */
import type {
  PvpOpponentsResponse,
  PvpCreateChallengeResponse,
  PvpChallengesResponse,
  PvpChallengeWithResult,
  PvpAcceptResponse,
  PvpResolveResponse,
  PvpResolveRequest,
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

async function pvpRequest<T>(path: string, options?: Parameters<typeof request>[1]): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError) {
      throw new PvpApiError(error.status, error.message, error.code, error.data);
    }
    throw error;
  }
}

// ============================================================================
// OPPONENTS API
// ============================================================================

/**
 * Get list of opponents within power range
 */
export async function getOpponents(
  limit = 8,
  offset = 0
): Promise<PvpOpponentsResponse> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());
  params.set('offset', offset.toString());

  return pvpRequest<PvpOpponentsResponse>(`/v1/pvp/opponents?${params}`);
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
  return pvpRequest<PvpCreateChallengeResponse>('/v1/pvp/challenges', {
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
  
  // Ensure type is valid
  if (type && ['sent', 'received', 'all'].includes(type)) {
    params.set('type', type);
  } else {
    params.set('type', 'all');
  }
  
  // Only add status if it's a valid value
  if (status && ['PENDING', 'ACCEPTED', 'RESOLVED', 'DECLINED', 'EXPIRED', 'CANCELLED'].includes(status)) {
    params.set('status', status);
  }
  
  // Ensure limit and offset are valid numbers
  const validLimit = Math.max(1, Math.min(50, Math.floor(limit || 20)));
  const validOffset = Math.max(0, Math.floor(offset || 0));
  
  params.set('limit', validLimit.toString());
  params.set('offset', validOffset.toString());

  return pvpRequest<PvpChallengesResponse>(`/v1/pvp/challenges?${params}`);
}

/**
 * Get a single challenge with result
 */
export async function getChallenge(
  challengeId: string
): Promise<PvpChallengeWithResult | null> {
  try {
    return await pvpRequest<PvpChallengeWithResult>(
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
  return pvpRequest<PvpAcceptResponse>(
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
  return pvpRequest<{ id: string; status: PvpChallengeStatus }>(
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
  return pvpRequest<{ id: string; status: PvpChallengeStatus }>(
    `/v1/pvp/challenges/${encodeURIComponent(challengeId)}/cancel`,
    { method: 'POST' }
  );
}

/**
 * Resolve a challenge (client-simulated result verification)
 */
export async function resolveChallenge(
  challengeId: string,
  result: PvpResolveRequest['result']
): Promise<PvpResolveResponse> {
  return pvpRequest<PvpResolveResponse>(
    `/v1/pvp/challenges/${encodeURIComponent(challengeId)}/resolve`,
    { method: 'POST', body: JSON.stringify({ result }) }
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
    return await pvpRequest<PvpReplayResponse>(
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
  return pvpRequest<PvpUserStats>('/v1/pvp/stats');
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
  PvpResolveResponse,
  PvpBattleStats,
  PvpResult,
  PvpReplayResponse,
  PvpUserStats,
  PvpChallengeStatus,
  PvpWinReason,
} from '@arcade/protocol';
