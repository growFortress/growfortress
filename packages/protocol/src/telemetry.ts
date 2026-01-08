import { z } from 'zod';

// Single telemetry event
export const TelemetryEventSchema = z.object({
  eventType: z.string().max(64),
  timestamp: z.number().int(),
  data: z.record(z.unknown()).optional(),
});

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;

// Batch telemetry request
export const TelemetryBatchRequestSchema = z.object({
  events: z.array(TelemetryEventSchema).max(100),
});

export type TelemetryBatchRequest = z.infer<typeof TelemetryBatchRequestSchema>;

// Telemetry response
export const TelemetryBatchResponseSchema = z.object({
  accepted: z.number().int().min(0),
});

export type TelemetryBatchResponse = z.infer<typeof TelemetryBatchResponseSchema>;

// Common telemetry event types
export const TELEMETRY_EVENTS = {
  RUN_STARTED: 'run_started',
  RUN_FINISHED: 'run_finished',
  RUN_ABANDONED: 'run_abandoned',
  RELIC_CHOSEN: 'relic_chosen',
  SKILL_USED: 'skill_used',
  WAVE_COMPLETED: 'wave_completed',
  ENEMY_KILLED: 'enemy_killed',
  FORTRESS_DAMAGED: 'fortress_damaged',
  CLIENT_ERROR: 'client_error',
  SYNC_COMPLETED: 'sync_completed',
  BATTLE_SUMMARY: 'battle_summary',
} as const;

export type TelemetryEventType = typeof TELEMETRY_EVENTS[keyof typeof TELEMETRY_EVENTS];
