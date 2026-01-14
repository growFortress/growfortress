/**
 * Daily Quests API client
 *
 * Provides functions to interact with the daily quest system:
 * - Get current quest progress
 * - Claim individual quest rewards
 * - Claim all completed quest rewards
 */

import type {
  DailyQuestsResponse,
  ClaimQuestRewardResponse,
  ClaimAllQuestsResponse,
  DailyQuestId,
} from '@arcade/protocol';
import { request } from './base.js';

/**
 * Get all daily quest progress for the current user
 */
export async function getDailyQuests(): Promise<DailyQuestsResponse> {
  return request<DailyQuestsResponse>('/v1/daily-quests', {
    method: 'GET',
  });
}

/**
 * Claim reward for a specific completed quest
 * @param questId - The ID of the quest to claim
 */
export async function claimQuestReward(
  questId: DailyQuestId
): Promise<ClaimQuestRewardResponse> {
  return request<ClaimQuestRewardResponse>(`/v1/daily-quests/${questId}/claim`, {
    method: 'POST',
  });
}

/**
 * Claim all completed but unclaimed quest rewards
 */
export async function claimAllQuestRewards(): Promise<ClaimAllQuestsResponse> {
  return request<ClaimAllQuestsResponse>('/v1/daily-quests/claim-all', {
    method: 'POST',
  });
}
