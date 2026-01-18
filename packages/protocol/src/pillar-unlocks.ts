import { z } from 'zod';

// ============================================================================
// PILLAR UNLOCK SYSTEM - Dust-gated World Progression
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

/**
 * Unlock requirements for each pillar
 */
export interface PillarUnlockRequirement {
  pillarId: PillarUnlockId;
  fortressLevel: number;
  dustCost: number;
  name: string;
  description: string;
}

/**
 * Static unlock requirements for all pillars
 * Players need both fortress level AND dust to unlock
 */
export const PILLAR_UNLOCK_REQUIREMENTS: PillarUnlockRequirement[] = [
  {
    pillarId: 'streets',
    fortressLevel: 1,
    dustCost: 0,
    name: 'Ulice',
    description: 'Początkowy sektor - zawsze dostępny',
  },
  {
    pillarId: 'science',
    fortressLevel: 10,
    dustCost: 50,
    name: 'Nauka i Technologia',
    description: 'Laboratoria i roboty czekają',
  },
  {
    pillarId: 'mutants',
    fortressLevel: 20,
    dustCost: 150,
    name: 'Mutanci',
    description: 'Świat mutantów i dyskryminacji',
  },
  {
    pillarId: 'cosmos',
    fortressLevel: 35,
    dustCost: 400,
    name: 'Kosmos',
    description: 'Imperia gwiezdne i kosmiczne bestie',
  },
  {
    pillarId: 'magic',
    fortressLevel: 50,
    dustCost: 800,
    name: 'Magia i Wymiary',
    description: 'Mistyczne krainy i demony',
  },
  {
    pillarId: 'gods',
    fortressLevel: 70,
    dustCost: 1500,
    name: 'Bogowie',
    description: 'Ostateczne wyzwanie - walka z bogami',
  },
];

// Total dust to unlock all pillars: 0 + 50 + 150 + 400 + 800 + 1500 = 2900 dust
export const TOTAL_PILLAR_UNLOCK_DUST = PILLAR_UNLOCK_REQUIREMENTS.reduce(
  (sum, req) => sum + req.dustCost,
  0
);

// ============================================================================
// API SCHEMAS
// ============================================================================

/**
 * Single pillar unlock info for API response
 */
export const PillarUnlockInfoSchema = z.object({
  pillarId: PillarUnlockIdSchema,
  name: z.string(),
  fortressLevel: z.number().int().min(1),
  dustCost: z.number().int().min(0),
  isUnlocked: z.boolean(),
  canUnlock: z.boolean(),
  reason: z.string().optional(), // Why can't unlock (if canUnlock is false)
});

export type PillarUnlockInfo = z.infer<typeof PillarUnlockInfoSchema>;

/**
 * GET /pillars/unlocks - Response
 */
export const GetPillarUnlocksResponseSchema = z.object({
  unlockedPillars: z.array(PillarUnlockIdSchema),
  allPillars: z.array(PillarUnlockInfoSchema),
  currentFortressLevel: z.number().int().min(1),
  currentDust: z.number().int().min(0),
});

export type GetPillarUnlocksResponse = z.infer<typeof GetPillarUnlocksResponseSchema>;

/**
 * POST /pillars/:pillarId/unlock - Request
 */
export const UnlockPillarRequestSchema = z.object({
  pillarId: PillarUnlockIdSchema,
});

export type UnlockPillarRequest = z.infer<typeof UnlockPillarRequestSchema>;

/**
 * POST /pillars/:pillarId/unlock - Response
 */
export const UnlockPillarResponseSchema = z.object({
  success: z.boolean(),
  pillarId: PillarUnlockIdSchema.optional(),
  dustSpent: z.number().int().min(0).optional(),
  newDust: z.number().int().min(0).optional(),
  unlockedPillars: z.array(PillarUnlockIdSchema).optional(),
  error: z.string().optional(),
});

export type UnlockPillarResponse = z.infer<typeof UnlockPillarResponseSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const PILLAR_UNLOCK_ERROR_CODES = {
  ALREADY_UNLOCKED: 'ALREADY_UNLOCKED',
  INSUFFICIENT_LEVEL: 'INSUFFICIENT_LEVEL',
  INSUFFICIENT_DUST: 'INSUFFICIENT_DUST',
  INVALID_PILLAR: 'INVALID_PILLAR',
} as const;

export type PillarUnlockErrorCode = keyof typeof PILLAR_UNLOCK_ERROR_CODES;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get unlock requirement for a specific pillar
 */
export function getPillarUnlockRequirement(pillarId: PillarUnlockId): PillarUnlockRequirement | undefined {
  return PILLAR_UNLOCK_REQUIREMENTS.find(req => req.pillarId === pillarId);
}

/**
 * Check if a pillar can be unlocked given current state
 */
export function canUnlockPillar(
  pillarId: PillarUnlockId,
  unlockedPillars: PillarUnlockId[],
  fortressLevel: number,
  dust: number
): { canUnlock: boolean; reason?: string } {
  if (unlockedPillars.includes(pillarId)) {
    return { canUnlock: false, reason: 'Już odblokowany' };
  }

  const requirement = getPillarUnlockRequirement(pillarId);
  if (!requirement) {
    return { canUnlock: false, reason: 'Nieprawidłowy filar' };
  }

  if (fortressLevel < requirement.fortressLevel) {
    return { canUnlock: false, reason: `Wymagany poziom ${requirement.fortressLevel}` };
  }

  if (dust < requirement.dustCost) {
    return { canUnlock: false, reason: `Wymagane ${requirement.dustCost} dust` };
  }

  return { canUnlock: true };
}
