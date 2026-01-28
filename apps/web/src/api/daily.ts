/**
 * Daily Login API client
 *
 * Provides functions to interact with the daily login system:
 * - Get daily login status
 * - Claim daily reward
 */

import type {
  DailyLoginStatusResponse,
  ClaimDailyRewardResponse,
} from '@arcade/protocol';
import { request } from './base.js';

/**
 * Get daily login status including current day, streak, and available rewards
 */
export async function getDailyStatus(): Promise<DailyLoginStatusResponse> {
  return request<DailyLoginStatusResponse>('/v1/daily/status', {
    method: 'GET',
  });
}

/**
 * Claim today's daily login reward
 */
export async function claimDailyReward(): Promise<ClaimDailyRewardResponse> {
  return request<ClaimDailyRewardResponse>('/v1/daily/claim', {
    method: 'POST',
  });
}
