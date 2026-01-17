import { prisma } from '../lib/prisma.js';
import {
  GUILD_CONSTANTS,
  GUILD_ERROR_CODES,
  type GuildRole,
  type GuildInvitationStatus,
} from '@arcade/protocol';
import { hasPermission } from './guild.js';
import { getMemberCapacity } from './guildStructures.js';
import { createGuildInviteNotification } from './messages.js';
import { broadcastToUser } from './websocket.js';
import type { GuildInvitation } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface GuildInvitationWithDetails extends GuildInvitation {
  guild: {
    name: string;
    tag: string;
  };
  inviter: {
    displayName: string;
  };
  invitee: {
    displayName: string;
  };
}

// ============================================================================
// INVITATION MANAGEMENT
// ============================================================================

/**
 * Create a guild invitation
 */
export async function createInvitation(
  guildId: string,
  inviterId: string,
  inviteeId: string,
  message?: string
): Promise<GuildInvitationWithDetails> {
  // Check inviter permissions
  const inviterMembership = await prisma.guildMember.findUnique({
    where: { userId: inviterId },
  });

  if (!inviterMembership || inviterMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (!hasPermission(inviterMembership.role as GuildRole, 'invite')) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Check guild exists and not disbanded
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    select: {
      id: true,
      structureKwatera: true,
      disbanded: true,
      settings: true,
      _count: { select: { members: true } },
    },
  });

  if (!guild || guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
  }

  // Check guild capacity
  const maxMembers = getMemberCapacity(guild.structureKwatera);
  if (guild._count.members >= maxMembers) {
    throw new Error(GUILD_ERROR_CODES.GUILD_FULL);
  }

  // Check invitee exists
  const invitee = await prisma.user.findUnique({
    where: { id: inviteeId },
    select: {
      id: true,
    },
  });

  if (!invitee) {
    throw new Error(GUILD_ERROR_CODES.USER_NOT_FOUND);
  }

  // Note: Invitations intentionally bypass minLevel requirement
  // This allows officers/leaders to invite players below the guild's minimum level

  // Check invitee is not already in a guild
  const inviteeMembership = await prisma.guildMember.findUnique({
    where: { userId: inviteeId },
  });

  if (inviteeMembership) {
    throw new Error(GUILD_ERROR_CODES.USER_ALREADY_IN_GUILD);
  }

  // Check for existing pending invitation
  const existingInvitation = await prisma.guildInvitation.findFirst({
    where: {
      guildId,
      inviteeId,
      status: 'PENDING',
    },
  });

  if (existingInvitation) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_INVITED);
  }

  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + GUILD_CONSTANTS.INVITATION_EXPIRY_HOURS);

  // Create invitation
  const invitation = await prisma.guildInvitation.create({
    data: {
      guildId,
      inviterId,
      inviteeId,
      message: message || null,
      expiresAt,
    },
    include: {
      guild: {
        select: { name: true, tag: true },
      },
      inviter: {
        select: { displayName: true },
      },
      invitee: {
        select: { displayName: true },
      },
    },
  });

  // Send in-app notification
  await createGuildInviteNotification(invitation);

  return invitation;
}

/**
 * Get guild's pending invitations
 */
