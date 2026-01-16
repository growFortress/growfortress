import { z } from 'zod';

// ============================================================================
// QUEST DEFINITIONS
// ============================================================================

/**
 * Quest type identifiers
 */
export const DailyQuestIdSchema = z.enum([
  'first_blood',     // Complete 1 run
  'wave_hunter',     // Kill 500 enemies
  'elite_slayer',    // Kill 10 elites
  'boss_slayer',     // Kill 3 bosses (any mode)
  'dedicated',       // Complete 3 runs
]);

export type DailyQuestId = z.infer<typeof DailyQuestIdSchema>;

/**
 * Bonus reward type
 */
export const QuestBonusTypeSchema = z.enum(['gold', 'material', 'random_material']);

export type QuestBonusType = z.infer<typeof QuestBonusTypeSchema>;

/**
 * Quest definition (static config)
 */
export const DailyQuestDefinitionSchema = z.object({
  id: DailyQuestIdSchema,
  name: z.string(),
  description: z.string(),
  target: z.number().int().positive(),
  dustReward: z.number().int().positive(),
  bonusType: QuestBonusTypeSchema.nullable(),
  bonusValue: z.union([z.number(), z.string()]).nullable(), // gold amount or material id
});

export type DailyQuestDefinition = z.infer<typeof DailyQuestDefinitionSchema>;

// ============================================================================
// QUEST PROGRESS
// ============================================================================

/**
 * Player's progress on a single quest
 */
export const DailyQuestProgressSchema = z.object({
  questId: DailyQuestIdSchema,
  progress: z.number().int().min(0),
  target: z.number().int().positive(),
  completed: z.boolean(),
  claimed: z.boolean(),
  dustReward: z.number().int().positive(),
  bonusType: QuestBonusTypeSchema.nullable(),
  bonusValue: z.union([z.number(), z.string()]).nullable(),
});

export type DailyQuestProgress = z.infer<typeof DailyQuestProgressSchema>;

// ============================================================================
// API SCHEMAS
// ============================================================================

/**
 * GET /daily-quests - Response
 */
export const DailyQuestsResponseSchema = z.object({
  quests: z.array(DailyQuestProgressSchema),
  resetAt: z.string().datetime(), // ISO timestamp for next reset (midnight UTC)
  totalDustEarned: z.number().int().min(0), // Total dust earned today from quests
  allCompleted: z.boolean(), // Whether all quests are completed
  allClaimed: z.boolean(), // Whether all rewards are claimed
});

export type DailyQuestsResponse = z.infer<typeof DailyQuestsResponseSchema>;

/**
 * POST /daily-quests/:questId/claim - Request
 */
export const ClaimQuestRewardRequestSchema = z.object({
  questId: DailyQuestIdSchema,
});

export type ClaimQuestRewardRequest = z.infer<typeof ClaimQuestRewardRequestSchema>;

/**
 * POST /daily-quests/:questId/claim - Response
 */
export const ClaimQuestRewardResponseSchema = z.object({
  success: z.boolean(),
  dustAwarded: z.number().int().min(0),
  bonusAwarded: z.object({
    type: QuestBonusTypeSchema,
    value: z.union([z.number(), z.string()]),
  }).nullable(),
  newInventory: z.object({
    dust: z.number().int().min(0),
    gold: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
  }),
  error: z.string().optional(),
});

export type ClaimQuestRewardResponse = z.infer<typeof ClaimQuestRewardResponseSchema>;

/**
 * POST /daily-quests/claim-all - Response
 */
export const ClaimAllQuestsResponseSchema = z.object({
  success: z.boolean(),
  totalDustAwarded: z.number().int().min(0),
  totalGoldAwarded: z.number().int().min(0),
  materialsAwarded: z.record(z.string(), z.number().int().min(0)),
  claimedCount: z.number().int().min(0),
  newInventory: z.object({
    dust: z.number().int().min(0),
    gold: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
  }),
  error: z.string().optional(),
});

export type ClaimAllQuestsResponse = z.infer<typeof ClaimAllQuestsResponseSchema>;

// ============================================================================
// QUEST DEFINITIONS (Static data)
// ============================================================================

export const DAILY_QUEST_DEFINITIONS: DailyQuestDefinition[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    description: 'Complete 1 run (win or lose)',
    target: 1,
    dustReward: 5,
    bonusType: 'gold',
    bonusValue: 50,
  },
  {
    id: 'dedicated',
    name: 'Dedicated',
    description: 'Complete 3 runs',
    target: 3,
    dustReward: 5,
    bonusType: 'gold',
    bonusValue: 100,
  },
  {
    id: 'wave_hunter',
    name: 'Wave Hunter',
    description: 'Defeat 500 enemies',
    target: 500,
    dustReward: 10,
    bonusType: 'gold',
    bonusValue: 150,
  },
  {
    id: 'elite_slayer',
    name: 'Elite Slayer',
    description: 'Defeat 10 elite enemies',
    target: 10,
    dustReward: 10,
    bonusType: 'gold',
    bonusValue: 200,
  },
  {
    id: 'boss_slayer',
    name: 'Boss Slayer',
    description: 'Defeat 3 bosses',
    target: 3,
    dustReward: 15,
    bonusType: 'gold',
    bonusValue: 300,
  },
];

// Total dust from all daily quests: 5 + 5 + 10 + 10 + 15 = 45
// Total gold from all daily quests: 50 + 100 + 150 + 200 + 300 = 800
export const TOTAL_DAILY_DUST = DAILY_QUEST_DEFINITIONS.reduce(
  (sum, q) => sum + q.dustReward,
  0
);

// ============================================================================
// ERROR CODES
// ============================================================================

export const DAILY_QUEST_ERROR_CODES = {
  QUEST_NOT_FOUND: 'QUEST_NOT_FOUND',
  QUEST_NOT_COMPLETED: 'QUEST_NOT_COMPLETED',
  QUEST_ALREADY_CLAIMED: 'QUEST_ALREADY_CLAIMED',
  NO_QUESTS_TO_CLAIM: 'NO_QUESTS_TO_CLAIM',
} as const;

export type DailyQuestErrorCode = keyof typeof DAILY_QUEST_ERROR_CODES;
