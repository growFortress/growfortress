import { z } from 'zod';

// ============================================================================
// BATTLE PASS CONFIGURATION
// ============================================================================

export const BATTLE_PASS_CONFIG = {
  seasonDurationDays: 30,
  maxTier: 50,
  pointsPerTier: 100,
  premiumPricePLN: 79.00,
  premiumPriceGrosze: 7900,
  tierPurchaseDustCost: 100,    // Cost to buy 1 tier with dust
} as const;

// ============================================================================
// REWARD TYPES
// ============================================================================

export const BattlePassRewardTypeSchema = z.enum([
  'dust',
  'gold',
  'material',           // Random material
  'legendary_material', // Specific legendary material
  'artifact',           // Random artifact
  'hero_summon',        // Gacha pulls
  'cosmetic',           // Skin/theme
  'hero',               // Exclusive hero
]);
export type BattlePassRewardType = z.infer<typeof BattlePassRewardTypeSchema>;

// ============================================================================
// REWARD DEFINITION
// ============================================================================

export interface BattlePassReward {
  tier: number;
  track: 'free' | 'premium';
  rewardType: BattlePassRewardType;
  amount?: number;              // For dust/gold/materials
  itemId?: string;              // For specific items
  description: string;
}

export const BattlePassRewardSchema = z.object({
  tier: z.number().int().min(1).max(50),
  track: z.enum(['free', 'premium']),
  rewardType: BattlePassRewardTypeSchema,
  amount: z.number().int().positive().optional(),
  itemId: z.string().optional(),
  description: z.string(),
});

// ============================================================================
// SEASON REWARDS (Static definition)
// ============================================================================

export const BATTLE_PASS_FREE_TRACK: BattlePassReward[] = [
  { tier: 5, track: 'free', rewardType: 'gold', amount: 100, description: '100 Gold' },
  { tier: 10, track: 'free', rewardType: 'dust', amount: 50, description: '50 Dust' },
  { tier: 15, track: 'free', rewardType: 'material', amount: 1, description: '1x Random Material' },
  { tier: 20, track: 'free', rewardType: 'gold', amount: 200, description: '200 Gold' },
  { tier: 25, track: 'free', rewardType: 'dust', amount: 100, description: '100 Dust' },
  { tier: 30, track: 'free', rewardType: 'material', amount: 1, description: '1x Rare Material' },
  { tier: 40, track: 'free', rewardType: 'dust', amount: 150, description: '150 Dust' },
  { tier: 50, track: 'free', rewardType: 'artifact', amount: 1, description: '1x Epic Artifact' },
];

export const BATTLE_PASS_PREMIUM_TRACK: BattlePassReward[] = [
  { tier: 1, track: 'premium', rewardType: 'cosmetic', itemId: 'skin_season_1_exclusive', description: 'Exclusive Season Skin' },
  { tier: 5, track: 'premium', rewardType: 'dust', amount: 500, description: '500 Dust' },
  { tier: 10, track: 'premium', rewardType: 'legendary_material', amount: 2, description: '2x Legendary Materials' },
  { tier: 15, track: 'premium', rewardType: 'dust', amount: 1000, description: '1,000 Dust' },
  { tier: 20, track: 'premium', rewardType: 'hero_summon', amount: 3, description: '3x Hero Summons' },
  { tier: 25, track: 'premium', rewardType: 'dust', amount: 1500, description: '1,500 Dust' },
  { tier: 30, track: 'premium', rewardType: 'cosmetic', itemId: 'skin_hero_season_1', description: 'Exclusive Hero Skin' },
  { tier: 40, track: 'premium', rewardType: 'dust', amount: 2000, description: '2,000 Dust' },
  { tier: 50, track: 'premium', rewardType: 'hero', itemId: 'hero_season_1', description: 'Seasonal Exclusive Hero' },
];

// Total premium track value calculation
export const BATTLE_PASS_PREMIUM_DUST_VALUE =
  BATTLE_PASS_PREMIUM_TRACK
    .filter(r => r.rewardType === 'dust')
    .reduce((sum, r) => sum + (r.amount || 0), 0); // 5,000 dust

// ============================================================================
// SEASON INFO
// ============================================================================

export const BattlePassSeasonSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  seasonNumber: z.number().int().positive(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  isActive: z.boolean(),
  featuredReward: z.string(),           // Description of tier 50 premium reward
  featuredRewardImage: z.string().optional(),
});
export type BattlePassSeason = z.infer<typeof BattlePassSeasonSchema>;

// ============================================================================
// USER PROGRESS
// ============================================================================

export const BattlePassProgressSchema = z.object({
  seasonId: z.string(),
  currentTier: z.number().int().min(0).max(50),
  currentPoints: z.number().int().min(0),
  pointsToNextTier: z.number().int(),
  isPremium: z.boolean(),
  claimedFreeTiers: z.array(z.number().int()),
  claimedPremiumTiers: z.array(z.number().int()),
  purchasedAt: z.string().datetime().optional(),  // When premium was purchased
});
export type BattlePassProgress = z.infer<typeof BattlePassProgressSchema>;

