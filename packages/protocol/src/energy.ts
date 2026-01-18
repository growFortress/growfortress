import { z } from 'zod';

// ============================================================================
// ENERGY SYSTEM CONFIGURATION
// ============================================================================

/**
 * Energy system constants for premium economy
 * Energy limits free play and can be refilled with dust
 */
export const ENERGY_CONFIG = {
  /** Maximum energy a player can have */
  MAX_ENERGY: 50,
  /** Minutes between each energy point regeneration */
  REGEN_RATE_MINUTES: 10,
  /** Energy cost to start a wave/run */
  ENERGY_PER_WAVE: 1,
  /** Dust cost to fully refill energy */
  REFILL_DUST_COST: 30,
} as const;

// ============================================================================
// ENERGY STATUS RESPONSE
// ============================================================================

export const EnergyStatusSchema = z.object({
  currentEnergy: z.number().int().min(0),
  maxEnergy: z.number().int().positive(),
  nextRegenAt: z.string().datetime().nullable(),
  timeToFullRegen: z.number().int().min(0), // seconds until full
  canPlay: z.boolean(), // true if currentEnergy >= ENERGY_PER_WAVE
});

export type EnergyStatus = z.infer<typeof EnergyStatusSchema>;

// ============================================================================
// ENERGY REFILL
// ============================================================================

export const RefillEnergyResponseSchema = z.object({
  success: z.boolean(),
  newEnergy: z.number().int().min(0).optional(),
  dustSpent: z.number().int().min(0).optional(),
  newDust: z.number().int().min(0).optional(),
  error: z.string().optional(),
});

export type RefillEnergyResponse = z.infer<typeof RefillEnergyResponseSchema>;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ENERGY_ERROR_CODES = {
  INSUFFICIENT_DUST: 'INSUFFICIENT_DUST',
  ENERGY_FULL: 'ENERGY_FULL',
  INSUFFICIENT_ENERGY: 'INSUFFICIENT_ENERGY',
} as const;

export type EnergyErrorCode = keyof typeof ENERGY_ERROR_CODES;
