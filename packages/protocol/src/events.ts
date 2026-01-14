import { z } from 'zod';

// Base event with tick
const BaseEventSchema = z.object({
  tick: z.number().int().min(0),
});

// Choose relic event
export const ChooseRelicEventSchema = BaseEventSchema.extend({
  type: z.literal('CHOOSE_RELIC'),
  wave: z.number().int().min(1),
  optionIndex: z.number().int().min(0).max(2),
});

export type ChooseRelicEvent = z.infer<typeof ChooseRelicEventSchema>;

// Reroll relics event (optional, costs resource)
export const RerollRelicsEventSchema = BaseEventSchema.extend({
  type: z.literal('REROLL_RELICS'),
});

export type RerollRelicsEvent = z.infer<typeof RerollRelicsEventSchema>;

// Activate Annihilation Wave ability (Crystal Matrix)
// Note: Event type kept as 'ACTIVATE_SNAP' for backwards compatibility with saved sessions
export const ActivateSnapEventSchema = BaseEventSchema.extend({
  type: z.literal('ACTIVATE_SNAP'),
});

export type ActivateSnapEvent = z.infer<typeof ActivateSnapEventSchema>;
export type ActivateAnnihilationEvent = ActivateSnapEvent; // Alias

// Hero command event (player-issued tactical orders)
export const HeroCommandEventSchema = BaseEventSchema.extend({
  type: z.literal('HERO_COMMAND'),
  heroId: z.string(),
  targetX: z.number(),
  targetY: z.number(),
});

export type HeroCommandEvent = z.infer<typeof HeroCommandEventSchema>;

// Union of all game events
export const GameEventSchema = z.discriminatedUnion('type', [
  ChooseRelicEventSchema,
  RerollRelicsEventSchema,
  ActivateSnapEventSchema,
  HeroCommandEventSchema,
]);

export type GameEvent = z.infer<typeof GameEventSchema>;

// Checkpoint structure
export const CheckpointSchema = z.object({
  tick: z.number().int().min(0),
  hash32: z.number().int(),
  chainHash32: z.number().int(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;
