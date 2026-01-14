import { z } from 'zod';

// ============================================================================
// Bulk Rewards
// ============================================================================

export const BulkRewardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: z.string(),
  value: z.string(),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
});

export type BulkReward = z.infer<typeof BulkRewardSchema>;

export const BulkRewardsResponseSchema = z.array(BulkRewardSchema);

export type BulkRewardsResponse = z.infer<typeof BulkRewardsResponseSchema>;

// ============================================================================
// Claim Bulk Reward
// ============================================================================

export const ClaimBulkRewardResponseSchema = z.object({
  success: z.boolean(),
  rewardId: z.string(),
});

export type ClaimBulkRewardResponse = z.infer<typeof ClaimBulkRewardResponseSchema>;
