/**
 * Power Upgrades API Schemas
 *
 * Zod schemas for power upgrade requests and responses.
 */

import { z } from 'zod';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

export const StatUpgradesSchema = z.object({
  hp: z.number().int().min(0).default(0),
  damage: z.number().int().min(0).default(0),
  attackSpeed: z.number().int().min(0).default(0),
  range: z.number().int().min(0).default(0),
  critChance: z.number().int().min(0).default(0),
  critMultiplier: z.number().int().min(0).default(0),
  armor: z.number().int().min(0).default(0),
  dodge: z.number().int().min(0).default(0),
});

export type StatUpgrades = z.infer<typeof StatUpgradesSchema>;

export const ItemTierSchema = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']);
export type ItemTier = z.infer<typeof ItemTierSchema>;

// Simplified stat schemas - fewer upgrades for easier progression
export const FortressUpgradableStatSchema = z.enum(['hp', 'damage', 'armor']);
export type FortressUpgradableStat = z.infer<typeof FortressUpgradableStatSchema>;

export const HeroUpgradableStatSchema = z.enum(['damage', 'attackSpeed', 'range', 'critChance']);
export type HeroUpgradableStat = z.infer<typeof HeroUpgradableStatSchema>;

export const TurretUpgradableStatSchema = z.enum(['damage', 'attackSpeed']);
export type TurretUpgradableStat = z.infer<typeof TurretUpgradableStatSchema>;

// ============================================================================
// PRESTIGE SCHEMAS
// ============================================================================

/**
 * Max prestige level for stats
 * Each prestige gives +5% permanent bonus, max 5 prestiges = +25%
 */
export const MAX_PRESTIGE_LEVEL = 5;
export const PRESTIGE_BONUS_PER_LEVEL = 0.05; // 5%

/**
 * Prestige costs (gold + dust)
 * Base: 5000 gold + 500 dust, scales x1.5 per prestige level
 */
export const PRESTIGE_COSTS = {
  baseGold: 5000,
  baseDust: 500,
  scalingMultiplier: 1.5,
} as const;

/**
 * Fortress prestige levels (one per stat)
 */
export const FortressPrestigeSchema = z.object({
  hp: z.number().int().min(0).max(MAX_PRESTIGE_LEVEL).default(0),
  damage: z.number().int().min(0).max(MAX_PRESTIGE_LEVEL).default(0),
  armor: z.number().int().min(0).max(MAX_PRESTIGE_LEVEL).default(0),
});
export type FortressPrestige = z.infer<typeof FortressPrestigeSchema>;

/**
 * Turret prestige levels
 */
export const TurretPrestigeSchema = z.object({
  turretType: z.string(),
  damage: z.number().int().min(0).max(MAX_PRESTIGE_LEVEL).default(0),
  attackSpeed: z.number().int().min(0).max(MAX_PRESTIGE_LEVEL).default(0),
});
export type TurretPrestige = z.infer<typeof TurretPrestigeSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Upgrade fortress stat request
 */
export const UpgradeFortressStatRequestSchema = z.object({
  stat: FortressUpgradableStatSchema,
});

/**
 * Prestige fortress stat request
 */
export const PrestigeFortressStatRequestSchema = z.object({
  stat: FortressUpgradableStatSchema,
});
export type PrestigeFortressStatRequest = z.infer<typeof PrestigeFortressStatRequestSchema>;

/**
 * Prestige turret stat request
 */
export const PrestigeTurretStatRequestSchema = z.object({
  turretType: z.string().min(1),
  stat: TurretUpgradableStatSchema,
});
export type PrestigeTurretStatRequest = z.infer<typeof PrestigeTurretStatRequestSchema>;
export type UpgradeFortressStatRequest = z.infer<typeof UpgradeFortressStatRequestSchema>;

/**
 * Upgrade hero stat request
 */
export const UpgradeHeroStatRequestSchema = z.object({
  heroId: z.string().min(1),
  stat: HeroUpgradableStatSchema,
});
export type UpgradeHeroStatRequest = z.infer<typeof UpgradeHeroStatRequestSchema>;

/**
 * Upgrade turret stat request
 */
