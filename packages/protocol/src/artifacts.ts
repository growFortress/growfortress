import { z } from 'zod';

// ============================================================================
// ARTIFACT SCHEMAS
// ============================================================================

/**
 * Artifact slot types for 3-slot system
 */
export const ArtifactSlotTypeSchema = z.enum(['weapon', 'armor', 'accessory']);
export type ArtifactSlotType = z.infer<typeof ArtifactSlotTypeSchema>;

/**
 * Artifact rarity
 */
export const ArtifactRaritySchema = z.enum(['common', 'rare', 'epic', 'legendary']);
export type ArtifactRarity = z.infer<typeof ArtifactRaritySchema>;

/**
 * Player-owned artifact with level and slot support
 */
export const PlayerArtifactSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  level: z.number().int().min(1).max(20).default(1),
  equippedSlot: ArtifactSlotTypeSchema.nullable().default(null),
  equippedToHeroId: z.string().nullable(),
  acquiredAt: z.string().datetime(),
  upgradedAt: z.string().datetime().nullable().optional(),
});

export type PlayerArtifact = z.infer<typeof PlayerArtifactSchema>;

/**
 * Player-owned item (consumable or equipment)
 */
export const PlayerItemSchema = z.object({
  itemId: z.string(),
  amount: z.number().int().min(0),
});

export type PlayerItem = z.infer<typeof PlayerItemSchema>;

// ============================================================================
// REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Get player artifacts response
 */
export const ArtifactsResponseSchema = z.object({
  artifacts: z.array(PlayerArtifactSchema),
  items: z.array(PlayerItemSchema),
});

export type ArtifactsResponse = z.infer<typeof ArtifactsResponseSchema>;

/**
 * Craft artifact request
 */
export const CraftArtifactRequestSchema = z.object({
  artifactId: z.string(),
});

export type CraftArtifactRequest = z.infer<typeof CraftArtifactRequestSchema>;

/**
 * Craft artifact response
 */
export const CraftArtifactResponseSchema = z.object({
  success: z.boolean(),
  artifact: PlayerArtifactSchema.optional(),
  newInventory: z.object({
    gold: z.number(),
    dust: z.number(),
    materials: z.record(z.string(), z.number()),
  }).optional(),
  error: z.string().optional(),
});

export type CraftArtifactResponse = z.infer<typeof CraftArtifactResponseSchema>;

/**
 * Equip artifact request (with 3-slot system support)
 */
export const EquipArtifactRequestSchema = z.object({
  artifactInstanceId: z.string(),
  heroId: z.string(),
  slotType: ArtifactSlotTypeSchema, // Required: which slot to equip to
});

export type EquipArtifactRequest = z.infer<typeof EquipArtifactRequestSchema>;

/**
 * Equip artifact response
 */
export const EquipArtifactResponseSchema = z.object({
  success: z.boolean(),
  artifact: PlayerArtifactSchema.optional(),
  unequippedArtifact: PlayerArtifactSchema.optional(), // If another artifact was unequipped from slot
  error: z.string().optional(),
});

export type EquipArtifactResponse = z.infer<typeof EquipArtifactResponseSchema>;

/**
 * Unequip artifact request
 */
export const UnequipArtifactRequestSchema = z.object({
  artifactInstanceId: z.string(),
});

export type UnequipArtifactRequest = z.infer<typeof UnequipArtifactRequestSchema>;

/**
 * Unequip artifact response
 */
export const UnequipArtifactResponseSchema = z.object({
  success: z.boolean(),
  artifact: PlayerArtifactSchema.optional(),
  error: z.string().optional(),
});

export type UnequipArtifactResponse = z.infer<typeof UnequipArtifactResponseSchema>;

/**
 * Use item request
 */
export const UseItemRequestSchema = z.object({
  itemId: z.string(),
  heroId: z.string().optional(), // Some items target a specific hero
  amount: z.number().int().min(1).default(1),
});

export type UseItemRequest = z.infer<typeof UseItemRequestSchema>;

/**
 * Use item response
 */
