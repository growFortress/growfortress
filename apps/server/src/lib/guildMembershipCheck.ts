/**
 * Guild Membership Check Utility
 *
 * Reusable functions for verifying guild membership and permissions
 * in route handlers to enforce security.
 */

import { prisma } from './prisma.js';
import { GUILD_ERROR_CODES, type GuildRole } from '@arcade/protocol';
import { hasPermission } from '../services/guild.js';

export interface MembershipCheckResult {
  valid: boolean;
  error?: string;
  membership?: {
    userId: string;
    guildId: string;
    role: GuildRole;
  };
}

/**
 * Verify that a user is a member of a specific guild.
 * Use this before accessing guild-specific resources.
 */
export async function requireGuildMembership(
  userId: string,
  guildId: string
): Promise<MembershipCheckResult> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: { select: { disbanded: true } },
    },
  });

  if (!membership) {
    return { valid: false, error: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  if (membership.guildId !== guildId) {
    return { valid: false, error: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  if (membership.guild.disbanded) {
    return { valid: false, error: GUILD_ERROR_CODES.GUILD_DISBANDED };
  }

  return {
    valid: true,
    membership: {
      userId: membership.userId,
      guildId: membership.guildId,
      role: membership.role as GuildRole,
    },
  };
}

/**
 * Verify that a user is a member of a specific guild AND has required permission.
 * Use this for actions that require specific roles (e.g., battle, withdraw).
 */
export async function requireGuildPermission(
  userId: string,
  guildId: string,
  action: 'manage' | 'invite' | 'kick' | 'battle' | 'withdraw'
): Promise<MembershipCheckResult> {
  const membershipResult = await requireGuildMembership(userId, guildId);

  if (!membershipResult.valid) {
    return membershipResult;
  }

  if (!hasPermission(membershipResult.membership!.role, action)) {
    return { valid: false, error: GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS };
  }

  return membershipResult;
}

/**
 * Verify that the user's actual guild matches the expected guildId.
 * Useful for boss/race endpoints where guildId is a URL param but attack uses user's guild.
 */
export async function verifyGuildIdMatchesUserGuild(
  userId: string,
  expectedGuildId: string
): Promise<MembershipCheckResult> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: { select: { disbanded: true } },
    },
  });

  if (!membership) {
    return { valid: false, error: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  if (membership.guild.disbanded) {
    return { valid: false, error: GUILD_ERROR_CODES.GUILD_DISBANDED };
  }

  if (membership.guildId !== expectedGuildId) {
    return { valid: false, error: GUILD_ERROR_CODES.NOT_IN_GUILD };
  }

  return {
    valid: true,
    membership: {
      userId: membership.userId,
      guildId: membership.guildId,
      role: membership.role as GuildRole,
    },
  };
}
