/**
 * Pillar Unlocks API
 *
 * Handles pillar unlock-related API calls for dust-gated world progression.
 */

import { request } from './base.js';
import type {
  GetPillarUnlocksResponse,
  UnlockPillarResponse,
  PillarUnlockId,
} from '@arcade/protocol';

/**
 * Get current pillar unlock status for the authenticated user
 */
export async function getPillarUnlocks(): Promise<GetPillarUnlocksResponse> {
  return request<GetPillarUnlocksResponse>('/v1/pillars/unlocks');
}

/**
 * Unlock a specific pillar using dust
 */
export async function unlockPillar(pillarId: PillarUnlockId): Promise<UnlockPillarResponse> {
  return request<UnlockPillarResponse>(`/v1/pillars/${encodeURIComponent(pillarId)}/unlock`, {
    method: 'POST',
  });
}
