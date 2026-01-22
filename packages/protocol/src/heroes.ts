import { z } from 'zod';
import { HeroIdSchema, InventorySchema } from './auth.js';

/**
 * Hero rarity types
 */
export const HeroRaritySchema = z.enum(['starter', 'common', 'rare', 'epic']);
export type HeroRarity = z.infer<typeof HeroRaritySchema>;

/**
 * Hero unlock costs by rarity
 */
export const HERO_UNLOCK_COSTS: Record<HeroRarity, { gold: number; dust: number }> = {
  starter: { gold: 0, dust: 0 },
  common: { gold: 3000, dust: 500 },
  rare: { gold: 6000, dust: 1000 },
  epic: { gold: 12000, dust: 2000 },
} as const;

/**
 * Turret unlock costs (flat cost for all turrets)
 */
export const TURRET_UNLOCK_COST = { gold: 3000, dust: 0 } as const;

/**
 * Free starter heroes (automatically available at level 1)
 */
export const FREE_STARTER_HEROES = [
  'vanguard',
  'storm',
  'medic',
  'pyro',
] as const;

/**
 * Map legacy hero IDs to new canonical IDs
 * Used for backwards compatibility with old client data
 */
export const LEGACY_HERO_ID_MAP: Record<string, string> = {
  shield_captain: 'vanguard',
  thunderlord: 'storm',
  scarlet_mage: 'rift',
  iron_sentinel: 'forge',
  jade_titan: 'titan',
  frost_archer: 'frost_unit',
} as const;

/**
 * Normalize a hero ID, mapping legacy IDs to their canonical versions
 */
export function normalizeHeroId(heroId: string): string {
  return LEGACY_HERO_ID_MAP[heroId] ?? heroId;
}

/**
 * Free starter turrets (automatically available at level 1)
 */
export const FREE_STARTER_TURRETS = [
  'railgun',
] as const;

/**
 * Unlock hero request
 */
export const UnlockHeroRequestSchema = z.object({
  heroId: HeroIdSchema,
});

export type UnlockHeroRequest = z.infer<typeof UnlockHeroRequestSchema>;

/**
 * Unlock hero response
 */
export const UnlockHeroResponseSchema = z.object({
  success: z.boolean(),
  heroId: HeroIdSchema,
  unlockedHeroIds: z.array(HeroIdSchema),
  inventory: InventorySchema,
  error: z.string().optional(),
});

export type UnlockHeroResponse = z.infer<typeof UnlockHeroResponseSchema>;

/**
 * Unlock turret request
 */
export const UnlockTurretRequestSchema = z.object({
  turretType: z.string(),
});

export type UnlockTurretRequest = z.infer<typeof UnlockTurretRequestSchema>;

/**
 * Unlock turret response
 */
export const UnlockTurretResponseSchema = z.object({
  success: z.boolean(),
  turretType: z.string(),
  unlockedTurretIds: z.array(z.string()),
  inventory: InventorySchema,
  error: z.string().optional(),
});

export type UnlockTurretResponse = z.infer<typeof UnlockTurretResponseSchema>;