export const UseItemResponseSchema = z.object({
  success: z.boolean(),
  items: z.array(PlayerItemSchema).optional(),
  error: z.string().optional(),
});

export type UseItemResponse = z.infer<typeof UseItemResponseSchema>;

// ============================================================================
// CRAFTING 2.0 - UPGRADE / FUSE / DISMANTLE
// ============================================================================

/**
 * Upgrade artifact request (level 1-20)
 */
export const UpgradeArtifactRequestSchema = z.object({
  artifactInstanceId: z.string(),
  targetLevel: z.number().int().min(2).max(20).optional(), // If not provided, upgrade by 1
});

export type UpgradeArtifactRequest = z.infer<typeof UpgradeArtifactRequestSchema>;

/**
 * Upgrade cost breakdown
 */
export const UpgradeCostSchema = z.object({
  gold: z.number().int(),
  materials: z.record(z.string(), z.number().int()),
});

export type UpgradeCost = z.infer<typeof UpgradeCostSchema>;

/**
 * Upgrade artifact response
 */
export const UpgradeArtifactResponseSchema = z.object({
  success: z.boolean(),
  artifact: PlayerArtifactSchema.optional(),
  newLevel: z.number().int().optional(),
  goldSpent: z.number().int().optional(),
  materialsSpent: z.record(z.string(), z.number().int()).optional(),
  newInventory: z.object({
    gold: z.number(),
    dust: z.number(),
    materials: z.record(z.string(), z.number()),
  }).optional(),
  error: z.string().optional(),
});

export type UpgradeArtifactResponse = z.infer<typeof UpgradeArtifactResponseSchema>;

/**
 * Fuse artifacts request (3 same rarity → 1 higher rarity)
 */
export const FuseArtifactsRequestSchema = z.object({
  artifactInstanceIds: z.array(z.string()).length(3), // Exactly 3 artifacts
});

export type FuseArtifactsRequest = z.infer<typeof FuseArtifactsRequestSchema>;

/**
 * Fuse artifacts response
 */
export const FuseArtifactsResponseSchema = z.object({
  success: z.boolean(),
  resultArtifact: PlayerArtifactSchema.optional(), // Newly created artifact
  consumedArtifactIds: z.array(z.string()).optional(), // IDs of consumed artifacts
  error: z.string().optional(),
});

export type FuseArtifactsResponse = z.infer<typeof FuseArtifactsResponseSchema>;

/**
 * Dismantle artifact request (destroy → 50% materials)
 */
export const DismantleArtifactRequestSchema = z.object({
  artifactInstanceId: z.string(),
});

export type DismantleArtifactRequest = z.infer<typeof DismantleArtifactRequestSchema>;

/**
 * Dismantle artifact response
 */
export const DismantleArtifactResponseSchema = z.object({
  success: z.boolean(),
  dismantledArtifactId: z.string().optional(), // ID of destroyed artifact
  materialsRecovered: z.record(z.string(), z.number().int()).optional(), // 50% of craft cost
  goldRecovered: z.number().int().optional(),
  newInventory: z.object({
    gold: z.number(),
    dust: z.number(),
    materials: z.record(z.string(), z.number()),
  }).optional(),
  error: z.string().optional(),
});

export type DismantleArtifactResponse = z.infer<typeof DismantleArtifactResponseSchema>;

/**
 * Get upgrade cost preview request
 */
export const GetUpgradeCostRequestSchema = z.object({
  artifactInstanceId: z.string(),
  targetLevel: z.number().int().min(2).max(20),
});

export type GetUpgradeCostRequest = z.infer<typeof GetUpgradeCostRequestSchema>;

/**
 * Get upgrade cost preview response
 */
export const GetUpgradeCostResponseSchema = z.object({
  success: z.boolean(),
  currentLevel: z.number().int().optional(),
  targetLevel: z.number().int().optional(),
  cost: UpgradeCostSchema.optional(),
  canAfford: z.boolean().optional(),
  error: z.string().optional(),
});

export type GetUpgradeCostResponse = z.infer<typeof GetUpgradeCostResponseSchema>;
