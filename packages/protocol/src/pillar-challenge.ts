import { z } from 'zod';

// ============================================================================
// PILLAR CHALLENGE SCHEMAS
// ============================================================================

/**
 * ID filaru
 */
export const PillarIdSchema = z.enum([
  'streets',
  'science',
  'mutants',
  'cosmos',
  'magic',
  'gods',
]);

export type PillarId = z.infer<typeof PillarIdSchema>;

/**
 * Tier trudności challenge
 */
export const PillarChallengeTierSchema = z.enum(['normal', 'hard', 'mythic']);

export type PillarChallengeTier = z.infer<typeof PillarChallengeTierSchema>;

/**
 * Typ kryształu
 */
export const CrystalTypeSchema = z.enum([
  'power',
  'space',
  'time',
  'reality',
  'soul',
  'mind',
]);

export type CrystalType = z.infer<typeof CrystalTypeSchema>;

// ============================================================================
// LOADOUT
// ============================================================================

/**
 * Konfiguracja bohatera w loadoucie
 */
export const ChallengeHeroConfigSchema = z.object({
  heroId: z.string(),
  level: z.number().int().min(1),
  tier: z.number().int().min(1).max(5).optional(),
  artifacts: z.array(z.string().nullable()).length(3).optional(), // 3 artifact slots
});

export type ChallengeHeroConfig = z.infer<typeof ChallengeHeroConfigSchema>;

/**
 * Konfiguracja wieżyczki w loadoucie
 */
export const ChallengeTurretConfigSchema = z.object({
  turretId: z.string(),
  slotIndex: z.number().int().min(0).max(11),
  level: z.number().int().min(1).optional(),
});

export type ChallengeTurretConfig = z.infer<typeof ChallengeTurretConfigSchema>;

/**
 * Pełny loadout do challenge
 */
export const ChallengeLoadoutSchema = z.object({
  fortressClass: z.enum(['natural', 'tech', 'ice', 'lightning', 'fire']),
  heroes: z.array(ChallengeHeroConfigSchema).max(6),
  turrets: z.array(ChallengeTurretConfigSchema).max(12),
});

export type ChallengeLoadout = z.infer<typeof ChallengeLoadoutSchema>;

// ============================================================================
// PLAYER PROGRESS
// ============================================================================

/**
 * Postęp gracza w challenge dla konkretnego filaru
 */
export const PillarChallengeProgressSchema = z.object({
  pillarId: PillarIdSchema,
  normalClears: z.number().int().min(0),
  hardClears: z.number().int().min(0),
  mythicClears: z.number().int().min(0),
  normalPerfect: z.boolean(),
  hardPerfect: z.boolean(),
  mythicPerfect: z.boolean(),
  bestTimeNormal: z.number().nullable(), // seconds
  bestTimeHard: z.number().nullable(),
  bestTimeMythic: z.number().nullable(),
});

export type PillarChallengeProgress = z.infer<typeof PillarChallengeProgressSchema>;

/**
 * Postęp kryształów gracza
 */
export const CrystalProgressSchema = z.object({
  powerFragments: z.number().int().min(0).default(0),
  spaceFragments: z.number().int().min(0).default(0),
  timeFragments: z.number().int().min(0).default(0),
  realityFragments: z.number().int().min(0).default(0),
  soulFragments: z.number().int().min(0).default(0),
  mindFragments: z.number().int().min(0).default(0),
  fullCrystals: z.array(CrystalTypeSchema).default([]),
  matrixAssembled: z.boolean().default(false),
});

export type CrystalProgress = z.infer<typeof CrystalProgressSchema>;

/**
 * Limity dzienne gracza
 */
export const ChallengeLimitsSchema = z.object({
  freeAttemptsUsed: z.number().int().min(0),
  paidAttemptsUsed: z.number().int().min(0),
  lastAttemptTime: z.string().datetime().nullable(),
  resetTime: z.string().datetime(),
});

export type ChallengeLimits = z.infer<typeof ChallengeLimitsSchema>;

// ============================================================================
// START CHALLENGE REQUEST/RESPONSE
// ============================================================================

/**
 * Request do rozpoczęcia challenge
 */