// ============================================================================
// API SCHEMAS
// ============================================================================

// Get current battle pass status
export const GetBattlePassResponseSchema = z.object({
  season: BattlePassSeasonSchema,
  progress: BattlePassProgressSchema,
  freeRewards: z.array(BattlePassRewardSchema),
  premiumRewards: z.array(BattlePassRewardSchema),
  timeRemaining: z.object({
    days: z.number().int(),
    hours: z.number().int(),
    minutes: z.number().int(),
  }),
});
export type GetBattlePassResponse = z.infer<typeof GetBattlePassResponseSchema>;

// Purchase premium battle pass
export const PurchaseBattlePassRequestSchema = z.object({
  seasonId: z.string(),
});
export type PurchaseBattlePassRequest = z.infer<typeof PurchaseBattlePassRequestSchema>;

export const PurchaseBattlePassResponseSchema = z.object({
  success: z.boolean(),
  checkoutUrl: z.string().url().optional(),   // For Stripe checkout
  sessionId: z.string().optional(),
  error: z.string().optional(),
});
export type PurchaseBattlePassResponse = z.infer<typeof PurchaseBattlePassResponseSchema>;

// Claim reward
export const ClaimBattlePassRewardRequestSchema = z.object({
  tier: z.number().int().min(1).max(50),
  track: z.enum(['free', 'premium']),
});
export type ClaimBattlePassRewardRequest = z.infer<typeof ClaimBattlePassRewardRequestSchema>;

export const ClaimBattlePassRewardResponseSchema = z.object({
  success: z.boolean(),
  rewardType: BattlePassRewardTypeSchema,
  rewardDescription: z.string(),
  amount: z.number().int().optional(),
  itemId: z.string().optional(),
  newDustBalance: z.number().int().optional(),
  newGoldBalance: z.number().int().optional(),
  error: z.string().optional(),
});
export type ClaimBattlePassRewardResponse = z.infer<typeof ClaimBattlePassRewardResponseSchema>;

// Claim all available rewards
export const ClaimAllBattlePassRewardsResponseSchema = z.object({
  claimedRewards: z.array(z.object({
    tier: z.number().int(),
    track: z.enum(['free', 'premium']),
    rewardType: BattlePassRewardTypeSchema,
    description: z.string(),
  })),
  totalDustGained: z.number().int(),
  totalGoldGained: z.number().int(),
  newDustBalance: z.number().int(),
  newGoldBalance: z.number().int(),
});
export type ClaimAllBattlePassRewardsResponse = z.infer<typeof ClaimAllBattlePassRewardsResponseSchema>;

// Purchase tiers with dust
export const BuyBattlePassTiersRequestSchema = z.object({
  tierCount: z.number().int().min(1).max(50),
});
export type BuyBattlePassTiersRequest = z.infer<typeof BuyBattlePassTiersRequestSchema>;

export const BuyBattlePassTiersResponseSchema = z.object({
  success: z.boolean(),
  tiersGained: z.number().int(),
  dustSpent: z.number().int(),
  newTier: z.number().int(),
  newDustBalance: z.number().int(),
  error: z.string().optional(),
});
export type BuyBattlePassTiersResponse = z.infer<typeof BuyBattlePassTiersResponseSchema>;

// ============================================================================
// POINT SOURCES (How players earn BP points)
// ============================================================================

export const BattlePassPointSourceSchema = z.enum([
  'daily_quest',        // 50 BP per quest (legacy, kept for compatibility)
  'weekly_challenge',   // 200 BP per challenge
  'boss_rush',          // 25 BP per boss killed
  'pvp_win',            // 30 BP per win
  'login',              // 10 BP daily
  'purchase',           // Direct tier purchase
  'achievement_claimed', // 10 BP per achievement tier claimed
]);
export type BattlePassPointSource = z.infer<typeof BattlePassPointSourceSchema>;

export const BP_POINT_VALUES: Record<BattlePassPointSource, number> = {
  daily_quest: 50,
  weekly_challenge: 200,
  boss_rush: 25,
  pvp_win: 30,
  login: 10,
  purchase: 100,  // Per tier
  achievement_claimed: 10,
};

// ============================================================================
// ERROR CODES
// ============================================================================

export const BATTLE_PASS_ERROR_CODES = {
  NO_ACTIVE_SEASON: 'NO_ACTIVE_SEASON',
  SEASON_ENDED: 'SEASON_ENDED',
  ALREADY_PREMIUM: 'ALREADY_PREMIUM',
  NOT_PREMIUM: 'NOT_PREMIUM',
  TIER_NOT_REACHED: 'TIER_NOT_REACHED',
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',
  INSUFFICIENT_DUST: 'INSUFFICIENT_DUST',
  MAX_TIER_REACHED: 'MAX_TIER_REACHED',
} as const;

export type BattlePassErrorCode = typeof BATTLE_PASS_ERROR_CODES[keyof typeof BATTLE_PASS_ERROR_CODES];
