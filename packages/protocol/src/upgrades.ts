import { z } from 'zod';

/**
 * Hero upgrade request
 */
export const UpgradeHeroRequestSchema = z.object({
  heroId: z.string(),
  currentTier: z.number().int().min(1).max(2),
});

export type UpgradeHeroRequest = z.infer<typeof UpgradeHeroRequestSchema>;

/**
 * Hero upgrade response
 */
export const UpgradeHeroResponseSchema = z.object({
  success: z.boolean(),
  newTier: z.number().int(),
  newInventory: z.object({
    gold: z.number().int(),
    dust: z.number().int(),
  }),
});

export type UpgradeHeroResponse = z.infer<typeof UpgradeHeroResponseSchema>;

/**
 * Turret upgrade request
 */
export const UpgradeTurretRequestSchema = z.object({
  turretType: z.string(),
  slotIndex: z.number().int().min(0),
  currentTier: z.number().int().min(1).max(2),
});

export type UpgradeTurretRequest = z.infer<typeof UpgradeTurretRequestSchema>;

/**
 * Turret upgrade response
 */
export const UpgradeTurretResponseSchema = z.object({
  success: z.boolean(),
  newTier: z.number().int(),
  newInventory: z.object({
    gold: z.number().int(),
    dust: z.number().int(),
  }),
});

export type UpgradeTurretResponse = z.infer<typeof UpgradeTurretResponseSchema>;

/**
 * Upgrade costs
 */
export const HERO_UPGRADE_COSTS = {
  '1_to_2': { gold: 7500, dust: 20 },   // Tier 2
  '2_to_3': { gold: 20000, dust: 40 },  // Tier 3
} as const;

export const TURRET_UPGRADE_COSTS = {
  '1_to_2': { gold: 7500, dust: 20 },   // Tier 2
  '2_to_3': { gold: 20000, dust: 40 },  // Tier 3
} as const;
