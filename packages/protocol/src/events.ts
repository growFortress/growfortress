import { z } from 'zod';

// Base event with tick
const BaseEventSchema = z.object({
  tick: z.number().int().min(0),
});

// Choose relic event
export const ChooseRelicEventSchema = BaseEventSchema.extend({
  type: z.literal('CHOOSE_RELIC'),
  wave: z.number().int().min(1).optional(), // Wave number (endless mode)
  optionIndex: z.number().int().min(0).max(2).optional(), // Option index (endless mode)
  relicId: z.string().optional(), // Relic ID (boss rush mode)
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
  heroId: z.string().optional(), // Required for 'move', optional for team commands
  targetX: z.number().optional(), // Position for 'move', enemy position for 'focus', attack target for 'manual_attack'
  targetY: z.number().optional(),
  commandType: z.enum(['move', 'focus', 'retreat', 'manual_attack']).optional(), // Default: 'move' (handled in code)
  targetEnemyId: z.number().optional(), // Enemy ID for 'focus' command
});

export type HeroCommandEvent = z.infer<typeof HeroCommandEventSchema>;

// Hero manual control toggle (player takes/releases direct control)
export const HeroControlEventSchema = BaseEventSchema.extend({
  type: z.literal('HERO_CONTROL'),
  heroId: z.string(),
  active: z.boolean(),
});

export type HeroControlEvent = z.infer<typeof HeroControlEventSchema>;

// Activate fortress skill at target location
export const ActivateSkillEventSchema = BaseEventSchema.extend({
  type: z.literal('ACTIVATE_SKILL'),
  skillId: z.string(),
  targetX: z.number(), // FP x coordinate
  targetY: z.number(), // FP y coordinate
});

export type ActivateSkillEvent = z.infer<typeof ActivateSkillEventSchema>;

// Place wall at target location
export const PlaceWallEventSchema = BaseEventSchema.extend({
  type: z.literal('PLACE_WALL'),
  wallType: z.enum(['basic', 'reinforced', 'gate']),
  x: z.number(), // FP x coordinate
  y: z.number(), // FP y coordinate
});

export type PlaceWallEvent = z.infer<typeof PlaceWallEventSchema>;

// Remove wall by ID
export const RemoveWallEventSchema = BaseEventSchema.extend({
  type: z.literal('REMOVE_WALL'),
  wallId: z.number(),
});

export type RemoveWallEvent = z.infer<typeof RemoveWallEventSchema>;

// Set turret targeting mode
export const SetTurretTargetingEventSchema = BaseEventSchema.extend({
  type: z.literal('SET_TURRET_TARGETING'),
  slotIndex: z.number(),
  targetingMode: z.enum(['closest_to_fortress', 'weakest', 'strongest', 'nearest_to_turret', 'fastest']),
});

export type SetTurretTargetingEvent = z.infer<typeof SetTurretTargetingEventSchema>;

// Activate turret overcharge ability
export const ActivateOverchargeEventSchema = BaseEventSchema.extend({
  type: z.literal('ACTIVATE_OVERCHARGE'),
  slotIndex: z.number(),
});

export type ActivateOverchargeEvent = z.infer<typeof ActivateOverchargeEventSchema>;

// Spawn militia unit(s)
export const SpawnMilitiaEventSchema = BaseEventSchema.extend({
  type: z.literal('SPAWN_MILITIA'),
  militiaType: z.enum(['infantry', 'archer', 'shield_bearer']),
  x: z.number(), // FP x coordinate
  y: z.number(), // FP y coordinate
  count: z.number().int().min(1).max(5).optional(), // Number of units to spawn (default 1)
});

export type SpawnMilitiaEvent = z.infer<typeof SpawnMilitiaEventSchema>;

// Shop purchase event (Boss Rush roguelike mode)
export const ShopPurchaseEventSchema = BaseEventSchema.extend({
  type: z.literal('SHOP_PURCHASE'),
  itemId: z.string(), // Shop item ID to purchase
});

export type ShopPurchaseEvent = z.infer<typeof ShopPurchaseEventSchema>;

// Union of all game events
export const GameEventSchema = z.discriminatedUnion('type', [
  ChooseRelicEventSchema,
  RerollRelicsEventSchema,
  ActivateSnapEventSchema,
  HeroCommandEventSchema,
  HeroControlEventSchema,
  ActivateSkillEventSchema,
  PlaceWallEventSchema,
  RemoveWallEventSchema,
  SetTurretTargetingEventSchema,
  ActivateOverchargeEventSchema,
  SpawnMilitiaEventSchema,
  ShopPurchaseEventSchema,
]);

export type GameEvent = z.infer<typeof GameEventSchema>;

// Checkpoint structure
export const CheckpointSchema = z.object({
  tick: z.number().int().min(0),
  hash32: z.number().int(),
  chainHash32: z.number().int(),
});

export type Checkpoint = z.infer<typeof CheckpointSchema>;
