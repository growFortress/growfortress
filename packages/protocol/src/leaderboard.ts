import { z } from 'zod';

// Leaderboard entry
export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  userId: z.string(),
  displayName: z.string(),
  score: z.number().int().min(0),
  wavesCleared: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

// Leaderboard query params
export const LeaderboardQuerySchema = z.object({
  week: z.string().optional(), // ISO week format: "2024-W01"
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;

// Leaderboard response
export const LeaderboardResponseSchema = z.object({
  weekKey: z.string(),
  entries: z.array(LeaderboardEntrySchema),
  total: z.number().int().min(0),
  userRank: z.number().int().min(1).optional(),
  userScore: z.number().int().min(0).optional(),
});

export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

// ==========================================
// PLAYER LEADERBOARDS (Extended System)
// ==========================================

// Player leaderboard categories
export const PlayerLeaderboardCategorySchema = z.enum([
  'totalWaves',
  'honor',
  'level',
  'weeklyWaves',
  'weeklyHonor',
]);

export type PlayerLeaderboardCategory = z.infer<typeof PlayerLeaderboardCategorySchema>;

// Player leaderboard entry (with extended info)
export const PlayerLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  userId: z.string(),
  displayName: z.string(),
  guildId: z.string().nullable(),
  guildTag: z.string().nullable(),
  level: z.number().int().min(1),
  score: z.number().int().min(0),
  exclusiveItems: z.array(z.string()),
  rankChange: z.number().int().optional(),
  isOnline: z.boolean().optional(),
});

export type PlayerLeaderboardEntry = z.infer<typeof PlayerLeaderboardEntrySchema>;

// Time until weekly reset
export const TimeUntilResetSchema = z.object({
  days: z.number().int().min(0),
  hours: z.number().int().min(0),
  minutes: z.number().int().min(0),
  totalMs: z.number().int().min(0),
});

export type TimeUntilReset = z.infer<typeof TimeUntilResetSchema>;

// Player leaderboard response
export const PlayerLeaderboardResponseSchema = z.object({
  category: PlayerLeaderboardCategorySchema,
  entries: z.array(PlayerLeaderboardEntrySchema),
  total: z.number().int().min(0),
  weekKey: z.string().optional(),
  timeUntilReset: TimeUntilResetSchema.optional(),
});

export type PlayerLeaderboardResponse = z.infer<typeof PlayerLeaderboardResponseSchema>;

// User rank info for a single category
export const UserRankInfoSchema = z.object({
  category: PlayerLeaderboardCategorySchema,
  rank: z.number().int().min(1).nullable(),
  score: z.number().int().min(0),
  rankChange: z.number().int().optional(),
});

export type UserRankInfo = z.infer<typeof UserRankInfoSchema>;

// User ranks response (all categories)
export const UserRanksResponseSchema = z.object({
  ranks: z.array(UserRankInfoSchema),
  weekKey: z.string(),
  timeUntilReset: TimeUntilResetSchema,
});

export type UserRanksResponse = z.infer<typeof UserRanksResponseSchema>;

// Available reward from weekly leaderboard
export const AvailableRewardSchema = z.object({
  id: z.string(),
  weekKey: z.string(),
  category: z.enum(['waves', 'honor']),
  rank: z.number().int().min(1),
  goldAmount: z.number().int().min(0),
  dustAmount: z.number().int().min(0),
  sigilsAmount: z.number().int().min(0),
  itemIds: z.array(z.string()),
  expiresAt: z.string().datetime(),
});

export type AvailableReward = z.infer<typeof AvailableRewardSchema>;

// Available rewards response
export const AvailableRewardsResponseSchema = z.object({
  rewards: z.array(AvailableRewardSchema),
});

export type AvailableRewardsResponse = z.infer<typeof AvailableRewardsResponseSchema>;

// Claim reward request
export const ClaimRewardRequestSchema = z.object({
  rewardId: z.string(),
});

export type ClaimRewardRequest = z.infer<typeof ClaimRewardRequestSchema>;

// Claim reward response
export const ClaimRewardResponseSchema = z.object({
  success: z.boolean(),
  goldAmount: z.number().int().min(0),
  dustAmount: z.number().int().min(0),
  sigilsAmount: z.number().int().min(0),
  itemIds: z.array(z.string()),
  newExclusiveItems: z.array(z.string()),
});

export type ClaimRewardResponse = z.infer<typeof ClaimRewardResponseSchema>;

// Player weeks response
export const PlayerWeeksResponseSchema = z.object({
  currentWeek: z.string(),
  weeks: z.array(z.string()),
  timeUntilReset: TimeUntilResetSchema,
});

export type PlayerWeeksResponse = z.infer<typeof PlayerWeeksResponseSchema>;

// Exclusive item type/rarity
export const ExclusiveItemTypeSchema = z.enum(['frame', 'title', 'badge', 'aura', 'effect']);
export const ExclusiveItemRaritySchema = z.enum(['rare', 'epic', 'legendary', 'mythic']);
export const ExclusiveItemCategorySchema = z.enum(['waves', 'honor']);

export type ExclusiveItemType = z.infer<typeof ExclusiveItemTypeSchema>;
export type ExclusiveItemRarity = z.infer<typeof ExclusiveItemRaritySchema>;
export type ExclusiveItemCategory = z.infer<typeof ExclusiveItemCategorySchema>;

// Exclusive item schema
export const ExclusiveItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  polishName: z.string(),
  description: z.string(),
  type: ExclusiveItemTypeSchema,
  rarity: ExclusiveItemRaritySchema,
  category: ExclusiveItemCategorySchema,
  icon: z.string(),
  color: z.string(),
  glowColor: z.string().optional(),
  effect: z.string().optional(),
});

export type ExclusiveItem = z.infer<typeof ExclusiveItemSchema>;

// Exclusive items response
export const ExclusiveItemsResponseSchema = z.object({
  items: z.array(ExclusiveItemSchema),
});

export type ExclusiveItemsResponse = z.infer<typeof ExclusiveItemsResponseSchema>;
