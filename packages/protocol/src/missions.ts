import { z } from 'zod';

// ============================================================================
// WEEKLY MISSIONS SYSTEM
// ============================================================================

/**
 * Weekly Missions - 6 missions per week that reset every Monday 00:00 UTC
 *
 * Missions are randomly selected from a pool each week (deterministically seeded
 * by the week key). Players earn rewards for completing mission objectives
 * during regular gameplay.
 */

// ============================================================================
// MISSION TYPES
// ============================================================================

export const MissionTypeSchema = z.enum([
  'kill_enemies',       // Kill X enemies
  'complete_waves',     // Complete X waves
  'earn_gold',          // Earn X gold
  'use_skills',         // Use hero skills X times
  'pvp_battles',        // Complete X PvP battles
  'boss_rush_cycles',   // Complete X Boss Rush cycles
  'deal_damage',        // Deal X total damage
  'collect_materials',  // Collect X materials
  'hero_synergies',     // Trigger X hero synergies
]);

export type MissionType = z.infer<typeof MissionTypeSchema>;

// ============================================================================
// MISSION DEFINITIONS
// ============================================================================

export const MissionDefinitionSchema = z.object({
  id: z.string(),
  type: MissionTypeSchema,
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  baseTarget: z.number().int().positive(),
  goldReward: z.number().int().min(0),
  dustReward: z.number().int().min(0),
  materials: z.record(z.string(), z.number().int().min(0)).default({}),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export type MissionDefinition = z.infer<typeof MissionDefinitionSchema>;

// Pool of missions to randomly select from each week
export const WEEKLY_MISSION_POOL: MissionDefinition[] = [
  // EASY missions (2 per week)
  {
    id: 'kill_enemies_easy',
    type: 'kill_enemies',
    name: 'Enemy Hunter',
    description: 'Defeat {target} enemies',
    icon: 'sword',
    baseTarget: 500,
    goldReward: 1000,
    dustReward: 10,
    materials: {},
    difficulty: 'easy',
  },
  {
    id: 'complete_waves_easy',
    type: 'complete_waves',
    name: 'Wave Clearer',
    description: 'Complete {target} waves',
    icon: 'waves',
    baseTarget: 50,
    goldReward: 1200,
    dustReward: 12,
    materials: {},
    difficulty: 'easy',
  },
  {
    id: 'earn_gold_easy',
    type: 'earn_gold',
    name: 'Gold Collector',
    description: 'Earn {target} gold',
    icon: 'coins',
    baseTarget: 10000,
    goldReward: 1500,
    dustReward: 8,
    materials: {},
    difficulty: 'easy',
  },

  // MEDIUM missions (2-3 per week)
  {
    id: 'use_skills_medium',
    type: 'use_skills',
    name: 'Skill Master',
    description: 'Use hero skills {target} times',
    icon: 'sparkles',
    baseTarget: 100,
    goldReward: 2000,
    dustReward: 20,
    materials: { 'material_common': 5 },
    difficulty: 'medium',
  },
  {
    id: 'kill_enemies_medium',
    type: 'kill_enemies',
    name: 'Mass Exterminator',
    description: 'Defeat {target} enemies',
    icon: 'skull',
    baseTarget: 2000,
    goldReward: 2500,
    dustReward: 25,
    materials: { 'material_common': 3 },
    difficulty: 'medium',
  },
  {
    id: 'collect_materials_medium',
    type: 'collect_materials',
    name: 'Resource Gatherer',
    description: 'Collect {target} materials',
    icon: 'package',
    baseTarget: 30,
    goldReward: 2200,
    dustReward: 22,
    materials: { 'material_rare': 2 },
    difficulty: 'medium',
  },
  {
    id: 'deal_damage_medium',
    type: 'deal_damage',
    name: 'Damage Dealer',
    description: 'Deal {target} total damage',
    icon: 'fire',
    baseTarget: 500000,
    goldReward: 2000,
    dustReward: 20,
    materials: {},
    difficulty: 'medium',
  },

  // HARD missions (1-2 per week)
  {
    id: 'pvp_battles_hard',
    type: 'pvp_battles',
    name: 'Arena Warrior',
    description: 'Complete {target} PvP battles',
    icon: 'swords',
    baseTarget: 10,
    goldReward: 3500,
    dustReward: 35,
    materials: { 'material_rare': 3 },
    difficulty: 'hard',
  },
  {
    id: 'boss_rush_hard',
    type: 'boss_rush_cycles',
    name: 'Boss Slayer',
    description: 'Complete {target} Boss Rush cycles',
    icon: 'dragon',
    baseTarget: 5,
    goldReward: 4000,
    dustReward: 40,
    materials: { 'material_epic': 1 },
    difficulty: 'hard',
  },
  {
    id: 'hero_synergies_hard',
    type: 'hero_synergies',
    name: 'Synergy Expert',
    description: 'Trigger {target} hero synergies',
    icon: 'link',
    baseTarget: 50,
    goldReward: 3000,
    dustReward: 30,
    materials: { 'material_rare': 2 },
    difficulty: 'hard',
  },
  {
    id: 'complete_waves_hard',
    type: 'complete_waves',
    name: 'Wave Champion',
    description: 'Complete {target} waves',
    icon: 'trophy',
    baseTarget: 200,
    goldReward: 5000,
    dustReward: 50,
    materials: { 'material_epic': 1 },
    difficulty: 'hard',
  },
];

// ============================================================================
// MISSION SELECTION
// ============================================================================

export const MISSIONS_PER_WEEK = 6;

// Distribution: 2 easy, 2-3 medium, 1-2 hard
export const MISSION_DISTRIBUTION = {
  easy: 2,
  medium: 3,
  hard: 1,
} as const;

/**
 * Get mission definition by ID
 */
export function getMissionById(id: string): MissionDefinition | undefined {
  return WEEKLY_MISSION_POOL.find(m => m.id === id);
}

/**
 * Get missions by difficulty
 */
export function getMissionsByDifficulty(
  difficulty: 'easy' | 'medium' | 'hard'
): MissionDefinition[] {
  return WEEKLY_MISSION_POOL.filter(m => m.difficulty === difficulty);
}

/**
 * Generate deterministic mission selection for a week
 * Uses the week key as seed for consistency across all players
 */
export function selectMissionsForWeek(weekKey: string): MissionDefinition[] {
  // Simple deterministic shuffle using week key as seed
  const seed = weekKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const shuffle = <T>(arr: T[], s: number): T[] => {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(((s * (i + 1)) % 997) / 997 * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
      s = (s * 1103515245 + 12345) % 2147483647;
    }
    return result;
  };

  const easyMissions = shuffle(getMissionsByDifficulty('easy'), seed);
  const mediumMissions = shuffle(getMissionsByDifficulty('medium'), seed + 1);
  const hardMissions = shuffle(getMissionsByDifficulty('hard'), seed + 2);

  return [
    ...easyMissions.slice(0, MISSION_DISTRIBUTION.easy),
    ...mediumMissions.slice(0, MISSION_DISTRIBUTION.medium),
    ...hardMissions.slice(0, MISSION_DISTRIBUTION.hard),
  ];
}

// ============================================================================
// PLAYER PROGRESS SCHEMA
// ============================================================================

export const MissionProgressSchema = z.object({
  missionId: z.string(),
  missionDefId: z.string(),
  definition: MissionDefinitionSchema,
  currentProgress: z.number().int().min(0),
  targetValue: z.number().int().positive(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  claimed: z.boolean(),
  claimedAt: z.string().datetime().nullable(),
  progressPercent: z.number().min(0).max(100),
});

export type MissionProgress = z.infer<typeof MissionProgressSchema>;

// ============================================================================
// API SCHEMAS
// ============================================================================

// GET /v1/missions/weekly
export const GetWeeklyMissionsResponseSchema = z.object({
  weekKey: z.string(),
  missions: z.array(MissionProgressSchema),
  totalCompleted: z.number().int().min(0),
  totalClaimed: z.number().int().min(0),
  unclaimedCount: z.number().int().min(0),
  timeUntilReset: z.object({
    hours: z.number().int().min(0),
    minutes: z.number().int().min(0),
    seconds: z.number().int().min(0),
    totalSeconds: z.number().int().min(0),
  }),
});

export type GetWeeklyMissionsResponse = z.infer<typeof GetWeeklyMissionsResponseSchema>;

// POST /v1/missions/:id/claim
export const ClaimMissionRewardRequestSchema = z.object({
  missionId: z.string(),
});

export type ClaimMissionRewardRequest = z.infer<typeof ClaimMissionRewardRequestSchema>;

export const ClaimMissionRewardResponseSchema = z.object({
  success: z.boolean(),
  goldAwarded: z.number().int().min(0),
  dustAwarded: z.number().int().min(0),
  materialsAwarded: z.record(z.string(), z.number().int().min(0)),
  newInventory: z.object({
    gold: z.number().int().min(0),
    dust: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
  }),
  error: z.string().optional(),
});

export type ClaimMissionRewardResponse = z.infer<typeof ClaimMissionRewardResponseSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const MISSION_ERROR_CODES = {
  MISSION_NOT_FOUND: 'MISSION_NOT_FOUND',
  MISSION_NOT_COMPLETED: 'MISSION_NOT_COMPLETED',
  MISSION_ALREADY_CLAIMED: 'MISSION_ALREADY_CLAIMED',
  INVALID_WEEK_KEY: 'INVALID_WEEK_KEY',
} as const;

export type MissionErrorCode = keyof typeof MISSION_ERROR_CODES;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the current ISO week key (YYYY-Www format)
 */
export function getCurrentWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;

  // Calculate ISO week number
  const dayOfWeek = startOfYear.getUTCDay() || 7; // Sunday = 7
  const weekNumber = Math.ceil((dayOfYear + dayOfWeek - 1) / 7);

  return `${now.getUTCFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

/**
 * Get time until next Monday 00:00 UTC
 */
export function getTimeUntilWeekReset(): {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
} {
  const now = new Date();
  const nextMonday = new Date(now);

  // Calculate days until next Monday
  const daysUntilMonday = (8 - now.getUTCDay()) % 7 || 7;
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday);
  nextMonday.setUTCHours(0, 0, 0, 0);

  const diffMs = nextMonday.getTime() - now.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds };
}
