import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey } from '../lib/queue.js';
import { distributeRewards } from './guildTreasury.js';
import { awardChampionsTrophy } from './guildProgression.js';
import type { GuildLeaderboardEntry } from '@arcade/protocol';

// ============================================================================
// CONSTANTS
// ============================================================================

const GUILD_LEADERBOARD_CACHE_KEY = 'leaderboard:guild:';
const CACHE_TTL = 300; // 5 minutes
const MAX_CACHED_ENTRIES = 100;

// Weekly rewards by rank (dust reduced by 50%)
const WEEKLY_REWARDS = [
  { rank: 1, gold: 50000, dust: 500 },   // Reduced from 1000
  { rank: 2, gold: 30000, dust: 300 },   // Reduced from 600
  { rank: 3, gold: 20000, dust: 200 },   // Reduced from 400
  { rank: 10, gold: 10000, dust: 100 },  // Reduced from 200 (4-10)
  { rank: 25, gold: 5000, dust: 50 },    // Reduced from 100 (11-25)
] as const;

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardResult {
  weekKey: string;
  entries: GuildLeaderboardEntry[];
  total: number;
}

export interface MemberContribution {
  userId: string;
  displayName: string;
  xpContributed: number;
  goldDonated: number;
  dustDonated: number;
  battlesParticipated: number;
  battlesWon: number;
}

// ============================================================================
// LEADERBOARD FUNCTIONS
// ============================================================================

/**
 * Get weekly guild leaderboard
 */
export async function getWeeklyLeaderboard(
  weekKey: string = getCurrentWeekKey(),
  limit = 20,
  offset = 0
): Promise<LeaderboardResult> {
  const cacheKey = `${GUILD_LEADERBOARD_CACHE_KEY}${weekKey}:full`;
  const cached = await redis.get(cacheKey);

  let allEntries: GuildLeaderboardEntry[];
  let total: number;

  if (cached) {
    const parsedCache = JSON.parse(cached) as { entries: GuildLeaderboardEntry[]; total: number };
    allEntries = parsedCache.entries;
    total = parsedCache.total;
  } else {
    // Get guilds ordered by honor (live ranking)
    const [guilds, count] = await Promise.all([
      prisma.guild.findMany({
        where: { disbanded: false },
        orderBy: { honor: 'desc' },
        take: MAX_CACHED_ENTRIES,
        include: {
          _count: { select: { members: true } },
        },
      }),
      prisma.guild.count({ where: { disbanded: false } }),
    ]);

    // Count battles for each guild
    const guildIds = guilds.map(g => g.id);
    const battleStats = await prisma.guildBattle.groupBy({
      by: ['attackerGuildId', 'defenderGuildId', 'winnerGuildId'],
      where: {
        status: 'RESOLVED',
        OR: [
          { attackerGuildId: { in: guildIds } },
          { defenderGuildId: { in: guildIds } },
        ],
      },
    });

    // Aggregate battle stats per guild
    const guildBattleStats = new Map<string, { won: number; lost: number }>();
    for (const guildId of guildIds) {
      guildBattleStats.set(guildId, { won: 0, lost: 0 });
    }

    for (const stat of battleStats) {
      if (stat.winnerGuildId) {
        const winner = guildBattleStats.get(stat.winnerGuildId);
        if (winner) winner.won++;

        const loserId = stat.attackerGuildId === stat.winnerGuildId
          ? stat.defenderGuildId
          : stat.attackerGuildId;
        const loser = guildBattleStats.get(loserId);
        if (loser) loser.lost++;
      }
    }

    allEntries = guilds.map((guild, index) => {
      const stats = guildBattleStats.get(guild.id) || { won: 0, lost: 0 };
      return {
        rank: index + 1,
        guildId: guild.id,
        guildName: guild.name,
        guildTag: guild.tag,
        level: guild.level,
        honor: guild.honor,
        totalScore: guild.totalXp,
        battlesWon: stats.won,
        battlesLost: stats.lost,
        memberCount: guild._count.members,
      };
    });

    total = count;

    // Cache full result
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify({ entries: allEntries, total }));
  }

  // Paginate in memory
  const paginatedEntries = allEntries.slice(offset, offset + limit).map((entry, index) => ({
    ...entry,
    rank: offset + index + 1,
  }));

  return {
    weekKey,
    entries: paginatedEntries,
    total,
  };
}

/**
 * Get guild's rank
 */
