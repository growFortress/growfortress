import { z } from 'zod';

// ============================================================================
// ARTIFACT SCHEMAS
// ============================================================================

/**
 * Player-owned artifact
 */
export const PlayerArtifactSchema = z.object({
  id: z.string(),
  artifactId: z.string(),
  equippedToHeroId: z.string().nullable(),
  acquiredAt: z.string().datetime(),
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
 * Equip artifact request
 */
export const EquipArtifactRequestSchema = z.object({
  artifactInstanceId: z.string(),
  heroId: z.string(),
});

export type EquipArtifactRequest = z.infer<typeof EquipArtifactRequestSchema>;

/**
 * Equip artifact response
 */
export const EquipArtifactResponseSchema = z.object({
  success: z.boolean(),
  artifact: PlayerArtifactSchema.optional(),
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
