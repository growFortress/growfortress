import { z } from 'zod';

// ============================================================================
// CHALLENGE STATUS
// ============================================================================

export const PvpChallengeStatusSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'RESOLVED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
]);

export type PvpChallengeStatus = z.infer<typeof PvpChallengeStatusSchema>;

// ============================================================================
// WIN REASON
// ============================================================================

export const PvpWinReasonSchema = z.enum([
  'fortress_destroyed',
  'timeout',
  'draw',
]);

export type PvpWinReason = z.infer<typeof PvpWinReasonSchema>;

// ============================================================================
// BATTLE STATS (defined early for use in responses)
// ============================================================================

export const PvpBattleStatsSchema = z.object({
  finalHp: z.number().int().min(0),
  damageDealt: z.number().int().min(0),
  heroesAlive: z.number().int().min(0),
});

export type PvpBattleStats = z.infer<typeof PvpBattleStatsSchema>;

// ============================================================================
// BATTLE DATA
// ============================================================================

export const PvpBattleDataSchema = z.object({
  seed: z.number().int(),
  challengerBuild: z.unknown(), // ArenaBuildConfig
  challengedBuild: z.unknown(), // ArenaBuildConfig
});

export type PvpBattleData = z.infer<typeof PvpBattleDataSchema>;

// ============================================================================
// PVP REWARDS
// ============================================================================

export const PvpRewardsSchema = z.object({
  dust: z.number().int().min(0),
  gold: z.number().int().min(0),
  honorChange: z.number().int(),
  artifactId: z.string().optional(), // Random artifact drop (rare chance)
});

export type PvpRewards = z.infer<typeof PvpRewardsSchema>;

// ============================================================================
// CHALLENGE CREATION
// ============================================================================

export const PvpCreateChallengeRequestSchema = z.object({
  challengedId: z.string().min(1),
});

export type PvpCreateChallengeRequest = z.infer<typeof PvpCreateChallengeRequestSchema>;

export const PvpChallengeSchema = z.object({
  id: z.string(),
  challengerId: z.string(),
  challengerName: z.string(),
  challengerPower: z.number().int().min(0),
  challengerIsOnline: z.boolean().optional(),
  challengedId: z.string(),
  challengedName: z.string(),
  challengedPower: z.number().int().min(0),
  challengedIsOnline: z.boolean().optional(),
  status: PvpChallengeStatusSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  winnerId: z.string().optional(),
});

export type PvpChallenge = z.infer<typeof PvpChallengeSchema>;

export const PvpCreateChallengeResponseSchema = z.object({
  challenge: PvpChallengeSchema,
  // Battle data for live visualization
  battleData: PvpBattleDataSchema.optional(),
  // Auto-accept: battle runs immediately, include result
  result: z.object({
    winnerId: z.string().nullable(),
    winReason: PvpWinReasonSchema,
    challengerStats: PvpBattleStatsSchema,
    challengedStats: PvpBattleStatsSchema,
    duration: z.number().int().min(0),
  }).optional(),
  // Rewards for the challenger
  rewards: PvpRewardsSchema.optional(),
});

export type PvpCreateChallengeResponse = z.infer<typeof PvpCreateChallengeResponseSchema>;

// ============================================================================
// CHALLENGE LIST
// ============================================================================

export const PvpChallengesQuerySchema = z.object({
  status: PvpChallengeStatusSchema.optional(),
  type: z
    .enum(['sent', 'received', 'all'])
    .catch('all')
    .default('all'),
  limit: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      return val;
    }, z.coerce.number().int().min(1).max(50))
    .catch(20)
    .default(20),
  offset: z
    .preprocess((val) => {
      if (val === '' || val === null || val === undefined) return undefined;
      return val;
    }, z.coerce.number().int().min(0))
    .catch(0)
    .default(0),
});

export type PvpChallengesQuery = z.infer<typeof PvpChallengesQuerySchema>;

export const PvpChallengesResponseSchema = z.object({
  challenges: z.array(PvpChallengeSchema),
  total: z.number().int().min(0),
});

export type PvpChallengesResponse = z.infer<typeof PvpChallengesResponseSchema>;

// ============================================================================
// CHALLENGE ACTIONS
// ============================================================================

export const PvpAcceptResponseSchema = z.object({
  challenge: z.object({
    id: z.string(),
    status: PvpChallengeStatusSchema,
    winnerId: z.string().optional(),
  }),
  battleData: PvpBattleDataSchema,
  result: z.object({
    winnerId: z.string().nullable(),
    winReason: PvpWinReasonSchema,
    challengerStats: PvpBattleStatsSchema,
    challengedStats: PvpBattleStatsSchema,
    duration: z.number().int().min(0),
  }),
});

export type PvpAcceptResponse = z.infer<typeof PvpAcceptResponseSchema>;

// ============================================================================
// CHALLENGE RESOLUTION
// ============================================================================

