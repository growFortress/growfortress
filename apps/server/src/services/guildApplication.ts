import { prisma } from '../lib/prisma.js';
import {
  GUILD_CONSTANTS,
  GUILD_ERROR_CODES,
  type GuildRole,
  type GuildSettings,
  type GuildApplicationStatus,
  type GuildAccessMode,
} from '@arcade/protocol';
import { hasPermission } from './guild.js';
import { getMemberCapacity } from './guildStructures.js';
import { invalidateGuildPreviewCache } from './guildPreview.js';
import type { GuildApplication } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface GuildApplicationWithDetails extends GuildApplication {
  guild: {
    name: string;
    tag: string;
  };
  applicant: {
    displayName: string;
    highestWave: number;
    powerUpgrades: { cachedTotalPower: number } | null;
  };
  responder: {
    displayName: string;
  } | null;
}

// ============================================================================
// APPLICATION MANAGEMENT
// ============================================================================

/**
 * Create a guild application
 */
export async function createApplication(
  guildId: string,
  applicantId: string,
  message?: string
): Promise<GuildApplicationWithDetails> {
  // Check applicant is not already in a guild
  const applicantMembership = await prisma.guildMember.findUnique({
    where: { userId: applicantId },
  });

  if (applicantMembership) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
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

  // Check guild access mode allows applications
  const guildSettings = guild.settings as GuildSettings | null;
  const accessMode = (guildSettings?.accessMode ?? 'INVITE_ONLY') as GuildAccessMode;

  if (accessMode === 'CLOSED') {
    throw new Error(GUILD_ERROR_CODES.GUILD_CLOSED);
  }

  if (accessMode !== 'APPLY') {
    throw new Error(GUILD_ERROR_CODES.GUILD_NOT_ACCEPTING_APPLICATIONS);
  }

  // Check guild capacity
  const maxMembers = getMemberCapacity(guild.structureKwatera);
  if (guild._count.members >= maxMembers) {
    throw new Error(GUILD_ERROR_CODES.GUILD_FULL);
  }

  // Check applicant exists and meets minLevel requirement
  const applicant = await prisma.user.findUnique({
    where: { id: applicantId },
    select: {
      id: true,
      highestWave: true,
    },
  });

  if (!applicant) {
    throw new Error(GUILD_ERROR_CODES.USER_NOT_FOUND);
  }

  const minLevel = guildSettings?.minLevel ?? 1;
  const applicantLevel = applicant.highestWave ?? 0;

  if (applicantLevel < minLevel) {
    throw new Error(GUILD_ERROR_CODES.LEVEL_TOO_LOW);
  }

  // Check for existing pending application to this guild
  const existingApplication = await prisma.guildApplication.findFirst({
    where: {
      guildId,
      applicantId,
      status: 'PENDING',
    },
  });

  if (existingApplication) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_APPLIED);
  }

  // Check applicant doesn't have too many active applications
  const activeApplicationsCount = await prisma.guildApplication.count({
    where: {
      applicantId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });

  if (activeApplicationsCount >= GUILD_CONSTANTS.MAX_ACTIVE_APPLICATIONS_PER_PLAYER) {
    throw new Error(GUILD_ERROR_CODES.MAX_APPLICATIONS_REACHED);
  }

  // Calculate expiry time
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + GUILD_CONSTANTS.APPLICATION_EXPIRY_HOURS);

  // Create application
  const application = await prisma.guildApplication.create({
    data: {
      guildId,
      applicantId,
      message: message || null,
      expiresAt,
    },
    include: {
      guild: {
        select: { name: true, tag: true },
      },
      applicant: {
        select: {
          displayName: true,
          highestWave: true,
          powerUpgrades: { select: { cachedTotalPower: true } },
        },
      },
      responder: {
        select: { displayName: true },
      },
    },
  });

  return application;
}

/**
 * Get guild's applications (for officers/leader review)
 */
