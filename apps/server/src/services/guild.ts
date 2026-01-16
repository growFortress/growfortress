import { prisma } from '../lib/prisma.js';
import {
  GUILD_LEVEL_TABLE,
  GUILD_ERROR_CODES,
  type GuildRole,
  type GuildSettings,
  type GuildAccessMode,
} from '@arcade/protocol';
import { createGuildKickNotification } from './messages.js';
import type { Guild, GuildMember, Prisma } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface GuildWithDetails extends Guild {
  members: (GuildMember & { user: { displayName: string } })[];
  _count: { members: number };
}

export interface GuildMemberWithGuild extends GuildMember {
  guild: Guild;
  user: { displayName: string };
}

export interface GuildBonuses {
  goldBoost: number;
  statBoost: number;
  xpBoost: number;
}

export interface CreateGuildInput {
  name: string;
  tag: string;
  description?: string;
  settings?: Partial<GuildSettings>;
}

export interface UpdateGuildInput {
  name?: string;
  description?: string;
  settings?: Partial<GuildSettings>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get level info for a guild level
 */
export function getLevelInfo(level: number) {
  const levelData = GUILD_LEVEL_TABLE.find(l => l.level === level);
  if (!levelData) {
    return GUILD_LEVEL_TABLE[GUILD_LEVEL_TABLE.length - 1];
  }
  return levelData;
}

/**
 * Get member capacity for a guild level
 */
export function getMemberCapacity(level: number): number {
  return getLevelInfo(level).memberCap;
}

/**
 * Get bonuses for a guild level
 */
export function getGuildBonuses(level: number): GuildBonuses {
  const levelData = getLevelInfo(level);
  return {
    goldBoost: levelData.goldBoost,
    statBoost: levelData.statBoost,
    xpBoost: levelData.xpBoost,
  };
}

// Cache for user guild bonuses (TTL: 60 seconds)
const userGuildBonusesCache = new Map<string, { bonuses: GuildBonuses | null; expiry: number }>();

/**
 * Get guild bonuses for a user (cached for 60 seconds)
 * Used during reward calculation to avoid N+1 queries
 */
export async function getUserGuildBonuses(userId: string): Promise<GuildBonuses | null> {
  const now = Date.now();
  const cached = userGuildBonusesCache.get(userId);

  if (cached && cached.expiry > now) {
    return cached.bonuses;
  }

  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: { guild: { select: { level: true, disbanded: true } } },
  });

  if (!membership || membership.guild.disbanded) {
    userGuildBonusesCache.set(userId, { bonuses: null, expiry: now + 60_000 });
    return null;
  }

  const bonuses = getGuildBonuses(membership.guild.level);
  userGuildBonusesCache.set(userId, { bonuses, expiry: now + 60_000 });
  return bonuses;
}

/**
 * Invalidate guild bonuses cache for a user
 * Call this when user joins/leaves guild or guild levels up
 */
export function invalidateUserGuildBonusesCache(userId: string): void {
  userGuildBonusesCache.delete(userId);
}

/**
 * Check if user has permission for an action based on role
 */
export function hasPermission(
  role: GuildRole,
  action: 'manage' | 'invite' | 'kick' | 'battle' | 'withdraw'
): boolean {
  switch (action) {
    case 'manage':
      return role === 'LEADER';
    case 'withdraw':
      return role === 'LEADER';
    case 'invite':
    case 'kick':
    case 'battle':
      return role === 'LEADER' || role === 'OFFICER';
    default:
      return false;
  }
}

// ============================================================================
// GUILD CRUD
// ============================================================================

/**
 * Create a new guild
 */
