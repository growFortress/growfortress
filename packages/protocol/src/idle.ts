import { z } from 'zod';

// ============================================================================
// Colony Status (for offline income)
// ============================================================================

export const ColonyStatusSchema = z.object({
  id: z.string(),
  name: z.string(),
  level: z.number().int().min(0),
  maxLevel: z.number().int().min(1),
  goldPerHour: z.number().min(0),
  pendingGold: z.number().min(0),
  upgradeCost: z.number().min(0),
  canUpgrade: z.boolean(),
  unlocked: z.boolean(),
  unlockLevel: z.number().int().min(0),
});

export type ColonyStatus = z.infer<typeof ColonyStatusSchema>;

// ============================================================================
// Idle Rewards - Pending Rewards
// ============================================================================

export const PendingIdleRewardsResponseSchema = z.object({
  hoursOffline: z.number().min(0),
  cappedHours: z.number().min(0),
  pendingMaterials: z.record(z.string(), z.number()),
  pendingDust: z.number().min(0),
  pendingGold: z.number().min(0),
  canClaim: z.boolean(),
  minutesUntilNextClaim: z.number().min(0),
  // Colony data
  colonies: z.array(ColonyStatusSchema),
  totalGoldPerHour: z.number().min(0),
});

export type PendingIdleRewardsResponse = z.infer<typeof PendingIdleRewardsResponseSchema>;

// ============================================================================
// Idle Rewards - Claim Response
// ============================================================================

export const ClaimedRewardsSchema = z.object({
  materials: z.record(z.string(), z.number()),
  dust: z.number().min(0),
  gold: z.number().min(0),
});

export const NewInventorySchema = z.object({
  materials: z.record(z.string(), z.number()),
  dust: z.number().min(0),
  gold: z.number().min(0),
});

export const ClaimIdleRewardsResponseSchema = z.object({
  success: z.boolean(),
  claimed: ClaimedRewardsSchema.optional(),
  newInventory: NewInventorySchema.optional(),
  error: z.string().optional(),
});

export type ClaimIdleRewardsResponse = z.infer<typeof ClaimIdleRewardsResponseSchema>;

// ============================================================================
// Colony Upgrade
// ============================================================================

export const UpgradeColonyRequestSchema = z.object({
  colonyId: z.string(),
});

export type UpgradeColonyRequest = z.infer<typeof UpgradeColonyRequestSchema>;

export const UpgradeColonyResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  newLevel: z.number().int().min(0).optional(),
  newGoldPerHour: z.number().min(0).optional(),
  nextUpgradeCost: z.number().min(0).optional(),
  newInventoryGold: z.number().min(0).optional(),
});

export type UpgradeColonyResponse = z.infer<typeof UpgradeColonyResponseSchema>;

// ============================================================================
// Idle Rewards - Config
// ============================================================================

export const IdleRewardsConfigResponseSchema = z.object({
  commanderLevel: z.number().int().min(1),
  maxAccrualHours: z.number().min(0),
  expectedMaterialsPerHour: z.number().min(0),
  expectedMaterialsMax: z.number().min(0),
  expectedDustPerHour: z.number().min(0),
  expectedDustMax: z.number().min(0),
  legendaryChance: z.number().min(0).max(1),
});

export type IdleRewardsConfigResponse = z.infer<typeof IdleRewardsConfigResponseSchema>;
