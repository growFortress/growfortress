/**
 * Guild Preview Service
 * Fetches public guild data for viewing other guilds' information
 */

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import {
  GUILD_LEVEL_TABLE,
  GUILD_CONSTANTS,
  type GuildPreviewResponse,
  type GuildPreviewBonuses,
  type GuildPreviewMember,
  type GuildTechLevels,
  type GuildRole,
} from '@arcade/protocol';

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
      level: true,
      xp: true,
      totalXp: true,
      honor: true,
      techLevels: true,
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

  // Get level info for calculating XP to next level
  const currentLevelData = GUILD_LEVEL_TABLE.find(l => l.level === guild.level);
  const nextLevelData = GUILD_LEVEL_TABLE.find(l => l.level === guild.level + 1);
  const xpToNextLevel = nextLevelData
    ? Math.max(0, nextLevelData.xpRequired - guild.totalXp)
    : 0;
  const maxMembers = currentLevelData?.memberCap ?? 10;

  // Parse tech levels
  const techLevels = (guild.techLevels as GuildTechLevels) ?? {
    fortress: { hp: 0, damage: 0, regen: 0 },
    hero: { hp: 0, damage: 0, cooldown: 0 },
    turret: { damage: 0, speed: 0, range: 0 },
    economy: { gold: 0, dust: 0, xp: 0 },
  };

  // Calculate bonuses from tech levels (2% per level)
  const bonusPerLevel = GUILD_CONSTANTS.TECH_BONUS_PER_LEVEL;
  const bonuses: GuildPreviewBonuses = {
    // Economy bonuses from guild level
    goldPercent: currentLevelData?.goldBoost ?? 0,
    dustPercent: currentLevelData?.dustBoost ?? 0,
    xpPercent: currentLevelData?.xpBoost ?? 0,
    // Fortress bonuses from tech tree
    fortressHpPercent: techLevels.fortress.hp * bonusPerLevel,
    fortressDamagePercent: techLevels.fortress.damage * bonusPerLevel,
    fortressRegenPercent: techLevels.fortress.regen * bonusPerLevel,
    // Hero bonuses from tech tree
    heroHpPercent: techLevels.hero.hp * bonusPerLevel,
    heroDamagePercent: techLevels.hero.damage * bonusPerLevel,
    heroCooldownPercent: techLevels.hero.cooldown * bonusPerLevel,
    // Turret bonuses from tech tree
    turretDamagePercent: techLevels.turret.damage * bonusPerLevel,
    turretSpeedPercent: techLevels.turret.speed * bonusPerLevel,
    turretRangePercent: techLevels.turret.range * bonusPerLevel,
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
    level: guild.level,
    xp: guild.xp,
    xpToNextLevel,
    honor: guild.honor,
    memberCount: guild._count.members,
    maxMembers,
    trophies: (guild.trophies as string[]) ?? [],
    techLevels,
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
 * Call this when guild is updated (level up, tech upgrade, member changes, etc.)
 */
export async function invalidateGuildPreviewCache(guildId: string): Promise<void> {
  await redis.del(`${CACHE_KEY_PREFIX}${guildId}`);
}
