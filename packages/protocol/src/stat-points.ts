/**
 * Free Stat Points API Schemas
 *
 * Zod schemas for stat points requests and responses.
 * Stat points are earned by completing waves (+1) and leveling up (+4).
 * They can be allocated to fortress or hero stats for free permanent bonuses.
 */

import { z } from 'zod';

// ============================================================================
// SHARED SCHEMAS
// ============================================================================

/**
 * Target type for stat point allocation
 */
export const StatPointTargetSchema = z.enum(['fortress', 'hero']);
export type StatPointTarget = z.infer<typeof StatPointTargetSchema>;

/**
 * Fortress stat allocations (simple record)
 */
export type FortressStatAllocations = {
  hp: number;
  damage: number;
  armor: number;
};

/**
 * Hero stat allocations array (for all heroes)
 */
export type HeroStatAllocations = Array<{ heroId: string; allocations: Record<string, number> }>;

/**
 * Hero stat allocation record (single hero)
 */
export const HeroStatAllocationSchema = z.object({
  heroId: z.string(),
  allocations: z.record(z.string(), z.number().int().min(0)),
});
export type HeroStatAllocation = z.infer<typeof HeroStatAllocationSchema>;

/**
 * Player's complete stat points data (stored in database)
 */
export const PlayerStatPointsSchema = z.object({
  totalEarned: z.number().int().min(0),
  totalSpent: z.number().int().min(0),
  // Fortress allocations: { hp: 5, damage: 10, armor: 3 }
  fortressAllocations: z.record(z.string(), z.number().int().min(0)),
  // Hero allocations: [{ heroId: 'storm', allocations: { damage: 10 }}]
  heroAllocations: z.array(HeroStatAllocationSchema),
});
export type PlayerStatPoints = z.infer<typeof PlayerStatPointsSchema>;

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Allocate stat points request
 */
export const AllocateStatPointsRequestSchema = z.object({
  targetType: StatPointTargetSchema,
  heroId: z.string().optional(), // Required if targetType is 'hero'
  stat: z.string().min(1),
  pointsToAllocate: z.number().int().min(1).max(100),
});
export type AllocateStatPointsRequest = z.infer<typeof AllocateStatPointsRequestSchema>;

/**
 * Reset stat point allocations request
 */
export const ResetStatPointsRequestSchema = z.object({
  targetType: StatPointTargetSchema,
  heroId: z.string().optional(), // Required if targetType is 'hero', resets specific hero
});
export type ResetStatPointsRequest = z.infer<typeof ResetStatPointsRequestSchema>;

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

/**
 * Stat point summary response (for UI)
 */
export const StatPointsSummaryResponseSchema = z.object({
  totalEarned: z.number().int().min(0),
  totalSpent: z.number().int().min(0),
  availablePoints: z.number().int().min(0),
  fortressAllocations: z.record(z.string(), z.number().int().min(0)),
  heroAllocations: z.array(HeroStatAllocationSchema),
});
export type StatPointsSummaryResponse = z.infer<typeof StatPointsSummaryResponseSchema>;

/**
 * Allocate stat points response
 */
export const AllocateStatPointsResponseSchema = z.object({
  success: z.boolean(),
  pointsAllocated: z.number().int().min(0),
  newTotalSpent: z.number().int().min(0),
  availablePoints: z.number().int().min(0),
  newStatTotal: z.number().int().min(0), // Total points allocated to this stat
  bonusPercent: z.number(), // Current bonus % from this stat
  error: z.string().optional(),
});
export type AllocateStatPointsResponse = z.infer<typeof AllocateStatPointsResponseSchema>;

/**
 * Reset stat points response
 */
export const ResetStatPointsResponseSchema = z.object({
  success: z.boolean(),
  pointsRefunded: z.number().int().min(0),
  newTotalSpent: z.number().int().min(0),
  availablePoints: z.number().int().min(0),
  error: z.string().optional(),
});
export type ResetStatPointsResponse = z.infer<typeof ResetStatPointsResponseSchema>;

/**
 * Award stat points response (internal, returned after wave/level up)
 */
export const AwardStatPointsResponseSchema = z.object({
  pointsAwarded: z.number().int().min(0),
  newTotalEarned: z.number().int().min(0),
  availablePoints: z.number().int().min(0),
});
export type AwardStatPointsResponse = z.infer<typeof AwardStatPointsResponseSchema>;

// ============================================================================
// STAT POINT INFO (for UI display)
// ============================================================================

/**
 * Individual stat allocation info for UI
 */
export const StatPointAllocationInfoSchema = z.object({
  stat: z.string(),
  currentPoints: z.number().int().min(0),
  maxPoints: z.number().int().min(0),
  bonusPerPoint: z.number(),
  currentBonusPercent: z.number(),
  canAllocate: z.boolean(),
});
export type StatPointAllocationInfo = z.infer<typeof StatPointAllocationInfoSchema>;

/**
 * Available allocations response (for UI - shows all allocatable stats)
 */
export const AvailableStatAllocationsResponseSchema = z.object({
  availablePoints: z.number().int().min(0),
  fortressStats: z.array(StatPointAllocationInfoSchema),
  heroStats: z.record(z.string(), z.array(StatPointAllocationInfoSchema)), // heroId -> stats
});
export type AvailableStatAllocationsResponse = z.infer<typeof AvailableStatAllocationsResponseSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const STAT_POINTS_ERROR_CODES = {
  INSUFFICIENT_POINTS: 'INSUFFICIENT_POINTS',
  INVALID_STAT: 'INVALID_STAT',
  INVALID_TARGET: 'INVALID_TARGET',
  HERO_NOT_FOUND: 'HERO_NOT_FOUND',
  MAX_ALLOCATION_REACHED: 'MAX_ALLOCATION_REACHED',
  NOTHING_TO_RESET: 'NOTHING_TO_RESET',
} as const;

export type StatPointsErrorCode = (typeof STAT_POINTS_ERROR_CODES)[keyof typeof STAT_POINTS_ERROR_CODES];
