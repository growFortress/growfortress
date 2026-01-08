import { z } from 'zod';
import { FortressClassSchema, InventorySchema } from './auth.js';
import { CheckpointSchema } from './events.js';
import { ProgressionBonusesSchema } from './sessions.js';

// ============================================================================
// BOSS RUSH START
// ============================================================================

export const BossRushStartRequestSchema = z.object({
  fortressClass: FortressClassSchema.optional(),
  heroIds: z.array(z.string()).max(4).optional(),
  turretTypes: z.array(z.string()).max(6).optional(),
});

export type BossRushStartRequest = z.infer<typeof BossRushStartRequestSchema>;

export const BossRushStartResponseSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  seed: z.number().int(),
  simVersion: z.number().int(),
  tickHz: z.number().int().default(30),
  inventory: InventorySchema,
  commanderLevel: z.number().int().min(1),
  progressionBonuses: ProgressionBonusesSchema,
});

export type BossRushStartResponse = z.infer<typeof BossRushStartResponseSchema>;

// ============================================================================
// BOSS RUSH FINISH
// ============================================================================

export const BossRushSummarySchema = z.object({
  totalDamageDealt: z.number().min(0),
  bossesKilled: z.number().int().min(0),
  cyclesCompleted: z.number().int().min(0),
  goldEarned: z.number().int().min(0),
  dustEarned: z.number().int().min(0),
  materialsEarned: z.record(z.string(), z.number().int().min(0)),
  timeSurvived: z.number().int().min(0), // in ticks
});

export type BossRushSummary = z.infer<typeof BossRushSummarySchema>;

export const BossRushFinishRequestSchema = z.object({
  sessionToken: z.string(),
  events: z.array(z.unknown()).max(5000),
  checkpoints: z.array(CheckpointSchema).max(500),
  finalHash: z.number().int(),
  summary: BossRushSummarySchema,
});

export type BossRushFinishRequest = z.infer<typeof BossRushFinishRequestSchema>;

export const BossRushRewardsSchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  xp: z.number().int().min(0),
  materials: z.record(z.string(), z.number().int().min(0)),
  levelUp: z.boolean(),
  newLevel: z.number().int().optional(),
});

export type BossRushRewards = z.infer<typeof BossRushRewardsSchema>;

export const BossRushFinishResponseSchema = z.object({
  verified: z.boolean(),
  rewards: BossRushRewardsSchema.optional(),
  rejectReason: z.string().optional(),
  newInventory: InventorySchema.optional(),
  newProgression: z.object({
    level: z.number().int().min(1),
    xp: z.number().int().min(0),
    totalXp: z.number().int().min(0),
    xpToNextLevel: z.number().int().min(0),
  }).optional(),
  leaderboardRank: z.number().int().min(1).optional(),
});

export type BossRushFinishResponse = z.infer<typeof BossRushFinishResponseSchema>;

// ============================================================================
// BOSS RUSH LEADERBOARD
// ============================================================================

export const BossRushLeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  userId: z.string(),
  displayName: z.string(),
  totalDamage: z.number().min(0), // BigInt serialized as number
  bossesKilled: z.number().int().min(0),
  createdAt: z.string().datetime(),
});

export type BossRushLeaderboardEntry = z.infer<typeof BossRushLeaderboardEntrySchema>;

export const BossRushLeaderboardQuerySchema = z.object({
  week: z.string().optional(), // ISO week format: "2024-W01"
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type BossRushLeaderboardQuery = z.infer<typeof BossRushLeaderboardQuerySchema>;

export const BossRushLeaderboardResponseSchema = z.object({
  weekKey: z.string(),
  entries: z.array(BossRushLeaderboardEntrySchema),
  total: z.number().int().min(0),
  userRank: z.number().int().min(1).optional(),
  userTotalDamage: z.number().min(0).optional(),
});

export type BossRushLeaderboardResponse = z.infer<typeof BossRushLeaderboardResponseSchema>;

// ============================================================================
// BOSS RUSH HISTORY
// ============================================================================

export const BossRushHistoryEntrySchema = z.object({
  sessionId: z.string(),
  totalDamageDealt: z.number().min(0),
  bossesKilled: z.number().int().min(0),
  goldEarned: z.number().int().min(0),
  dustEarned: z.number().int().min(0),
  verified: z.boolean(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
});

export type BossRushHistoryEntry = z.infer<typeof BossRushHistoryEntrySchema>;

export const BossRushHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export type BossRushHistoryQuery = z.infer<typeof BossRushHistoryQuerySchema>;

export const BossRushHistoryResponseSchema = z.object({
  sessions: z.array(BossRushHistoryEntrySchema),
  total: z.number().int().min(0),
});

export type BossRushHistoryResponse = z.infer<typeof BossRushHistoryResponseSchema>;

// ============================================================================
// REJECTION REASONS
// ============================================================================

export const BOSS_RUSH_REJECTION_REASONS = {
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SIM_VERSION_MISMATCH: 'SIM_VERSION_MISMATCH',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_ALREADY_FINISHED: 'SESSION_ALREADY_FINISHED',
  EVENTS_INVALID: 'EVENTS_INVALID',
  CHECKPOINT_MISMATCH: 'CHECKPOINT_MISMATCH',
  CHECKPOINT_HASH_MISMATCH: 'CHECKPOINT_HASH_MISMATCH',
  FINAL_HASH_MISMATCH: 'FINAL_HASH_MISMATCH',
  DAMAGE_MISMATCH: 'DAMAGE_MISMATCH',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  TICKS_NOT_MONOTONIC: 'TICKS_NOT_MONOTONIC',
  INVALID_SUMMARY_DATA: 'INVALID_SUMMARY_DATA',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type BossRushRejectionReason = keyof typeof BOSS_RUSH_REJECTION_REASONS;
