import { z } from 'zod';

// ============================================================================
// Idle Rewards - Pending Rewards
// ============================================================================

export const PendingIdleRewardsResponseSchema = z.object({
  hoursOffline: z.number().min(0),
  cappedHours: z.number().min(0),
  pendingMaterials: z.record(z.string(), z.number()),
  pendingDust: z.number().min(0),
  canClaim: z.boolean(),
  minutesUntilNextClaim: z.number().min(0),
});

export type PendingIdleRewardsResponse = z.infer<typeof PendingIdleRewardsResponseSchema>;

// ============================================================================
// Idle Rewards - Claim Response
// ============================================================================

export const ClaimedRewardsSchema = z.object({
  materials: z.record(z.string(), z.number()),
  dust: z.number().min(0),
});

export const NewInventorySchema = z.object({
  materials: z.record(z.string(), z.number()),
  dust: z.number().min(0),
});

export const ClaimIdleRewardsResponseSchema = z.object({
  success: z.boolean(),
  claimed: ClaimedRewardsSchema.optional(),
  newInventory: NewInventorySchema.optional(),
  error: z.string().optional(),
});

export type ClaimIdleRewardsResponse = z.infer<typeof ClaimIdleRewardsResponseSchema>;

// ============================================================================
// Idle Rewards - Config
// ============================================================================

export const IdleRewardsConfigResponseSchema = z.object({
  commanderLevel: z.number().int().min(1),
  maxAccrualHours: z.number().min(0),
  expectedMaterialsPerHour: z.number().min(0),
  expectedMaterialsMax: z.number().min(0),
  legendaryChance: z.number().min(0).max(1),
});

export type IdleRewardsConfigResponse = z.infer<typeof IdleRewardsConfigResponseSchema>;
