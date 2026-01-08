import { z } from 'zod';
import { GameEventSchema, CheckpointSchema } from './events.js';
import { InventorySchema, ProgressionSchema } from './auth.js';
import { ProgressionBonusesSchema } from './sessions.js';

// Run start response
export const RunStartResponseSchema = z.object({
  runId: z.string(),
  runToken: z.string(),
  seed: z.number().int(),
  simVersion: z.number().int(),
  tickHz: z.number().int().default(30),
  maxWaves: z.number().int(),
  auditTicks: z.array(z.number().int()),
  progressionBonuses: ProgressionBonusesSchema,
});

export type RunStartResponse = z.infer<typeof RunStartResponseSchema>;

// Run finish request
export const RunFinishRequestSchema = z.object({
  runToken: z.string(),
  events: z.array(GameEventSchema).max(1000),
  checkpoints: z.array(CheckpointSchema).max(500),
  finalHash: z.number().int(),
  score: z.number().int().min(0),
  summary: z.object({
    wavesCleared: z.number().int().min(0),
    kills: z.number().int().min(0),
    eliteKills: z.number().int().min(0),
    goldEarned: z.number().int().min(0),
    dustEarned: z.number().int().min(0),
    timeSurvived: z.number().int().min(0), // in ticks
    relicsCollected: z.array(z.string()),
  }),
});

export type RunFinishRequest = z.infer<typeof RunFinishRequestSchema>;

// Rewards from verified run
export const RunRewardsSchema = z.object({
  gold: z.number().int().min(0),
  dust: z.number().int().min(0),
  xp: z.number().int().min(0),
  levelUp: z.boolean(),
  newLevel: z.number().int().optional(),
});

export type RunRewards = z.infer<typeof RunRewardsSchema>;

// Run finish response
export const RunFinishResponseSchema = z.object({
  verified: z.boolean(),
  rewards: RunRewardsSchema.optional(),
  reason: z.string().optional(),
  newInventory: InventorySchema.optional(),
  newProgression: ProgressionSchema.optional(),
});

export type RunFinishResponse = z.infer<typeof RunFinishResponseSchema>;

// Rejection reasons
export const RUN_REJECTION_REASONS = {
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SIM_VERSION_MISMATCH: 'SIM_VERSION_MISMATCH',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND',
  RUN_ALREADY_FINISHED: 'RUN_ALREADY_FINISHED',
  EVENTS_INVALID: 'EVENTS_INVALID',
  TICKS_NOT_MONOTONIC: 'TICKS_NOT_MONOTONIC',
  CHECKPOINT_MISMATCH: 'CHECKPOINT_MISMATCH',
  AUDIT_TICK_MISSING: 'AUDIT_TICK_MISSING',
  FINAL_HASH_MISMATCH: 'FINAL_HASH_MISMATCH',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type RunRejectionReason = keyof typeof RUN_REJECTION_REASONS;