export const StartPillarChallengeRequestSchema = z.object({
  pillarId: PillarIdSchema,
  tier: PillarChallengeTierSchema,
  loadout: ChallengeLoadoutSchema,
  usePaidAttempt: z.boolean().default(false),
});

export type StartPillarChallengeRequest = z.infer<typeof StartPillarChallengeRequestSchema>;

/**
 * Response po rozpoczęciu challenge
 */
export const StartPillarChallengeResponseSchema = z.object({
  success: z.boolean(),
  sessionId: z.string().optional(),
  seed: z.number().int().optional(),
  tierConfig: z.object({
    waveCount: z.number().int(),
    timeLimit: z.number().int(), // seconds
    enemyHpMultiplier: z.number(),
    enemyDmgMultiplier: z.number(),
    enemySpeedMultiplier: z.number(),
  }).optional(),
  crystalReward: z.object({
    primaryCrystal: CrystalTypeSchema,
    secondaryCrystal: CrystalTypeSchema.optional(),
    fragmentMultiplier: z.number(),
  }).optional(),
  remainingAttempts: z.object({
    free: z.number().int(),
    paid: z.number().int(),
  }).optional(),
  error: z.string().optional(),
});

export type StartPillarChallengeResponse = z.infer<typeof StartPillarChallengeResponseSchema>;

// ============================================================================
// SUBMIT CHALLENGE REQUEST/RESPONSE
// ============================================================================

/**
 * Checkpoint z klienta
 */
export const ClientCheckpointSchema = z.object({
  tick: z.number().int(),
  wave: z.number().int(),
  fortressHp: z.number().int(),
  hash: z.number().int(),
});

export type ClientCheckpoint = z.infer<typeof ClientCheckpointSchema>;

/**
 * Request do submitu wyników challenge
 */
export const SubmitPillarChallengeRequestSchema = z.object({
  sessionId: z.string(),
  events: z.array(z.object({
    tick: z.number().int(),
    type: z.string(),
    payload: z.any().optional(),
  })),
  checkpoints: z.array(ClientCheckpointSchema),
  finalHash: z.number().int(),
  result: z.object({
    victory: z.boolean(),
    wavesCleared: z.number().int(),
    fortressDamageTaken: z.number().int(),
    heroesLost: z.number().int(),
    timeElapsed: z.number(), // seconds
  }),
});

export type SubmitPillarChallengeRequest = z.infer<typeof SubmitPillarChallengeRequestSchema>;

/**
 * Osiągnięty bonus performance
 */
export const AchievedBonusSchema = z.object({
  id: z.string(),
  name: z.string(),
  fragmentReward: z.number().int(),
});

export type AchievedBonus = z.infer<typeof AchievedBonusSchema>;

/**
 * Response po submicie challenge
 */
export const SubmitPillarChallengeResponseSchema = z.object({
  success: z.boolean(),
  verified: z.boolean().optional(),
  rewards: z.object({
    primaryFragments: z.number().int(),
    secondaryFragments: z.number().int(),
    fullCrystalEarned: z.boolean(),
    fullCrystalType: CrystalTypeSchema.nullable(),
    gold: z.number().int(),
    fortressXp: z.number().int(),
    materials: z.record(z.string(), z.number().int()),
  }).optional(),
  achievedBonuses: z.array(AchievedBonusSchema).optional(),
  newCrystalProgress: CrystalProgressSchema.optional(),
  error: z.string().optional(),
});

export type SubmitPillarChallengeResponse = z.infer<typeof SubmitPillarChallengeResponseSchema>;

// ============================================================================
// GET STATUS REQUEST/RESPONSE
// ============================================================================

/**
 * Response dla statusu challenge gracza
 */
export const PillarChallengeStatusResponseSchema = z.object({
  success: z.boolean(),
  progress: z.array(PillarChallengeProgressSchema).optional(),
  crystalProgress: CrystalProgressSchema.optional(),
  limits: ChallengeLimitsSchema.optional(),
  unlockedTiers: z.record(PillarIdSchema, z.array(PillarChallengeTierSchema)).optional(),
  error: z.string().optional(),
});

export type PillarChallengeStatusResponse = z.infer<typeof PillarChallengeStatusResponseSchema>;

// ============================================================================
// ABANDON CHALLENGE
// ============================================================================

