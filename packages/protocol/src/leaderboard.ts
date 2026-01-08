import { z } from 'zod';

// Leaderboard entry
export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  userId: z.string(),
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
