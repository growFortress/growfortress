/**
 * Pillar Unlocks API
 *
 * Handles pillar unlock-related API calls for level-gated world progression.
 */

import { request } from './base.js';
import type { GetPillarUnlocksResponse } from '@arcade/protocol';

/**
 * Get current pillar unlock status for the authenticated user
 */
export async function getPillarUnlocks(): Promise<GetPillarUnlocksResponse> {
  return request<GetPillarUnlocksResponse>('/v1/pillars/unlocks');
}
