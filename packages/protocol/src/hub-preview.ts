import { z } from 'zod';

// ==========================================
// HUB PREVIEW - View other players' hubs
// ==========================================

/**
 * Equipped artifact info for hub preview
 */
export const HubPreviewArtifactSchema = z.object({
  artifactId: z.string(),
  slotType: z.enum(['weapon', 'armor', 'accessory']),
  level: z.number().int().min(1).max(20),
});
export type HubPreviewArtifact = z.infer<typeof HubPreviewArtifactSchema>;

/**
 * Hero info for hub preview
 */
export const HubPreviewHeroSchema = z.object({
  heroId: z.string(),
  tier: z.number().int().min(1).max(3),
  level: z.number().int().min(0),
  equippedArtifacts: z.array(HubPreviewArtifactSchema),
});
export type HubPreviewHero = z.infer<typeof HubPreviewHeroSchema>;

/**
 * Turret info for hub preview
 */
export const HubPreviewTurretSchema = z.object({
  turretType: z.string(),
  tier: z.number().int().min(1).max(3),
  level: z.number().int().min(0),
  slotIndex: z.number().int().min(0).max(5),
});
export type HubPreviewTurret = z.infer<typeof HubPreviewTurretSchema>;

/**
 * Full hub preview response
 */
export const HubPreviewResponseSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  guildId: z.string().nullable(),
  guildTag: z.string().nullable(),
  level: z.number().int().min(1),
  highestWave: z.number().int().min(0),
  totalPower: z.number().int().min(0),
  fortressClass: z.string(),
  exclusiveItems: z.array(z.string()),
  heroes: z.array(HubPreviewHeroSchema),
  turrets: z.array(HubPreviewTurretSchema),
});
export type HubPreviewResponse = z.infer<typeof HubPreviewResponseSchema>;

/**
 * Request params for hub preview
 */
export const HubPreviewRequestSchema = z.object({
  userId: z.string().min(1),
});
export type HubPreviewRequest = z.infer<typeof HubPreviewRequestSchema>;