export async function createGuild(
  userId: string,
  input: CreateGuildInput
): Promise<GuildWithDetails> {
  // Check if user is already in a guild
  const existingMembership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (existingMembership) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
  }

  // Check if name is taken
  const existingName = await prisma.guild.findUnique({
    where: { name: input.name },
  });

  if (existingName) {
    throw new Error(GUILD_ERROR_CODES.NAME_TAKEN);
  }

  // Check if tag is taken
  const existingTag = await prisma.guild.findUnique({
    where: { tag: input.tag.toUpperCase() },
  });

  if (existingTag) {
    throw new Error(GUILD_ERROR_CODES.TAG_TAKEN);
  }

  // Create guild with leader in a transaction
  const guild = await prisma.$transaction(async (tx) => {
    // Build settings object
    const settings = {
      minLevel: input.settings?.minLevel ?? 1,
      autoAcceptInvites: false,
      battleCooldownHours: 24,
      accessMode: input.settings?.accessMode ?? 'INVITE_ONLY',
    };

    // Create the guild
    const newGuild = await tx.guild.create({
      data: {
        name: input.name,
        tag: input.tag.toUpperCase(),
        description: input.description || '',
        settings,
      },
    });

    // Create the leader membership
    await tx.guildMember.create({
      data: {
        guildId: newGuild.id,
        userId,
        role: 'LEADER',
      },
    });

    // Create empty treasury
    await tx.guildTreasury.create({
      data: {
        guildId: newGuild.id,
      },
    });

    return newGuild;
  });

  // Return guild with details
  return getGuild(guild.id) as Promise<GuildWithDetails>;
}

/**
 * Get guild by ID with details
 */
export async function getGuild(guildId: string): Promise<GuildWithDetails | null> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: {
      members: {
        include: {
          user: {
            select: { displayName: true },
          },
        },
        orderBy: [
          { role: 'asc' }, // LEADER first
          { joinedAt: 'asc' },
        ],
      },
      _count: {
        select: { members: true },
      },
    },
  });

  if (!guild || guild.disbanded) {
    return null;
  }

  return guild;
}

/**
 * Update guild settings
 */
export async function updateGuild(
  guildId: string,
  userId: string,
  input: UpdateGuildInput
): Promise<Guild> {
  // Check permissions
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership || membership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (!hasPermission(membership.role as GuildRole, 'manage')) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Build update data
  const updateData: Prisma.GuildUpdateInput = {};

  if (input.name) {
    // Check if name is taken
    const existingName = await prisma.guild.findFirst({
      where: { name: input.name, id: { not: guildId } },
    });
    if (existingName) {
      throw new Error(GUILD_ERROR_CODES.NAME_TAKEN);
    }
    updateData.name = input.name;
  }

  if (input.description !== undefined) {
    updateData.description = input.description;
  }

  if (input.settings) {
    const currentGuild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { settings: true },
    });
    const currentSettings = currentGuild?.settings as GuildSettings || {};
    updateData.settings = { ...currentSettings, ...input.settings };
  }

  return prisma.guild.update({
    where: { id: guildId },
    data: updateData,
  });
}

/**
 * Disband a guild (soft delete)
 */
