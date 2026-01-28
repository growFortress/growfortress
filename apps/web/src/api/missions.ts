/**
 * Weekly Missions API client
 *
 * Provides functions to interact with the weekly missions system:
 * - Get current week's missions with progress
 * - Claim mission rewards
 * - Claim all completed missions
 */

import type {
  GetWeeklyMissionsResponse,
  ClaimMissionRewardResponse,
} from '@arcade/protocol';
import { request } from './base.js';

/**
 * Get current week's missions with player progress
 */
export async function getWeeklyMissions(): Promise<GetWeeklyMissionsResponse> {
  return request<GetWeeklyMissionsResponse>('/v1/missions/weekly', {
    method: 'GET',
  });
}

/**
 * Claim reward for a completed mission
 * @param missionId - The mission ID to claim
 */
export async function claimMissionReward(
  missionId: string
): Promise<ClaimMissionRewardResponse> {
  return request<ClaimMissionRewardResponse>(`/v1/missions/${missionId}/claim`, {
    method: 'POST',
  });
}

/**
 * Claim all completed but unclaimed mission rewards
 */
export async function claimAllMissionRewards(): Promise<{
  success: boolean;
  claimedCount: number;
  totalGold: number;
  totalDust: number;
  totalMaterials: Record<string, number>;
  newInventory: { gold: number; dust: number; materials: Record<string, number> };
}> {
  return request('/v1/missions/claim-all', {
    method: 'POST',
  });
}
