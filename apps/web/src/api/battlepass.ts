/**
 * Battle Pass API client
 *
 * Provides functions to interact with the battle pass system:
 * - Get current season and user progress
 * - Claim tier rewards
 * - Purchase tiers with dust
 * - Upgrade to premium
 */

import type {
  GetBattlePassResponse,
  ClaimBattlePassRewardRequest,
  ClaimBattlePassRewardResponse,
  ClaimAllBattlePassRewardsResponse,
  BuyBattlePassTiersRequest,
  BuyBattlePassTiersResponse,
  PurchaseBattlePassResponse,
} from '@arcade/protocol';
import { request } from './base.js';

/**
 * Get current battle pass season and user progress
 */
export async function getBattlePass(): Promise<GetBattlePassResponse> {
  return request<GetBattlePassResponse>('/v1/battlepass', {
    method: 'GET',
  });
}

/**
 * Claim a single tier reward
 * @param tier - The tier number to claim
 * @param track - 'free' or 'premium' track
 */
export async function claimReward(
  data: ClaimBattlePassRewardRequest
): Promise<ClaimBattlePassRewardResponse> {
  return request<ClaimBattlePassRewardResponse>('/v1/battlepass/claim', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Claim all available rewards
 */
export async function claimAllRewards(): Promise<ClaimAllBattlePassRewardsResponse> {
  return request<ClaimAllBattlePassRewardsResponse>('/v1/battlepass/claim-all', {
    method: 'POST',
  });
}

/**
 * Purchase tiers with dust
 * @param tierCount - Number of tiers to purchase
 */
export async function purchaseTiers(
  data: BuyBattlePassTiersRequest
): Promise<BuyBattlePassTiersResponse> {
  return request<BuyBattlePassTiersResponse>('/v1/battlepass/purchase-tier', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Upgrade to premium battle pass (creates Stripe checkout session)
 * @param successUrl - URL to redirect to after successful payment
 * @param cancelUrl - URL to redirect to if payment is cancelled
 */
export async function upgradeToPremium(
  successUrl?: string,
  cancelUrl?: string
): Promise<PurchaseBattlePassResponse> {
  return request<PurchaseBattlePassResponse>('/v1/battlepass/upgrade-premium', {
    method: 'POST',
    body: JSON.stringify({ successUrl, cancelUrl }),
  });
}
