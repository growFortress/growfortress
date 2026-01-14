/**
 * Slot Purchase API Schemas
 *
 * Zod schemas for hero and turret slot purchase requests and responses.
 */

import { z } from 'zod';

// ============================================================================
// CONSTANTS
// ============================================================================

export const MAX_HERO_SLOTS = 6;
export const MAX_TURRET_SLOTS = 6;

// ============================================================================
// SLOT INFO SCHEMA
// ============================================================================

/**
 * Information about a single slot unlock
 */
export const SlotUnlockInfoSchema = z.object({
  slot: z.number().int().min(1).max(6),
  levelRequired: z.number().int().min(1),
  goldCost: z.number().int().min(0),
  isFree: z.boolean(),
});

export type SlotUnlockInfo = z.infer<typeof SlotUnlockInfoSchema>;

/**
 * Next purchasable slot info for UI display
 */
export const NextSlotInfoSchema = z.object({
  slot: z.number().int().min(1).max(6),
  levelRequired: z.number().int().min(1),
  goldCost: z.number().int().min(0),
  canPurchase: z.boolean(),
  reason: z.enum(['level_too_low', 'insufficient_gold', 'max_slots', 'already_free']).optional(),
});

export type NextSlotInfo = z.infer<typeof NextSlotInfoSchema>;

// ============================================================================
// PURCHASE REQUEST/RESPONSE SCHEMAS
// ============================================================================

/**
 * Request to purchase a hero slot
 * No body needed - server determines next available slot
 */
export const PurchaseHeroSlotRequestSchema = z.object({});

export type PurchaseHeroSlotRequest = z.infer<typeof PurchaseHeroSlotRequestSchema>;

/**
 * Response from purchasing a hero slot
 */
export const PurchaseHeroSlotResponseSchema = z.object({
  success: z.boolean(),
  newSlotCount: z.number().int().min(1).max(MAX_HERO_SLOTS).optional(),
  goldSpent: z.number().int().min(0).optional(),
  newGold: z.number().int().min(0).optional(),
  error: z.string().optional(),
});

export type PurchaseHeroSlotResponse = z.infer<typeof PurchaseHeroSlotResponseSchema>;

/**
 * Request to purchase a turret slot
 */
export const PurchaseTurretSlotRequestSchema = z.object({});

export type PurchaseTurretSlotRequest = z.infer<typeof PurchaseTurretSlotRequestSchema>;

/**
 * Response from purchasing a turret slot
 */
export const PurchaseTurretSlotResponseSchema = z.object({
  success: z.boolean(),
  newSlotCount: z.number().int().min(1).max(MAX_TURRET_SLOTS).optional(),
  goldSpent: z.number().int().min(0).optional(),
  newGold: z.number().int().min(0).optional(),
  error: z.string().optional(),
});

export type PurchaseTurretSlotResponse = z.infer<typeof PurchaseTurretSlotResponseSchema>;

// ============================================================================
// SLOT INFO RESPONSE (for profile/session)
// ============================================================================

/**
 * Current slot status included in profile response
 */
export const SlotStatusSchema = z.object({
  currentHeroSlots: z.number().int().min(1).max(MAX_HERO_SLOTS),
  currentTurretSlots: z.number().int().min(1).max(MAX_TURRET_SLOTS),
  nextHeroSlot: NextSlotInfoSchema.nullable(),
  nextTurretSlot: NextSlotInfoSchema.nullable(),
});

export type SlotStatus = z.infer<typeof SlotStatusSchema>;