export async function getGuildApplications(
  guildId: string,
  status?: GuildApplicationStatus,
  limit = 20,
  offset = 0
): Promise<{ applications: GuildApplicationWithDetails[]; total: number }> {
  const where = {
    guildId,
    ...(status && { status }),
  };

  const [applications, total] = await Promise.all([
    prisma.guildApplication.findMany({
      where,
      include: {
        guild: {
          select: { name: true, tag: true },
        },
        applicant: {
          select: {
            displayName: true,
            highestWave: true,
            powerUpgrades: { select: { cachedTotalPower: true } },
          },
        },
        responder: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildApplication.count({ where }),
  ]);

  return { applications, total };
}

/**
 * Get user's sent applications
 */
export async function getUserApplications(
  userId: string,
  limit = 20,
  offset = 0
): Promise<{ applications: GuildApplicationWithDetails[]; total: number }> {
  const where = {
    applicantId: userId,
    status: 'PENDING' as const,
    expiresAt: { gt: new Date() },
  };

  const [applications, total] = await Promise.all([
    prisma.guildApplication.findMany({
      where,
      include: {
        guild: {
          select: { name: true, tag: true },
        },
        applicant: {
          select: {
            displayName: true,
            highestWave: true,
            powerUpgrades: { select: { cachedTotalPower: true } },
          },
        },
        responder: {
          select: { displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guildApplication.count({ where }),
  ]);

  return { applications, total };
}

/**
 * Get application by ID
 */
export async function getApplication(
  applicationId: string
): Promise<GuildApplicationWithDetails | null> {
  return prisma.guildApplication.findUnique({
    where: { id: applicationId },
    include: {
      guild: {
        select: { name: true, tag: true },
      },
      applicant: {
        select: {
          displayName: true,
          highestWave: true,
          powerUpgrades: { select: { cachedTotalPower: true } },
        },
      },
      responder: {
        select: { displayName: true },
      },
    },
  });
}

/**
 * Accept an application (by officer/leader)
 */
export async function acceptApplication(
  applicationId: string,
  responderId: string
): Promise<void> {
  const application = await prisma.guildApplication.findUnique({
    where: { id: applicationId },
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

  if (!application) {
    throw new Error(GUILD_ERROR_CODES.APPLICATION_NOT_FOUND);
  }

  // Check responder has permission
  const responderMembership = await prisma.guildMember.findUnique({
    where: { userId: responderId },
  });

  if (!responderMembership || responderMembership.guildId !== application.guildId) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (!hasPermission(responderMembership.role as GuildRole, 'invite')) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (application.status !== 'PENDING') {
    throw new Error(GUILD_ERROR_CODES.APPLICATION_NOT_PENDING);
  }

  if (application.expiresAt < new Date()) {
    // Update status to expired
    await prisma.guildApplication.update({
      where: { id: applicationId },
      data: { status: 'EXPIRED' },
    });
    throw new Error(GUILD_ERROR_CODES.APPLICATION_EXPIRED);
  }

  if (application.guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_DISBANDED);
  }

  // Check applicant is not already in a guild
  const existingMembership = await prisma.guildMember.findUnique({
    where: { userId: application.applicantId },
  });

  if (existingMembership) {
    throw new Error(GUILD_ERROR_CODES.USER_ALREADY_IN_GUILD);
  }

  // Check guild capacity
  const maxMembers = getMemberCapacity(application.guild.structureKwatera);
  if (application.guild._count.members >= maxMembers) {
    throw new Error(GUILD_ERROR_CODES.GUILD_FULL);
  }

  // Accept application and create membership in transaction
  await prisma.$transaction([
    prisma.guildApplication.update({
      where: { id: applicationId },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        respondedBy: responderId,
      },
    }),
    prisma.guildMember.create({
      data: {
        guildId: application.guildId,
        userId: application.applicantId,
        role: 'MEMBER',
      },
    }),
    // Cancel other pending applications for this user
    prisma.guildApplication.updateMany({
      where: {
        applicantId: application.applicantId,
        status: 'PENDING',
        id: { not: applicationId },
      },
      data: { status: 'CANCELLED' },
    }),
    // Cancel pending invitations for this user
    prisma.guildInvitation.updateMany({
      where: {
        inviteeId: application.applicantId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    }),
  ]);

  // Invalidate cache - member count changed
  await invalidateGuildPreviewCache(application.guildId);
}

/**
 * Decline an application (by officer/leader)
 */
export async function declineApplication(
  applicationId: string,
  responderId: string
): Promise<void> {
  const application = await prisma.guildApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error(GUILD_ERROR_CODES.APPLICATION_NOT_FOUND);
  }

  // Check responder has permission
  const responderMembership = await prisma.guildMember.findUnique({
    where: { userId: responderId },
  });

  if (!responderMembership || responderMembership.guildId !== application.guildId) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (!hasPermission(responderMembership.role as GuildRole, 'invite')) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (application.status !== 'PENDING') {
    throw new Error(GUILD_ERROR_CODES.APPLICATION_NOT_PENDING);
  }

  await prisma.guildApplication.update({
    where: { id: applicationId },
    data: {
      status: 'DECLINED',
      respondedAt: new Date(),
      respondedBy: responderId,
    },
  });
}

/**
 * Cancel own application
 */
export async function cancelApplication(
  applicationId: string,
  userId: string
): Promise<void> {
  const application = await prisma.guildApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new Error(GUILD_ERROR_CODES.APPLICATION_NOT_FOUND);
  }

  if (application.applicantId !== userId) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  if (application.status !== 'PENDING') {
    throw new Error(GUILD_ERROR_CODES.APPLICATION_NOT_PENDING);
  }

  await prisma.guildApplication.update({
    where: { id: applicationId },
    data: {
      status: 'CANCELLED',
      respondedAt: new Date(),
    },
  });
}

/**
 * Expire old applications (cleanup job)
 */
export async function expireOldApplications(): Promise<number> {
  const result = await prisma.guildApplication.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}
