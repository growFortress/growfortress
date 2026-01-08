import { z } from 'zod';
import { FortressClassSchema, InventorySchema } from './auth.js';
import { CheckpointSchema } from './events.js';

// Session start request
export const SessionStartRequestSchema = z.object({
  fortressClass: FortressClassSchema.optional(),
  startingHeroes: z.array(z.string()).optional(),
  startingTurrets: z.array(z.string()).optional(),
});

export type SessionStartRequest = z.infer<typeof SessionStartRequestSchema>;

// Session end request
export const SessionEndRequestSchema = z.object({
  reason: z.string().optional().default('manual'),
  partialRewards: z.object({
    gold: z.number().int().min(0),
    dust: z.number().int().min(0),
    xp: z.number().int().min(0),
    finalWave: z.number().int().min(0),
  }).optional(),
});

export type SessionEndRequest = z.infer<typeof SessionEndRequestSchema>;

// Update default loadout request
export const UpdateLoadoutRequestSchema = z.object({
  defaultHeroes: z.array(z.string()).max(4).optional(),
  defaultTurrets: z.array(z.object({
    slotIndex: z.number().int().min(0).max(7),
    turretId: z.string(),
  })).max(8).optional(),
  fortressClass: FortressClassSchema.optional(),
});

export type UpdateLoadoutRequest = z.infer<typeof UpdateLoadoutRequestSchema>;

// Progression bonuses for session start (unified system)
export const ProgressionBonusesSchema = z.object({
  damageMultiplier: z.number(),
  goldMultiplier: z.number(),
  startingGold: z.number(),
  maxHeroSlots: z.number().int().min(1).max(4),
  maxTurretSlots: z.number().int().min(1).max(6),
});

export type ProgressionBonuses = z.infer<typeof ProgressionBonusesSchema>;

// Session start response
export const SessionStartResponseSchema = z.object({
  sessionId: z.string(),
  sessionToken: z.string(),
  seed: z.number(),
  simVersion: z.number(),
  tickHz: z.number(),
  startingWave: z.number(),
  segmentAuditTicks: z.array(z.number()),
  inventory: InventorySchema,
  commanderLevel: z.number().int().min(1),
  progressionBonuses: ProgressionBonusesSchema,
  // Remote config values that must match between client and server for determinism
  fortressBaseHp: z.number().int().min(1),
  fortressBaseDamage: z.number().int().min(1),
  waveIntervalTicks: z.number().int().min(1),
});

export type SessionStartResponse = z.infer<typeof SessionStartResponseSchema>;

// Segment submit request
export const SegmentSubmitRequestSchema = z.object({
  sessionToken: z.string(),
  startWave: z.number().int().min(0),
  endWave: z.number().int().min(1),
  events: z.array(z.unknown()),
  checkpoints: z.array(CheckpointSchema),
  finalHash: z.number().int(),
});

export type SegmentSubmitRequest = z.infer<typeof SegmentSubmitRequestSchema>;

// Segment submit response
export const SegmentSubmitResponseSchema = z.object({
  verified: z.boolean(),
  rejectReason: z.string().optional(),
  goldEarned: z.number(),
  dustEarned: z.number(),
  xpEarned: z.number(),
  nextSegmentAuditTicks: z.array(z.number()),
  newInventory: InventorySchema,
  newProgression: z.object({
    level: z.number().int().min(1),
    xp: z.number().int().min(0),
    totalXp: z.number().int().min(0),
    xpToNextLevel: z.number().int().min(0),
  }),
});

export type SegmentSubmitResponse = z.infer<typeof SegmentSubmitResponseSchema>;

// Partial rewards for session end
export const PartialRewardsSchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  xp: z.number().int().min(0),
  finalWave: z.number().int().min(0),
});

export type PartialRewards = z.infer<typeof PartialRewardsSchema>;

// Session end response
export const SessionEndResponseSchema = z.object({
  finalWave: z.number().int(),
  totalGoldEarned: z.number(),
  totalDustEarned: z.number(),
  totalXpEarned: z.number(),
});

export type SessionEndResponse = z.infer<typeof SessionEndResponseSchema>;
