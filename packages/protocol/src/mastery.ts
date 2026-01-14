import { z } from 'zod';
import { FortressClassSchema } from './auth.js';

// ============================================================================
// MASTERY NODE SCHEMAS
// ============================================================================

export const MasteryNodeIdSchema = z.string();
export type MasteryNodeIdType = z.infer<typeof MasteryNodeIdSchema>;

export const MasteryNodeTypeSchema = z.enum([
  'stat_bonus',
  'synergy_amplifier',
  'class_perk',
  'capstone',
]);
export type MasteryNodeTypeType = z.infer<typeof MasteryNodeTypeSchema>;

export const MasteryTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);
export type MasteryTierType = z.infer<typeof MasteryTierSchema>;

// ============================================================================
// MASTERY PROGRESS SCHEMAS
// ============================================================================

export const ClassMasteryProgressSchema = z.object({
  pointsSpent: z.number().int().min(0),
  unlockedNodes: z.array(MasteryNodeIdSchema),
});
export type ClassMasteryProgress = z.infer<typeof ClassMasteryProgressSchema>;

export const PlayerMasteryProgressSchema = z.object({
  availablePoints: z.number().int().min(0),
  totalPointsEarned: z.number().int().min(0),
  classProgress: z.record(FortressClassSchema, ClassMasteryProgressSchema),
  updatedAt: z.string().datetime().optional(),
});
export type PlayerMasteryProgress = z.infer<typeof PlayerMasteryProgressSchema>;

// ============================================================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================================================

// GET /api/v1/mastery - Get player's mastery progress
export const GetMasteryProgressResponseSchema = z.object({
  progress: PlayerMasteryProgressSchema,
});
export type GetMasteryProgressResponse = z.infer<typeof GetMasteryProgressResponseSchema>;

// POST /api/v1/mastery/unlock - Unlock a node
export const UnlockMasteryNodeRequestSchema = z.object({
  nodeId: MasteryNodeIdSchema,
});
export type UnlockMasteryNodeRequest = z.infer<typeof UnlockMasteryNodeRequestSchema>;

export const UnlockMasteryNodeResponseSchema = z.object({
  success: z.boolean(),
  progress: PlayerMasteryProgressSchema,
  message: z.string().optional(),
});
export type UnlockMasteryNodeResponse = z.infer<typeof UnlockMasteryNodeResponseSchema>;

// POST /api/v1/mastery/respec - Reset a class tree
export const RespecMasteryTreeRequestSchema = z.object({
  class: FortressClassSchema,
});
export type RespecMasteryTreeRequest = z.infer<typeof RespecMasteryTreeRequestSchema>;

export const RespecMasteryTreeResponseSchema = z.object({
  success: z.boolean(),
  progress: PlayerMasteryProgressSchema,
  pointsReturned: z.number().int().min(0),
  pointsLost: z.number().int().min(0),
  message: z.string().optional(),
});
export type RespecMasteryTreeResponse = z.infer<typeof RespecMasteryTreeResponseSchema>;

// GET /api/v1/mastery/trees - Get all tree definitions (static, cacheable)
export const MasterySynergyAmplifierSchema = z.object({
  heroSynergyBonus: z.number().optional(),
  turretSynergyBonus: z.number().optional(),
  fullSynergyBonus: z.number().optional(),
});
export type MasterySynergyAmplifier = z.infer<typeof MasterySynergyAmplifierSchema>;

export const MasteryClassPerkSchema = z.object({
  id: z.string(),
  description: z.string(),
});
export type MasteryClassPerk = z.infer<typeof MasteryClassPerkSchema>;

export const MasteryNodeEffectSchema = z.object({
  modifiers: z.record(z.string(), z.number()).optional(),
  synergyAmplifier: MasterySynergyAmplifierSchema.optional(),
  classPerk: MasteryClassPerkSchema.optional(),
});
export type MasteryNodeEffect = z.infer<typeof MasteryNodeEffectSchema>;

export const MasteryNodeDefinitionSchema = z.object({
  id: MasteryNodeIdSchema,
  name: z.string(),
  description: z.string(),
  class: FortressClassSchema,
  tier: MasteryTierSchema,
  type: MasteryNodeTypeSchema,
  cost: z.number().int().min(1),
  requires: z.array(MasteryNodeIdSchema),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  effects: MasteryNodeEffectSchema,
  icon: z.string(),
});
export type MasteryNodeDefinition = z.infer<typeof MasteryNodeDefinitionSchema>;

export const MasteryTreeDefinitionSchema = z.object({
  class: FortressClassSchema,
  name: z.string(),
  description: z.string(),
  nodes: z.array(MasteryNodeDefinitionSchema),
  totalNodes: z.number().int().min(1),
  maxPointsToComplete: z.number().int().min(1),
});
export type MasteryTreeDefinition = z.infer<typeof MasteryTreeDefinitionSchema>;

export const GetMasteryTreesResponseSchema = z.object({
  trees: z.record(FortressClassSchema, MasteryTreeDefinitionSchema),
});
export type GetMasteryTreesResponse = z.infer<typeof GetMasteryTreesResponseSchema>;

// ============================================================================
// MASTERY POINT AWARD SCHEMAS (for internal use)
// ============================================================================

export const MasteryPointConditionSchema = z.enum([
  'wave_milestone',
  'boss_kill',
  'class_usage',
  'achievement',
  'weekly_challenge',
  'guild_activity',
]);
export type MasteryPointConditionType = z.infer<typeof MasteryPointConditionSchema>;

export const AwardMasteryPointsRequestSchema = z.object({
  source: z.string(),
  amount: z.number().int().min(1),
});
export type AwardMasteryPointsRequest = z.infer<typeof AwardMasteryPointsRequestSchema>;

export const AwardMasteryPointsResponseSchema = z.object({
  success: z.boolean(),
  newAvailablePoints: z.number().int().min(0),
  newTotalEarned: z.number().int().min(0),
});
export type AwardMasteryPointsResponse = z.infer<typeof AwardMasteryPointsResponseSchema>;

// ============================================================================
// CLASS PROGRESS SUMMARY SCHEMAS (for UI)
// ============================================================================

export const ClassProgressSummarySchema = z.object({
  class: FortressClassSchema,
  pointsSpent: z.number().int().min(0),
  nodesUnlocked: z.number().int().min(0),
  totalNodes: z.number().int().min(1),
  percentComplete: z.number().int().min(0).max(100),
  highestTierUnlocked: MasteryTierSchema,
  hasCapstone: z.boolean(),
});
export type ClassProgressSummary = z.infer<typeof ClassProgressSummarySchema>;

export const GetClassProgressSummariesResponseSchema = z.object({
  summaries: z.array(ClassProgressSummarySchema),
  totalPointsSpent: z.number().int().min(0),
  availablePoints: z.number().int().min(0),
});
export type GetClassProgressSummariesResponse = z.infer<typeof GetClassProgressSummariesResponseSchema>;