export const PvpResolveRequestSchema = z.object({
  result: z.object({
    winnerId: z.string().nullable(),
    winReason: PvpWinReasonSchema,
    challengerStats: PvpBattleStatsSchema,
    challengedStats: PvpBattleStatsSchema,
    duration: z.number().int().min(0),
  }),
});

export type PvpResolveRequest = z.infer<typeof PvpResolveRequestSchema>;

// ============================================================================
// BATTLE RESULT
// ============================================================================

export const PvpResultSchema = z.object({
  id: z.string(),
  challengeId: z.string(),
  winnerId: z.string().nullable(),
  winReason: PvpWinReasonSchema,
  challengerStats: PvpBattleStatsSchema,
  challengedStats: PvpBattleStatsSchema,
  duration: z.number().int().min(0),
  resolvedAt: z.string().datetime(),
});

export type PvpResult = z.infer<typeof PvpResultSchema>;

export const PvpResolveResponseSchema = z.object({
  challenge: z.object({
    id: z.string(),
    status: PvpChallengeStatusSchema,
    winnerId: z.string().optional(),
  }),
  result: PvpResultSchema,
  rewards: PvpRewardsSchema.optional(),
});

export type PvpResolveResponse = z.infer<typeof PvpResolveResponseSchema>;

export const PvpChallengeWithResultSchema = PvpChallengeSchema.extend({
  battleData: PvpBattleDataSchema.optional(),
  result: PvpResultSchema.optional(),
  rewards: PvpRewardsSchema.optional(),
});

export type PvpChallengeWithResult = z.infer<typeof PvpChallengeWithResultSchema>;

// ============================================================================
// OPPONENTS LIST
// ============================================================================

export const PvpOpponentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(8).default(8),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PvpOpponentsQuery = z.infer<typeof PvpOpponentsQuerySchema>;

export const PvpOpponentSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  power: z.number().int().min(0),
  pvpWins: z.number().int().min(0),
  pvpLosses: z.number().int().min(0),
  canChallenge: z.boolean(),
  challengeCooldownEndsAt: z.string().datetime().optional(),
  isOnline: z.boolean().optional(),
});

export type PvpOpponent = z.infer<typeof PvpOpponentSchema>;

export const PvpOpponentsResponseSchema = z.object({
  opponents: z.array(PvpOpponentSchema),
  total: z.number().int().min(0),
  myPower: z.number().int().min(0),
});

export type PvpOpponentsResponse = z.infer<typeof PvpOpponentsResponseSchema>;

// ============================================================================
// REPLAY
// ============================================================================

export const PvpReplayRequestSchema = z.object({
  challengeId: z.string().min(1),
});

export type PvpReplayRequest = z.infer<typeof PvpReplayRequestSchema>;

export const PvpReplayResponseSchema = z.object({
  seed: z.number().int(),
  challengerBuild: z.unknown(), // ArenaBuildConfig
  challengedBuild: z.unknown(), // ArenaBuildConfig
  result: PvpResultSchema,
  replayEvents: z.array(z.unknown()).optional(), // ArenaReplayEvent[]
});

export type PvpReplayResponse = z.infer<typeof PvpReplayResponseSchema>;

// ============================================================================
// USER STATS
// ============================================================================

export const PvpUserStatsSchema = z.object({
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winRate: z.number().min(0).max(100),
  totalBattles: z.number().int().min(0),
  pendingChallenges: z.number().int().min(0),
});

export type PvpUserStats = z.infer<typeof PvpUserStatsSchema>;

// ============================================================================
// CONSTANTS
// ============================================================================

export const PVP_CONSTANTS = {
  /** Maximum challenges to same opponent per 24h */
  MAX_CHALLENGES_PER_OPPONENT: 3,
  /** Challenge cooldown period in hours */
  COOLDOWN_HOURS: 24,
  /** Challenge expiry in hours */
  CHALLENGE_EXPIRY_HOURS: 24,
  /** Power range for matchmaking (±20%) */
  POWER_RANGE_PERCENT: 0.20,
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const PVP_ERROR_CODES = {
  CHALLENGE_NOT_FOUND: 'CHALLENGE_NOT_FOUND',
  CHALLENGE_FORBIDDEN: 'CHALLENGE_FORBIDDEN',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  CHALLENGE_ALREADY_RESOLVED: 'CHALLENGE_ALREADY_RESOLVED',
  CHALLENGE_NOT_PENDING: 'CHALLENGE_NOT_PENDING',
  CHALLENGE_NOT_RESOLVED: 'CHALLENGE_NOT_RESOLVED',
  RESULT_MISMATCH: 'RESULT_MISMATCH',
  CANNOT_CHALLENGE_SELF: 'CANNOT_CHALLENGE_SELF',
  COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
  OPPONENT_NOT_FOUND: 'OPPONENT_NOT_FOUND',
  POWER_OUT_OF_RANGE: 'POWER_OUT_OF_RANGE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
} as const;

export type PvpErrorCode = keyof typeof PVP_ERROR_CODES;