export async function disbandGuild(guildId: string, userId: string): Promise<void> {
  // Check permissions
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership || membership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (membership.role !== 'LEADER') {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  await prisma.$transaction(async (tx) => {
    // Mark guild as disbanded
    await tx.guild.update({
      where: { id: guildId },
      data: { disbanded: true },
    });

    // Remove all members
    await tx.guildMember.deleteMany({
      where: { guildId },
    });

    // Cancel pending invitations
    await tx.guildInvitation.updateMany({
      where: { guildId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    // NOTE: Battles are now instant (no pending state) - no need to cancel
  });
}

/**
 * Search guilds
 */
export async function searchGuilds(
  search?: string,
  limit = 20,
  offset = 0
): Promise<{ guilds: Guild[]; total: number }> {
  const where: Prisma.GuildWhereInput = {
    disbanded: false,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { tag: { contains: search.toUpperCase(), mode: 'insensitive' } },
    ];
  }

  const [guilds, total] = await Promise.all([
    prisma.guild.findMany({
      where,
      orderBy: { honor: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.guild.count({ where }),
  ]);

  return { guilds, total };
}

// ============================================================================
// MEMBERSHIP
// ============================================================================

/**
 * Get user's guild membership
 */
export async function getUserGuild(userId: string): Promise<GuildMemberWithGuild | null> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
    include: {
      guild: true,
      user: {
        select: { displayName: true },
      },
    },
  });

  if (!membership || membership.guild.disbanded) {
    return null;
  }

  return membership;
}

/**
 * Join a guild (via invitation)
 */
export async function joinGuild(
  guildId: string,
  userId: string,
  invitationId?: string
): Promise<GuildMember> {
  // Check if user is already in a guild
  const existingMembership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (existingMembership) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
  }

  // Get guild and check capacity
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { _count: { select: { members: true } } },
  });

  if (!guild || guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
  }

  const maxMembers = getMemberCapacity(guild.level);
  if (guild._count.members >= maxMembers) {
    throw new Error(GUILD_ERROR_CODES.GUILD_FULL);
  }

  // Create membership
  return prisma.$transaction(async (tx) => {
    // Update invitation if provided
    if (invitationId) {
      await tx.guildInvitation.update({
        where: { id: invitationId },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });
    }

    return tx.guildMember.create({
      data: {
        guildId,
        userId,
        role: 'MEMBER',
      },
    });
  });
}

/**
 * Direct join for OPEN guilds (no invitation needed)
 */