/**
 * Request do porzucenia challenge
 */
export const AbandonPillarChallengeRequestSchema = z.object({
  sessionId: z.string(),
});

export type AbandonPillarChallengeRequest = z.infer<typeof AbandonPillarChallengeRequestSchema>;

/**
 * Response po porzuceniu
 */
export const AbandonPillarChallengeResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

export type AbandonPillarChallengeResponse = z.infer<typeof AbandonPillarChallengeResponseSchema>;

// ============================================================================
// PREVIEW REWARDS
// ============================================================================

/**
 * Request do podglądu nagród
 */
export const PreviewChallengeRewardsRequestSchema = z.object({
  pillarId: PillarIdSchema,
  tier: PillarChallengeTierSchema,
});

export type PreviewChallengeRewardsRequest = z.infer<typeof PreviewChallengeRewardsRequestSchema>;

/**
 * Response z podglądem nagród
 */
export const PreviewChallengeRewardsResponseSchema = z.object({
  success: z.boolean(),
  baseFragments: z.number().int().optional(),
  maxBonusFragments: z.number().int().optional(),
  crystalTypes: z.object({
    primary: CrystalTypeSchema,
    secondary: CrystalTypeSchema.optional(),
  }).optional(),
  canEarnFullCrystal: z.boolean().optional(),
  goldRange: z.object({
    min: z.number().int(),
    max: z.number().int(),
  }).optional(),
  possibleMaterials: z.array(z.string()).optional(),
  performanceBonuses: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    fragmentReward: z.number().int(),
  })).optional(),
  error: z.string().optional(),
});

export type PreviewChallengeRewardsResponse = z.infer<typeof PreviewChallengeRewardsResponseSchema>;

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Entry w rankingu challenge
 */
export const ChallengeLeaderboardEntrySchema = z.object({
  rank: z.number().int(),
  playerId: z.string(),
  playerName: z.string(),
  time: z.number(), // seconds
  wavesCleared: z.number().int(),
  fortressHpPercent: z.number(),
  achievedBonuses: z.array(z.string()),
  completedAt: z.string().datetime(),
});

export type ChallengeLeaderboardEntry = z.infer<typeof ChallengeLeaderboardEntrySchema>;

/**
 * Request dla leaderboard challenge
 */
export const GetChallengeLeaderboardRequestSchema = z.object({
  pillarId: PillarIdSchema,
  tier: PillarChallengeTierSchema,
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export type GetChallengeLeaderboardRequest = z.infer<typeof GetChallengeLeaderboardRequestSchema>;

/**
 * Response z leaderboardem
 */
export const GetChallengeLeaderboardResponseSchema = z.object({
  success: z.boolean(),
  entries: z.array(ChallengeLeaderboardEntrySchema).optional(),
  totalCount: z.number().int().optional(),
  playerRank: z.number().int().nullable().optional(),
  playerBestTime: z.number().nullable().optional(),
  error: z.string().optional(),
});

export type GetChallengeLeaderboardResponse = z.infer<typeof GetChallengeLeaderboardResponseSchema>;

// ============================================================================
// CRYSTAL CRAFT
// ============================================================================

/**
 * Request do craftowania pełnego kryształu z fragmentów
 */
export const CraftCrystalRequestSchema = z.object({
  crystalType: CrystalTypeSchema,
});

export type CraftCrystalRequest = z.infer<typeof CraftCrystalRequestSchema>;

/**
 * Response po craftowaniu kryształu
 */
export const CraftCrystalResponseSchema = z.object({
  success: z.boolean(),
  newCrystalProgress: CrystalProgressSchema.optional(),
  error: z.string().optional(),
});

export type CraftCrystalResponse = z.infer<typeof CraftCrystalResponseSchema>;

// ============================================================================
// ASSEMBLE MATRIX
// ============================================================================

/**
 * Response po złożeniu pełnej matrycy
 */
export const AssembleMatrixResponseSchema = z.object({
  success: z.boolean(),
  newCrystalProgress: CrystalProgressSchema.optional(),
  bonusesUnlocked: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  })).optional(),
  error: z.string().optional(),
});

export type AssembleMatrixResponse = z.infer<typeof AssembleMatrixResponseSchema>;
