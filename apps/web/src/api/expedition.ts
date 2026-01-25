/**
 * Expedition API
 *
 * Client-side functions for the expedition system (offline wave progress).
 */

import { request } from './base.js';

export interface ExpeditionStatus {
  isActive: boolean;
  startedAt: string | null;
  hoursElapsed: number;
  wavesCleared: number;
  maxWavesPerHour: number;
  pendingRewards: {
    gold: number;
    dust: number;
    xp: number;
    materials: Record<string, number>;
  };
  maxOfflineHours: number;
  canClaim: boolean;
}

export interface ExpeditionRewards {
  gold: number;
  dust: number;
  xp: number;
  materials: Record<string, number>;
  wavesCleared: number;
}

export interface LoadoutSnapshot {
  heroIds: string[];
  turretIds: string[];
  fortressClass: string;
  artifactIds: string[];
}

interface ExpeditionStatusResponse {
  status: ExpeditionStatus;
}

interface ExpeditionStartResponse {
  status: ExpeditionStatus;
  message: string;
}

interface ExpeditionClaimResponse {
  rewards: ExpeditionRewards;
  message: string;
}

interface ExpeditionCancelResponse {
  message: string;
}

/**
 * Get expedition status
 */
export async function getExpeditionStatus(): Promise<ExpeditionStatus> {
  const response = await request<ExpeditionStatusResponse>('/v1/expedition/status');
  return response.status;
}

/**
 * Start an expedition
 */
export async function startExpedition(
  loadout: LoadoutSnapshot,
  power: number,
  highestWave: number
): Promise<ExpeditionStatus> {
  const response = await request<ExpeditionStartResponse>('/v1/expedition/start', {
    method: 'POST',
    body: JSON.stringify({ loadout, power, highestWave }),
  });
  return response.status;
}

/**
 * Claim expedition rewards
 */
export async function claimExpeditionRewards(): Promise<ExpeditionRewards> {
  const response = await request<ExpeditionClaimResponse>('/v1/expedition/claim', {
    method: 'POST',
  });
  return response.rewards;
}

/**
 * Cancel expedition (forfeits rewards)
 */
export async function cancelExpedition(): Promise<void> {
  await request<ExpeditionCancelResponse>('/v1/expedition/cancel', {
    method: 'POST',
  });
}
