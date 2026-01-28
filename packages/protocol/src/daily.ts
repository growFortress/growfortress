import { z } from 'zod';

// ============================================================================
// DAILY LOGIN REWARDS SYSTEM
// ============================================================================

/**
 * Daily Login Rewards - 7-day cycle with streak bonuses
 *
 * Players can claim one reward per day. After claiming all 7 days,
 * the cycle resets. Consecutive days build up a streak that provides
 * bonus multipliers on rewards.
 */

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const DAILY_REWARD_CYCLE_LENGTH = 7;

// Streak bonus multipliers (applied to all rewards)
export const STREAK_BONUSES: Record<number, number> = {
  7: 1.1,   // 7 days:  +10%
  14: 1.2,  // 14 days: +20%
  21: 1.3,  // 21 days: +30%
  30: 1.5,  // 30 days: +50%
  60: 1.75, // 60 days: +75%
  90: 2.0,  // 90 days: +100%
};

// Get streak multiplier for a given streak count
export function getStreakMultiplier(streak: number): number {
  const thresholds = Object.keys(STREAK_BONUSES)
    .map(Number)
    .sort((a, b) => b - a);

  for (const threshold of thresholds) {
    if (streak >= threshold) {
      return STREAK_BONUSES[threshold];
    }
  }
  return 1.0;
}

// Get next streak milestone
export function getNextStreakMilestone(streak: number): number | null {
  const thresholds = Object.keys(STREAK_BONUSES)
    .map(Number)
    .sort((a, b) => a - b);

  for (const threshold of thresholds) {
    if (streak < threshold) {
      return threshold;
    }
  }
  return null; // Already at max
}

// ============================================================================
// DAILY REWARD CONFIGURATION
// ============================================================================

export const DailyRewardSchema = z.object({
  day: z.number().int().min(1).max(7),
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  energy: z.number().int().min(0).default(0),
  materials: z.record(z.string(), z.number().int().min(0)).default({}),
  isBonus: z.boolean().default(false), // Day 7 is bonus day
});

export type DailyReward = z.infer<typeof DailyRewardSchema>;

// Daily reward configuration for each day of the week
export const DAILY_REWARD_CONFIG: DailyReward[] = [
  { day: 1, gold: 500,  dust: 5,  energy: 0, materials: {}, isBonus: false },
  { day: 2, gold: 750,  dust: 8,  energy: 0, materials: {}, isBonus: false },
  { day: 3, gold: 1000, dust: 10, energy: 5, materials: {}, isBonus: false },
  { day: 4, gold: 1500, dust: 15, energy: 0, materials: { 'material_common': 3 }, isBonus: false },
  { day: 5, gold: 2000, dust: 20, energy: 0, materials: { 'material_rare': 1 }, isBonus: false },
  { day: 6, gold: 2500, dust: 25, energy: 10, materials: {}, isBonus: false },
  { day: 7, gold: 5000, dust: 50, energy: 20, materials: { 'material_epic': 1 }, isBonus: true },
];

// Get reward for a specific day
export function getDailyReward(day: number): DailyReward {
  const index = ((day - 1) % DAILY_REWARD_CYCLE_LENGTH);
  return DAILY_REWARD_CONFIG[index];
}

// ============================================================================
// API SCHEMAS
// ============================================================================

// GET /v1/daily/status
export const DailyLoginStatusResponseSchema = z.object({
  currentDay: z.number().int().min(1).max(7),
  streak: z.number().int().min(0),
  canClaim: z.boolean(),
  lastClaimAt: z.string().datetime().nullable(),
  totalDaysClaimed: z.number().int().min(0),
  streakMultiplier: z.number().min(1),
  nextMilestone: z.number().nullable(),
  daysUntilNextMilestone: z.number().nullable(),
  rewards: z.array(z.object({
    day: z.number().int().min(1).max(7),
    gold: z.number().int().min(0),
    dust: z.number().int().min(0),
    energy: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
    isBonus: z.boolean(),
    claimed: z.boolean(),
    isToday: z.boolean(),
  })),
});

export type DailyLoginStatusResponse = z.infer<typeof DailyLoginStatusResponseSchema>;

// POST /v1/daily/claim
export const ClaimDailyRewardResponseSchema = z.object({
  success: z.boolean(),
  goldAwarded: z.number().int().min(0),
  dustAwarded: z.number().int().min(0),
  energyAwarded: z.number().int().min(0),
  materialsAwarded: z.record(z.string(), z.number().int().min(0)),
  streakMultiplier: z.number().min(1),
  newStreak: z.number().int().min(0),
  newCurrentDay: z.number().int().min(1).max(7),
  newInventory: z.object({
    gold: z.number().int().min(0),
    dust: z.number().int().min(0),
    materials: z.record(z.string(), z.number().int().min(0)),
  }),
  error: z.string().optional(),
});

export type ClaimDailyRewardResponse = z.infer<typeof ClaimDailyRewardResponseSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const DAILY_ERROR_CODES = {
  ALREADY_CLAIMED_TODAY: 'ALREADY_CLAIMED_TODAY',
  DAILY_PROGRESS_NOT_FOUND: 'DAILY_PROGRESS_NOT_FOUND',
} as const;

export type DailyErrorCode = keyof typeof DAILY_ERROR_CODES;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if two timestamps are on the same UTC day
 */
export function isSameUTCDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Check if date2 is the day after date1 (consecutive days)
 */
export function isConsecutiveDay(date1: Date, date2: Date): boolean {
  const nextDay = new Date(date1);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return isSameUTCDay(nextDay, date2);
}

/**
 * Calculate the current day in the 7-day cycle based on total days claimed
 */
export function calculateCurrentDay(totalDaysClaimed: number): number {
  return ((totalDaysClaimed) % DAILY_REWARD_CYCLE_LENGTH) + 1;
}
