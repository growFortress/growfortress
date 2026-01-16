/**
 * Guild Preview Service
 * Fetches public guild data for viewing other guilds' information
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import {
  type GuildPreviewResponse,
  type GuildPreviewBonuses,
  type GuildPreviewMember,
  type GuildRole,
} from '@arcade/protocol';
import {
  getMemberCapacity,
  getGoldBonus,
  getXpBonus,
  getStatBonus,
} from './guildStructures.js';

// Cache configuration
const CACHE_KEY_PREFIX = 'guild:preview:';
const CACHE_TTL = 300; // 5 minutes

/**
 * Get guild preview for a specific guild
 * Returns null if guild doesn't exist or is disbanded
 */
export async function getGuildPreview(guildId: string): Promise<GuildPreviewResponse | null> {
  // Check cache first
  const cacheKey = `${CACHE_KEY_PREFIX}${guildId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GuildPreviewResponse;
  }

  // Fetch guild with members (top 5 by role priority and power)
  const guild = await prisma.guild.findUnique({
    where: { id: guildId, disbanded: false },
    select: {
      id: true,
      name: true,
      tag: true,
      description: true,
      honor: true,
      structureKwatera: true,
      structureSkarbiec: true,
      structureAkademia: true,
      structureZbrojownia: true,
      trophies: true,
      createdAt: true,
      members: {
        select: {
          userId: true,
          role: true,
          user: {
            select: {
              displayName: true,
              progression: {
                select: { level: true },
              },
              powerUpgrades: {
                select: { cachedTotalPower: true },
              },
            },
          },
        },
        orderBy: [
          { role: 'asc' }, // LEADER first, then OFFICER, then MEMBER
          { joinedAt: 'asc' },
        ],
      },
      _count: {
        select: { members: true },
      },
    },
  });

  if (!guild) {
    return null;
  }

  // Get max members from Kwatera structure level
  const maxMembers = getMemberCapacity(guild.structureKwatera);

  // Calculate bonuses from structure levels
  const bonuses: GuildPreviewBonuses = {
    goldBoost: getGoldBonus(guild.structureSkarbiec),
    xpBoost: getXpBonus(guild.structureAkademia),
    statBoost: getStatBonus(guild.structureZbrojownia),
  };

  // Build top 5 members sorted by role priority (LEADER > OFFICER > MEMBER) then power
  const sortedMembers = [...guild.members]
    .map(m => ({
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role as GuildRole,
      level: m.user.progression?.level ?? 1,
      power: m.user.powerUpgrades?.cachedTotalPower ?? 0,
    }))
    .sort((a, b) => {
      // Sort by role first (LEADER=0, OFFICER=1, MEMBER=2)
      const roleOrder = { LEADER: 0, OFFICER: 1, MEMBER: 2 };
      const roleDiff = roleOrder[a.role] - roleOrder[b.role];
      if (roleDiff !== 0) return roleDiff;
      // Then by power descending
      return b.power - a.power;
    })
    .slice(0, 5);

  const topMembers: GuildPreviewMember[] = sortedMembers;

  // Build response
  const response: GuildPreviewResponse = {
    guildId: guild.id,
    name: guild.name,
    tag: guild.tag,
    description: guild.description,
    honor: guild.honor,
    memberCount: guild._count.members,
    maxMembers,
    trophies: (guild.trophies as string[]) ?? [],
    structures: {
      kwatera: guild.structureKwatera,
      skarbiec: guild.structureSkarbiec,
      akademia: guild.structureAkademia,
      zbrojownia: guild.structureZbrojownia,
    },
    bonuses,
    topMembers,
    createdAt: guild.createdAt.toISOString(),
  };

  // Cache the result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(response));

  return response;
}

/**
 * Invalidate guild preview cache
 * Call this when guild is updated (structure upgrade, member changes, etc.)
 */
export async function invalidateGuildPreviewCache(guildId: string): Promise<void> {
  await redis.del(`${CACHE_KEY_PREFIX}${guildId}`);
}
