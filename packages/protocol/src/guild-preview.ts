/**
 * Guild Preview Protocol Schema
 * Types for viewing other guilds' public information
 */
import { z } from 'zod';
import { GuildRoleSchema, GuildStructureLevelsSchema } from './guild.js';

// ============================================================================
// GUILD PREVIEW MEMBER
// ============================================================================

export const GuildPreviewMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  role: GuildRoleSchema,
  level: z.number().int().min(1),
  power: z.number().int().min(0),
  isOnline: z.boolean().optional(),
});
export type GuildPreviewMember = z.infer<typeof GuildPreviewMemberSchema>;

// ============================================================================
// GUILD PREVIEW BONUSES
// ============================================================================

export const GuildPreviewBonusesSchema = z.object({
  // Gold bonus (from Skarbiec structure)
  goldBoost: z.number().min(0),
  // XP bonus (from Akademia structure)
  xpBoost: z.number().min(0),
  // Stat boost (from Zbrojownia structure - applies to heroes HP & damage)
  statBoost: z.number().min(0),
});
export type GuildPreviewBonuses = z.infer<typeof GuildPreviewBonusesSchema>;

// ============================================================================
// GUILD PREVIEW RESPONSE
// ============================================================================

export const GuildPreviewResponseSchema = z.object({
  guildId: z.string(),
  name: z.string(),
  tag: z.string(),
  description: z.string().nullable(),
  honor: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  maxMembers: z.number().int().min(10).max(30),
  trophies: z.array(z.string()),
  structures: GuildStructureLevelsSchema,
  bonuses: GuildPreviewBonusesSchema,
  topMembers: z.array(GuildPreviewMemberSchema), // TOP 5 members
  createdAt: z.string().datetime(),
});
export type GuildPreviewResponse = z.infer<typeof GuildPreviewResponseSchema>;