export async function getGuildInvitations(
  guildId: string,
  status?: GuildInvitationStatus,
  limit = 20,
  offset = 0
): Promise<{ invitations: GuildInvitationWithDetails[]; total: number }> {
  const where = {
    guildId,
    ...(status && { status }),
  };

  const [invitations, total] = await Promise.all([
    prisma.guildInvitation.findMany({
      where,
      include: {
        guild: {
          select: { name: true, tag: true },
        },
        inviter: {
          select: { displayName: true },
        },
        invitee: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildInvitation.count({ where }),
  ]);

  return { invitations, total };
}

/**
 * Get user's received invitations
 */
export async function getUserInvitations(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ invitations: GuildInvitationWithDetails[]; total: number }> {
  const where = {
    inviteeId: userId,
    status: 'PENDING' as const,
    expiresAt: { gt: new Date() },
  };

  const [invitations, total] = await Promise.all([
    prisma.guildInvitation.findMany({
      where,
      include: {
        guild: {
          select: { name: true, tag: true },
        },
        inviter: {
          select: { displayName: true },
        },
        invitee: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildInvitation.count({ where }),
  ]);

  return { invitations, total };
}

/**
 * Get invitation by ID
 */
export async function getInvitation(
  invitationId: string
): Promise<GuildInvitationWithDetails | null> {
  return prisma.guildInvitation.findUnique({
    where: { id: invitationId },
    include: {
      guild: {
        select: { name: true, tag: true },
      },
      inviter: {
        select: { displayName: true },
      },
      invitee: {
        select: { displayName: true },
      },
    },
  });
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const invitation = await prisma.guildInvitation.findUnique({
    where: { id: invitationId },
    include: {
      guild: {
        select: {
          structureKwatera: true,
          disbanded: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (!invitation) {
    throw new Error(GUILD_ERROR_CODES.INVITATION_NOT_FOUND);
  }

  if (invitation.inviteeId !== userId) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
  }

  if (invitation.expiresAt < new Date()) {
    // Update status to expired
    await prisma.guildInvitation.update({
      where: { id: invitationId },
      data: { status: 'EXPIRED' },
    });
    throw new Error(GUILD_ERROR_CODES.INVITATION_EXPIRED);
  }

  if (invitation.guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_DISBANDED);
  }

  // Check user is not already in a guild
  const existingMembership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (existingMembership) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
  }

  // Check guild capacity
  const maxMembers = getMemberCapacity(invitation.guild.structureKwatera);
  if (invitation.guild._count.members >= maxMembers) {
    throw new Error(GUILD_ERROR_CODES.GUILD_FULL);
  }

  // Accept invitation and create membership in transaction
  await prisma.$transaction([
    prisma.guildInvitation.update({
      where: { id: invitationId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
      },
    }),
    prisma.guildMember.create({
      data: {
        guildId: invitation.guildId,
        userId,
        role: 'MEMBER',
      },
    }),
    // Cancel other pending invitations for this user
    prisma.guildInvitation.updateMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
        id: { not: invitationId },
      },
      data: { status: 'CANCELLED' },
    }),
  ]);

  // Broadcast invitation status change so thread views update
  broadcastToUser(userId, {
    type: 'guild:invitation_status',
    data: {
      invitationId,
      status: 'ACCEPTED',
    },
  });
}

/**
 * Decline an invitation
 */
export async function declineInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const invitation = await prisma.guildInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error(GUILD_ERROR_CODES.INVITATION_NOT_FOUND);
  }

  if (invitation.inviteeId !== userId) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
  }

  await prisma.guildInvitation.update({
    where: { id: invitationId },
    data: {
      status: 'DECLINED',
      respondedAt: new Date(),
    },
  });

  // Broadcast invitation status change so thread views update
  broadcastToUser(userId, {
    type: 'guild:invitation_status',
    data: {
      invitationId,
      status: 'DECLINED',
    },
  });
}

/**
 * Cancel an invitation (by inviter)
 */
export async function cancelInvitation(
  invitationId: string,
  userId: string
): Promise<void> {
  const invitation = await prisma.guildInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error(GUILD_ERROR_CODES.INVITATION_NOT_FOUND);
  }

  // Check if user is inviter or has permission in the guild
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  const isInviter = invitation.inviterId === userId;
  const hasGuildPermission = membership &&
    membership.guildId === invitation.guildId &&
    hasPermission(membership.role as GuildRole, 'invite');

  if (!isInviter && !hasGuildPermission) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (invitation.status !== 'PENDING') {
    throw new Error(GUILD_ERROR_CODES.INVITATION_NOT_PENDING);
  }

  await prisma.guildInvitation.update({
    where: { id: invitationId },
    data: {
      status: 'CANCELLED',
      respondedAt: new Date(),
    },
  });
}

/**
 * Expire old invitations (cleanup job)
 */
export async function expireOldInvitations(): Promise<number> {
  const result = await prisma.guildInvitation.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}