export async function joinGuildDirect(
  guildId: string,
  userId: string
): Promise<GuildMember> {
  // Check if user is already in a guild
  const existingMembership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (existingMembership) {
    throw new Error(GUILD_ERROR_CODES.ALREADY_IN_GUILD);
  }

  // Get guild and check access mode
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
    include: { _count: { select: { members: true } } },
  });

  if (!guild || guild.disbanded) {
    throw new Error(GUILD_ERROR_CODES.GUILD_NOT_FOUND);
  }

  // Check access mode is OPEN
  const guildSettings = guild.settings as GuildSettings | null;
  const accessMode = (guildSettings?.accessMode ?? 'INVITE_ONLY') as GuildAccessMode;

  if (accessMode === 'CLOSED') {
    throw new Error(GUILD_ERROR_CODES.GUILD_CLOSED);
  }

  if (accessMode !== 'OPEN') {
    throw new Error(GUILD_ERROR_CODES.GUILD_NOT_ACCEPTING_DIRECT_JOIN);
  }

  // Check guild capacity
  const maxMembers = getMemberCapacity(guild.level);
  if (guild._count.members >= maxMembers) {
    throw new Error(GUILD_ERROR_CODES.GUILD_FULL);
  }

  // Check user meets minLevel requirement
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { highestWave: true },
  });

  if (!user) {
    throw new Error(GUILD_ERROR_CODES.USER_NOT_FOUND);
  }

  const minLevel = guildSettings?.minLevel ?? 1;
  const userLevel = user.highestWave ?? 0;

  if (userLevel < minLevel) {
    throw new Error(GUILD_ERROR_CODES.LEVEL_TOO_LOW);
  }

  // Create membership and cancel pending applications/invitations
  return prisma.$transaction(async (tx) => {
    // Cancel pending applications for this user
    await tx.guildApplication.updateMany({
      where: {
        applicantId: userId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    // Cancel pending invitations for this user
    await tx.guildInvitation.updateMany({
      where: {
        inviteeId: userId,
        status: 'PENDING',
      },
      data: { status: 'CANCELLED' },
    });

    return tx.guildMember.create({
      data: {
        guildId,
        userId,
        role: 'MEMBER',
      },
    });
  });
}

/**
 * Leave a guild
 */
export async function leaveGuild(guildId: string, userId: string): Promise<void> {
  const membership = await prisma.guildMember.findUnique({
    where: { userId },
  });

  if (!membership || membership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (membership.role === 'LEADER') {
    throw new Error(GUILD_ERROR_CODES.CANNOT_LEAVE_AS_LEADER);
  }

  await prisma.guildMember.delete({
    where: { userId },
  });
}

/**
 * Kick a member from guild
 */
export async function kickMember(
  guildId: string,
  actorId: string,
  targetUserId: string
): Promise<void> {
  // Check actor permissions
  const actorMembership = await prisma.guildMember.findUnique({
    where: { userId: actorId },
  });

  if (!actorMembership || actorMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (!hasPermission(actorMembership.role as GuildRole, 'kick')) {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Check target
  const targetMembership = await prisma.guildMember.findUnique({
    where: { userId: targetUserId },
  });

  if (!targetMembership || targetMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.TARGET_NOT_IN_GUILD);
  }

  if (targetMembership.role === 'LEADER') {
    throw new Error(GUILD_ERROR_CODES.CANNOT_KICK_LEADER);
  }

  // Officers can only kick members, not other officers
  if (actorMembership.role === 'OFFICER' && targetMembership.role === 'OFFICER') {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Get guild name and actor display name for notification
  const [guild, actor] = await Promise.all([
    prisma.guild.findUnique({
      where: { id: guildId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: actorId },
      select: { displayName: true },
    }),
  ]);

  await prisma.guildMember.delete({
    where: { userId: targetUserId },
  });

  // Send kick notification
  if (guild && actor) {
    await createGuildKickNotification(
      targetUserId,
      guildId,
      guild.name,
      actorId,
      actor.displayName
    );
  }
}

/**
 * Update member role
 */
export async function updateMemberRole(
  guildId: string,
  actorId: string,
  targetUserId: string,
  newRole: 'OFFICER' | 'MEMBER'
): Promise<GuildMember> {
  // Check actor permissions
  const actorMembership = await prisma.guildMember.findUnique({
    where: { userId: actorId },
  });

  if (!actorMembership || actorMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (actorMembership.role !== 'LEADER') {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Check target
  const targetMembership = await prisma.guildMember.findUnique({
    where: { userId: targetUserId },
  });

  if (!targetMembership || targetMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.TARGET_NOT_IN_GUILD);
  }

  if (targetMembership.role === 'LEADER') {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  return prisma.guildMember.update({
    where: { userId: targetUserId },
    data: { role: newRole },
  });
}

/**
 * Transfer leadership to another member
 */
export async function transferLeadership(
  guildId: string,
  leaderId: string,
  newLeaderId: string
): Promise<void> {
  // Check current leader
  const leaderMembership = await prisma.guildMember.findUnique({
    where: { userId: leaderId },
  });

  if (!leaderMembership || leaderMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.NOT_IN_GUILD);
  }

  if (leaderMembership.role !== 'LEADER') {
    throw new Error(GUILD_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

  // Check new leader
  const newLeaderMembership = await prisma.guildMember.findUnique({
    where: { userId: newLeaderId },
  });

  if (!newLeaderMembership || newLeaderMembership.guildId !== guildId) {
    throw new Error(GUILD_ERROR_CODES.TARGET_NOT_IN_GUILD);
  }

  // Transfer in transaction
  await prisma.$transaction([
    prisma.guildMember.update({
      where: { userId: leaderId },
      data: { role: 'OFFICER' },
    }),
    prisma.guildMember.update({
      where: { userId: newLeaderId },
      data: { role: 'LEADER' },
    }),
  ]);
}

/**
 * Get guild's total power (sum of all members' power)
 */
export async function getGuildPower(guildId: string): Promise<number> {
  const members = await prisma.guildMember.findMany({
    where: { guildId },
    include: {
      user: {
        include: {
          powerUpgrades: {
            select: { cachedTotalPower: true },
          },
        },
      },
    },
  });

  return members.reduce((sum, member) => {
    return sum + (member.user.powerUpgrades?.cachedTotalPower || 0);
  }, 0);
}