export async function getGuildRank(
  guildId: string,
  _weekKey: string = getCurrentWeekKey()
): Promise<{ rank: number; honor: number } | null> {
  const guild = await prisma.guild.findUnique({
    where: { id: guildId },
  });

  if (!guild || guild.disbanded) {
    return null;
  }

  // Count guilds with higher honor
  const higherHonorCount = await prisma.guild.count({
    where: {
      disbanded: false,
      honor: { gt: guild.honor },
    },
  });

  return {
    rank: higherHonorCount + 1,
    honor: guild.honor,
  };
}

/**
 * Get member contributions for a guild
 */
export async function getMemberContributions(
  guildId: string,
  _weekKey: string = getCurrentWeekKey()
): Promise<MemberContribution[]> {
  const members = await prisma.guildMember.findMany({
    where: { guildId },
    include: {
      user: {
        select: { displayName: true },
      },
    },
    orderBy: { weeklyXpContributed: 'desc' },
  });

  return members.map(member => ({
    userId: member.userId,
    displayName: member.user.displayName,
    xpContributed: member.weeklyXpContributed,
    goldDonated: member.totalGoldDonated,
    dustDonated: member.totalDustDonated,
    battlesParticipated: member.battlesParticipated,
    battlesWon: member.battlesWon,
  }));
}

/**
 * Snapshot weekly rankings (end-of-week job)
 */
export async function snapshotWeeklyRankings(weekKey: string): Promise<void> {
  const guilds = await prisma.guild.findMany({
    where: { disbanded: false },
    include: {
      _count: { select: { members: true } },
    },
  });

  // Get battle stats
  const battleStats = await prisma.guildBattle.groupBy({
    by: ['winnerGuildId'],
    where: {
      status: 'RESOLVED',
    },
    _count: true,
  });

  const battleWinsMap = new Map<string, number>();
  for (const stat of battleStats) {
    if (stat.winnerGuildId) {
      battleWinsMap.set(stat.winnerGuildId, stat._count);
    }
  }

  // Create leaderboard entries
  for (const guild of guilds) {
    const battlesWon = battleWinsMap.get(guild.id) || 0;
    const battlesLost = await prisma.guildBattle.count({
      where: {
        status: 'RESOLVED',
        OR: [
          { attackerGuildId: guild.id, winnerGuildId: { not: guild.id } },
          { defenderGuildId: guild.id, winnerGuildId: { not: guild.id } },
        ],
      },
    });

    await prisma.guildLeaderboardEntry.upsert({
      where: {
        weekKey_guildId: {
          weekKey,
          guildId: guild.id,
        },
      },
      update: {
        honor: guild.honor,
        totalScore: guild.totalXp,
        battlesWon,
        battlesLost,
        memberCount: guild._count.members,
      },
      create: {
        weekKey,
        guildId: guild.id,
        honor: guild.honor,
        totalScore: guild.totalXp,
        battlesWon,
        battlesLost,
        memberCount: guild._count.members,
      },
    });
  }
}

/**
 * Distribute weekly rewards (end-of-week job)
 */
export async function distributeWeeklyRewards(weekKey: string): Promise<void> {
  // Get leaderboard for the week
  const leaderboard = await getWeeklyLeaderboard(weekKey, 100, 0);

  for (const entry of leaderboard.entries) {
    // Find applicable reward tier
    let reward = WEEKLY_REWARDS[WEEKLY_REWARDS.length - 1]; // Default to lowest tier

    for (const tier of WEEKLY_REWARDS) {
      if (entry.rank <= tier.rank) {
        reward = tier;
        break;
      }
    }

    // Skip if rank is too low for rewards
    if (entry.rank > 25) {
      continue;
    }

    // Distribute rewards to treasury
    await distributeRewards(
      entry.guildId,
      { gold: reward.gold, dust: reward.dust },
      `Weekly leaderboard reward (Rank #${entry.rank})`
    );

    // Award champions trophy for top 10
    if (entry.rank <= 10) {
      await awardChampionsTrophy(entry.guildId);
    }
  }
}

/**
 * Invalidate leaderboard cache
 */
export async function invalidateLeaderboardCache(weekKey: string = getCurrentWeekKey()): Promise<void> {
  const cacheKey = `${GUILD_LEADERBOARD_CACHE_KEY}${weekKey}:full`;
  await redis.del(cacheKey);
}

/**
 * Get available week keys
 */
export async function getAvailableWeeks(limit = 10): Promise<string[]> {
  const weeks = await prisma.guildLeaderboardEntry.findMany({
    distinct: ['weekKey'],
    orderBy: { weekKey: 'desc' },
    take: limit,
    select: { weekKey: true },
  });

  return weeks.map(w => w.weekKey);
}
