/**
 * Achievements API client
 *
 * Provides functions to interact with the achievements system:
 * - Get all achievements with progress
 * - Claim achievement tier rewards
 * - Claim all available rewards
 * - Set active title
 */

import type {
  GetAchievementsResponse,
  ClaimAchievementRewardResponse,
  ClaimAllAchievementsResponse,
  SetActiveTitleRequest,
  SetActiveTitleResponse,
  AchievementId,
} from '@arcade/protocol';
import { request } from './base.js';

/**
 * Get all achievements with progress and lifetime stats
 */
export async function getAchievements(): Promise<GetAchievementsResponse> {
  return request<GetAchievementsResponse>('/v1/achievements', {
    method: 'GET',
  });
}

/**
 * Claim a specific achievement tier reward
 * @param achievementId - The achievement ID
 * @param tier - The tier number to claim
 */
export async function claimReward(
  achievementId: AchievementId,
  tier: number
): Promise<ClaimAchievementRewardResponse> {
  return request<ClaimAchievementRewardResponse>(
    `/v1/achievements/${achievementId}/claim/${tier}`,
    {
      method: 'POST',
    }
  );
}

/**
 * Claim all unclaimed achievement rewards
 */
export async function claimAllRewards(): Promise<ClaimAllAchievementsResponse> {
  return request<ClaimAllAchievementsResponse>('/v1/achievements/claim-all', {
    method: 'POST',
  });
}

/**
 * Set the active title (or null to clear)
 * @param title - The title to set as active, or null to clear
 */
export async function setActiveTitle(
  title: string | null
): Promise<SetActiveTitleResponse> {
  return request<SetActiveTitleResponse>('/v1/achievements/title', {
    method: 'POST',
    body: JSON.stringify({ title } satisfies SetActiveTitleRequest),
  });
}
