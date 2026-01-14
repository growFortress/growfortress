/**
 * Guild Preview Protocol Schema
 * Types for viewing other guilds' public information
 */
import { z } from 'zod';
import { GuildRoleSchema, GuildTechLevelsSchema } from './guild.js';

// ============================================================================
// GUILD PREVIEW MEMBER
// ============================================================================

export const GuildPreviewMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  role: GuildRoleSchema,
  level: z.number().int().min(1),
  power: z.number().int().min(0),
});
export type GuildPreviewMember = z.infer<typeof GuildPreviewMemberSchema>;

// ============================================================================
// GUILD PREVIEW BONUSES
// ============================================================================

export const GuildPreviewBonusesSchema = z.object({
  // Economy bonuses (from guild level)
  goldPercent: z.number().min(0),
  dustPercent: z.number().min(0),
  xpPercent: z.number().min(0),
  // Fortress bonuses (from tech tree)
  fortressHpPercent: z.number().min(0),
  fortressDamagePercent: z.number().min(0),
  fortressRegenPercent: z.number().min(0),
  // Hero bonuses (from tech tree)
  heroHpPercent: z.number().min(0),
  heroDamagePercent: z.number().min(0),
  heroCooldownPercent: z.number().min(0),
  // Turret bonuses (from tech tree)
  turretDamagePercent: z.number().min(0),
  turretSpeedPercent: z.number().min(0),
  turretRangePercent: z.number().min(0),
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
  level: z.number().int().min(1).max(20),
  xp: z.number().int().min(0),
  xpToNextLevel: z.number().int().min(0),
  honor: z.number().int().min(0),
  memberCount: z.number().int().min(0),
  maxMembers: z.number().int().min(10).max(20),
  trophies: z.array(z.string()),
  techLevels: GuildTechLevelsSchema,
  bonuses: GuildPreviewBonusesSchema,
  topMembers: z.array(GuildPreviewMemberSchema), // TOP 5 members
  createdAt: z.string().datetime(),
});
export type GuildPreviewResponse = z.infer<typeof GuildPreviewResponseSchema>;
