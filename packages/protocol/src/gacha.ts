import { z } from 'zod';

// ============================================================================
// GACHA TYPES
// ============================================================================

export const GachaTypeSchema = z.enum([
  'hero',       // Hero summon banner
  'artifact',   // Artifact chest
]);
export type GachaType = z.infer<typeof GachaTypeSchema>;

export const GachaRaritySchema = z.enum([
  'common',
  'rare',
  'epic',
  'legendary',
]);
export type GachaRarity = z.infer<typeof GachaRaritySchema>;

// ============================================================================
// HERO GACHA CONFIGURATION
// ============================================================================

export const HERO_GACHA_CONFIG = {
  singlePullCost: 300,          // Dust
  tenPullCost: 2700,            // 10% discount
  pityThreshold: 50,            // Guaranteed Epic+ every 50 pulls
  sparkThreshold: 100,          // Choose any hero after 100 pulls

  // Drop rates (must sum to 100)
  rates: {
    common: 60,
    rare: 30,
    epic: 8,
    legendary: 2,
  },

  // Shard conversion for duplicates
  shardConversion: {
    common: 50,
    rare: 100,
    epic: 200,
    legendary: 500,
  },

  // Shards needed for tier upgrade
  shardsPerTierUpgrade: 100,
} as const;

// ============================================================================
// ARTIFACT GACHA CONFIGURATION
// ============================================================================

export const ArtifactChestTypeSchema = z.enum([
  'common',         // 100 Dust - 70% Common, 25% Rare, 5% Epic
  'premium',        // 300 Dust - 40% Rare, 45% Epic, 15% Legendary
  'legendary',      // 800 Dust - 100% Legendary
  'weapon',         // 400 Dust - Epic+ Weapon slot
  'armor',          // 400 Dust - Epic+ Armor slot
]);
export type ArtifactChestType = z.infer<typeof ArtifactChestTypeSchema>;

export interface ArtifactChestConfig {
  id: ArtifactChestType;
  name: string;
  dustCost: number;
  rates: Record<GachaRarity, number>;
  slotFilter?: string;          // For targeted chests
  pityCount?: number;           // Pity for this chest type
}

export const ARTIFACT_CHEST_CONFIGS: ArtifactChestConfig[] = [
  {
    id: 'common',
    name: 'Common Chest',
    dustCost: 100,
    rates: { common: 70, rare: 25, epic: 5, legendary: 0 },
  },
  {
    id: 'premium',
    name: 'Premium Chest',
    dustCost: 300,
    rates: { common: 0, rare: 40, epic: 45, legendary: 15 },
    pityCount: 10,    // Guaranteed Legendary every 10
  },
  {
    id: 'legendary',
    name: 'Legendary Chest',
    dustCost: 800,
    rates: { common: 0, rare: 0, epic: 0, legendary: 100 },
  },
  {
    id: 'weapon',
    name: 'Weapon Chest',
    dustCost: 400,
    rates: { common: 0, rare: 0, epic: 70, legendary: 30 },
    slotFilter: 'weapon',
  },
  {
    id: 'armor',
    name: 'Armor Chest',
    dustCost: 400,
    rates: { common: 0, rare: 0, epic: 70, legendary: 30 },
    slotFilter: 'armor',
  },
];

// ============================================================================
// GACHA PULL REQUEST/RESPONSE
// ============================================================================

// Hero Gacha Pull
export const HeroGachaPullRequestSchema = z.object({
  pullCount: z.enum(['single', 'ten']),
});
export type HeroGachaPullRequest = z.infer<typeof HeroGachaPullRequestSchema>;

export const HeroGachaPullResultSchema = z.object({
  heroId: z.string(),
  heroName: z.string(),
  rarity: GachaRaritySchema,
  isNew: z.boolean(),
  shardsGranted: z.number().int().optional(),   // If duplicate
});
export type HeroGachaPullResult = z.infer<typeof HeroGachaPullResultSchema>;

export const HeroGachaPullResponseSchema = z.object({
  results: z.array(HeroGachaPullResultSchema),
  dustSpent: z.number().int(),
  newDustBalance: z.number().int(),
  pityCount: z.number().int(),          // Current pity counter
  sparkCount: z.number().int(),         // Current spark counter
  totalShards: z.number().int(),        // User's total shards
});
export type HeroGachaPullResponse = z.infer<typeof HeroGachaPullResponseSchema>;

// Artifact Gacha Pull
export const ArtifactGachaPullRequestSchema = z.object({
  chestType: ArtifactChestTypeSchema,
  count: z.number().int().min(1).max(10).default(1),
});
export type ArtifactGachaPullRequest = z.infer<typeof ArtifactGachaPullRequestSchema>;

export const ArtifactGachaPullResultSchema = z.object({
  artifactId: z.string(),
  artifactName: z.string(),
  rarity: GachaRaritySchema,
  slot: z.string(),
  isNew: z.boolean(),
});
export type ArtifactGachaPullResult = z.infer<typeof ArtifactGachaPullResultSchema>;

export const ArtifactGachaPullResponseSchema = z.object({
  results: z.array(ArtifactGachaPullResultSchema),
  dustSpent: z.number().int(),
  newDustBalance: z.number().int(),
  pityCount: z.number().int().optional(),   // For premium chest
});
export type ArtifactGachaPullResponse = z.infer<typeof ArtifactGachaPullResponseSchema>;