export const UpgradeTurretStatRequestSchema = z.object({
  turretType: z.string().min(1),
  stat: TurretUpgradableStatSchema,
});
export type UpgradeTurretStatRequest = z.infer<typeof UpgradeTurretStatRequestSchema>;

/**
 * Upgrade item tier request
 */
export const UpgradeItemTierRequestSchema = z.object({
  itemId: z.string().min(1),
});
export type UpgradeItemTierRequest = z.infer<typeof UpgradeItemTierRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Power upgrade response (shared by all upgrade endpoints)
 */
export const PowerUpgradeResponseSchema = z.object({
  success: z.boolean(),
  newLevel: z.number().int().optional(),
  newTier: ItemTierSchema.optional(),
  goldSpent: z.number().int().min(0),
  newGold: z.number().int().min(0),
  newTotalPower: z.number().int().min(0),
  error: z.string().optional(),
});
export type PowerUpgradeResponse = z.infer<typeof PowerUpgradeResponseSchema>;

/**
 * Prestige upgrade response
 */
export const PrestigeUpgradeResponseSchema = z.object({
  success: z.boolean(),
  newPrestigeLevel: z.number().int().min(0).max(MAX_PRESTIGE_LEVEL),
  goldSpent: z.number().int().min(0),
  dustSpent: z.number().int().min(0),
  newGold: z.number().int().min(0),
  newDust: z.number().int().min(0),
  statReset: z.boolean(), // Whether stat level was reset to 0
  error: z.string().optional(),
});
export type PrestigeUpgradeResponse = z.infer<typeof PrestigeUpgradeResponseSchema>;

/**
 * Power breakdown for a single entity
 */
export const PowerBreakdownSchema = z.object({
  basePower: z.number().int(),
  upgradeMultiplier: z.number(),
  tierMultiplier: z.number(),
  totalPower: z.number().int(),
});
export type PowerBreakdown = z.infer<typeof PowerBreakdownSchema>;

/**
 * Entity power (hero or turret)
 */
export const EntityPowerSchema = z.object({
  id: z.string(),
  power: PowerBreakdownSchema,
});
export type EntityPower = z.infer<typeof EntityPowerSchema>;

/**
 * Complete power summary response
 */
export const PowerSummaryResponseSchema = z.object({
  fortressPower: PowerBreakdownSchema,
  heroPower: z.array(EntityPowerSchema),
  turretPower: z.array(EntityPowerSchema),
  itemPower: z.number().int(),
  totalPower: z.number().int(),

  // Current upgrade levels for UI
  fortressUpgrades: StatUpgradesSchema,
  heroUpgrades: z.array(
    z.object({
      heroId: z.string(),
      statUpgrades: StatUpgradesSchema,
    })
  ),
  turretUpgrades: z.array(
    z.object({
      turretType: z.string(),
      statUpgrades: StatUpgradesSchema,
    })
  ),
  itemTiers: z.array(
    z.object({
      itemId: z.string(),
      tier: ItemTierSchema,
    })
  ),
});
export type PowerSummaryResponse = z.infer<typeof PowerSummaryResponseSchema>;

/**
 * Upgrade cost info (for UI preview)
 */
export const UpgradeCostInfoSchema = z.object({
  stat: z.string(),
  currentLevel: z.number().int(),
  maxLevel: z.number().int(),
  nextUpgradeCost: z.number().int().nullable(), // null if max level
  currentBonusPercent: z.number(),
  nextBonusPercent: z.number().nullable(),
});
export type UpgradeCostInfo = z.infer<typeof UpgradeCostInfoSchema>;

/**
 * Available upgrades response (for UI)
 */
export const AvailableUpgradesResponseSchema = z.object({
  gold: z.number().int(),
  fortressUpgrades: z.array(UpgradeCostInfoSchema),
  heroUpgrades: z.record(z.string(), z.array(UpgradeCostInfoSchema)),
  turretUpgrades: z.record(z.string(), z.array(UpgradeCostInfoSchema)),
  itemUpgrades: z.array(
    z.object({
      itemId: z.string(),
      currentTier: ItemTierSchema,
      nextTier: ItemTierSchema.nullable(),
      upgradeCost: z.number().int().nullable(),
    })
  ),
});
export type AvailableUpgradesResponse = z.infer<typeof AvailableUpgradesResponseSchema>;
