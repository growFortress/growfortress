import { z } from 'zod';

// ============================================================================
// PILLAR UNLOCK SYSTEM - Level-gated World Progression
// ============================================================================

/**
 * Pillar IDs - matches sim-core PillarId type
 */
export const PillarUnlockIdSchema = z.enum([
  'streets',
  'science',
  'mutants',
  'cosmos',
  'magic',
  'gods',
]);

export type PillarUnlockId = z.infer<typeof PillarUnlockIdSchema>;

// ============================================================================
// API SCHEMAS
// ============================================================================

/**
 * Single pillar unlock info for API response
 */
export const PillarUnlockInfoSchema = z.object({
  pillarId: PillarUnlockIdSchema,
  requiredLevel: z.number().int().min(1),
  isUnlocked: z.boolean(),
});

export type PillarUnlockInfo = z.infer<typeof PillarUnlockInfoSchema>;

/**
 * GET /pillars/unlocks - Response
 */
export const GetPillarUnlocksResponseSchema = z.object({
  unlockedPillars: z.array(PillarUnlockIdSchema),
  allPillars: z.array(PillarUnlockInfoSchema),
  currentFortressLevel: z.number().int().min(1),
});

export type GetPillarUnlocksResponse = z.infer<typeof GetPillarUnlocksResponseSchema>;