// ============================================================================
// SPARK SYSTEM (Pity shop for hero gacha)
// ============================================================================

export const SparkRedeemRequestSchema = z.object({
  heroId: z.string().min(1),
});
export type SparkRedeemRequest = z.infer<typeof SparkRedeemRequestSchema>;

export const SparkRedeemResponseSchema = z.object({
  success: z.boolean(),
  heroId: z.string(),
  heroName: z.string(),
  sparkSpent: z.number().int(),
  remainingSpark: z.number().int(),
});
export type SparkRedeemResponse = z.infer<typeof SparkRedeemResponseSchema>;

// ============================================================================
// SHARD SYSTEM
// ============================================================================

export const UseHeroShardsRequestSchema = z.object({
  heroId: z.string().min(1),
  upgradeType: z.enum(['tier']),  // Can add more upgrade types later
});
export type UseHeroShardsRequest = z.infer<typeof UseHeroShardsRequestSchema>;

export const UseHeroShardsResponseSchema = z.object({
  success: z.boolean(),
  heroId: z.string(),
  shardsSpent: z.number().int(),
  remainingShards: z.number().int(),
  newTier: z.number().int().optional(),
});
export type UseHeroShardsResponse = z.infer<typeof UseHeroShardsResponseSchema>;

// ============================================================================
// GACHA STATUS (User's current gacha state)
// ============================================================================

export const GachaStatusResponseSchema = z.object({
  heroPityCount: z.number().int(),
  heroSparkCount: z.number().int(),
  heroShards: z.number().int(),
  artifactPityCount: z.record(ArtifactChestTypeSchema, z.number().int()),
  lastHeroPull: z.string().datetime().optional(),
  lastArtifactPull: z.string().datetime().optional(),
});
export type GachaStatusResponse = z.infer<typeof GachaStatusResponseSchema>;

// ============================================================================
// GACHA HISTORY
// ============================================================================

export const GachaPullRecordSchema = z.object({
  id: z.string(),
  gachaType: GachaTypeSchema,
  itemId: z.string(),
  itemName: z.string(),
  rarity: GachaRaritySchema,
  isNew: z.boolean(),
  dustSpent: z.number().int(),
  createdAt: z.string().datetime(),
});
export type GachaPullRecord = z.infer<typeof GachaPullRecordSchema>;

export const GetGachaHistoryQuerySchema = z.object({
  gachaType: GachaTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GetGachaHistoryQuery = z.infer<typeof GetGachaHistoryQuerySchema>;

export const GetGachaHistoryResponseSchema = z.object({
  pulls: z.array(GachaPullRecordSchema),
  total: z.number().int(),
  hasMore: z.boolean(),
});
export type GetGachaHistoryResponse = z.infer<typeof GetGachaHistoryResponseSchema>;

// ============================================================================
// GACHA BANNER (For limited time banners)
// ============================================================================

export const GachaBannerSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  gachaType: GachaTypeSchema,
  featuredItems: z.array(z.string()),     // Featured hero/artifact IDs
  rateUpMultiplier: z.number(),           // e.g., 2x for featured items
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean(),
  priority: z.number().int(),             // Higher = shows first
  imageUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GachaBanner = z.infer<typeof GachaBannerSchema>;

export const GetActiveBannersResponseSchema = z.object({
  banners: z.array(GachaBannerSchema),
});
export type GetActiveBannersResponse = z.infer<typeof GetActiveBannersResponseSchema>;

// Admin banner management schemas
export const CreateBannerRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  gachaType: GachaTypeSchema,
  featuredItems: z.array(z.string()).min(1),
  rateUpMultiplier: z.number().min(1).max(10).default(2.0),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  priority: z.number().int().min(0).max(100).default(0),
  imageUrl: z.string().url().optional(),
});
export type CreateBannerRequest = z.infer<typeof CreateBannerRequestSchema>;

export const UpdateBannerRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  gachaType: GachaTypeSchema.optional(),
  featuredItems: z.array(z.string()).min(1).optional(),
  rateUpMultiplier: z.number().min(1).max(10).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  imageUrl: z.string().url().nullable().optional(),
});
export type UpdateBannerRequest = z.infer<typeof UpdateBannerRequestSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const GACHA_ERROR_CODES = {
  INSUFFICIENT_DUST: 'INSUFFICIENT_DUST',
  INSUFFICIENT_SHARDS: 'INSUFFICIENT_SHARDS',
  INSUFFICIENT_SPARK: 'INSUFFICIENT_SPARK',
  HERO_ALREADY_MAX_TIER: 'HERO_ALREADY_MAX_TIER',
  HERO_NOT_OWNED: 'HERO_NOT_OWNED',
  INVALID_CHEST_TYPE: 'INVALID_CHEST_TYPE',
  INVALID_PULL_COUNT: 'INVALID_PULL_COUNT',
  BANNER_NOT_ACTIVE: 'BANNER_NOT_ACTIVE',
} as const;

export type GachaErrorCode = typeof GACHA_ERROR_CODES[keyof typeof GACHA_ERROR_CODES];
