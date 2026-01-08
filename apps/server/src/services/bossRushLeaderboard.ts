import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey } from '../lib/queue.js';

const BOSS_RUSH_LEADERBOARD_CACHE_KEY = 'leaderboard:boss_rush:';
const CACHE_TTL = 300; // 5 minutes

export interface BossRushLeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalDamage: number;
  bossesKilled: number;
  createdAt: string;
}

/**
 * Upsert boss rush leaderboard entry
 * Only updates if new total damage is higher
 */
export async function upsertBossRushLeaderboardEntry(
  userId: string,
  sessionId: string,
  totalDamage: bigint,
  bossesKilled: number,
  weekKey: string = getCurrentWeekKey()
): Promise<void> {
  // Check if user already has an entry for this week
  const existing = await prisma.bossRushLeaderboard.findUnique({
    where: {
      weekKey_userId: {
        weekKey,
        userId,
      },
    },
  });

  // Only update if new damage is higher
  if (existing && existing.totalDamage >= totalDamage) {
    return;
  }

  await prisma.bossRushLeaderboard.upsert({
    where: {
      weekKey_userId: {
        weekKey,
        userId,
      },
    },
    update: {
      totalDamage,
      bossesKilled,
      sessionId,
    },
    create: {
      weekKey,
      userId,
      totalDamage,
      bossesKilled,
      sessionId,
    },
  });

  // Invalidate cache
  await redis.del(BOSS_RUSH_LEADERBOARD_CACHE_KEY + weekKey);
}

/**
 * Get weekly boss rush leaderboard
 */
export async function getBossRushLeaderboard(
  weekKey: string = getCurrentWeekKey(),
  limit: number = 10,
  offset: number = 0
): Promise<{
  weekKey: string;
  entries: BossRushLeaderboardEntry[];
  total: number;
}> {
  // Try cache first
  const cacheKey = `${BOSS_RUSH_LEADERBOARD_CACHE_KEY}${weekKey}:${limit}:${offset}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // Get entries from database
  const [entries, total] = await Promise.all([
    prisma.bossRushLeaderboard.findMany({
      where: { weekKey },
      orderBy: { totalDamage: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: { displayName: true },
        },
      },
    }),
    prisma.bossRushLeaderboard.count({ where: { weekKey } }),
  ]);

  const result = {
    weekKey,
    entries: entries.map((entry, index) => ({
      rank: offset + index + 1,
      userId: entry.userId,
      displayName: entry.user.displayName,
      totalDamage: Number(entry.totalDamage),
      bossesKilled: entry.bossesKilled,
      createdAt: entry.createdAt.toISOString(),
    })),
    total,
  };

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

  return result;
}

/**
 * Get user's rank in boss rush leaderboard
 */
export async function getUserBossRushRank(
  userId: string,
  weekKey: string = getCurrentWeekKey()
): Promise<{ rank: number; totalDamage: number } | null> {
  const entry = await prisma.bossRushLeaderboard.findUnique({
    where: {
      weekKey_userId: {
        weekKey,
        userId,
      },
    },
  });

  if (!entry) {
    return null;
  }

  // Count how many entries have higher damage
  const higherDamage = await prisma.bossRushLeaderboard.count({
    where: {
      weekKey,
      totalDamage: { gt: entry.totalDamage },
    },
  });

  return {
    rank: higherDamage + 1,
    totalDamage: Number(entry.totalDamage),
  };
}

/**
 * Get available week keys for boss rush
 */
export async function getBossRushAvailableWeeks(limit = 10): Promise<string[]> {
  const weeks = await prisma.bossRushLeaderboard.findMany({
    distinct: ['weekKey'],
    orderBy: { weekKey: 'desc' },
    take: limit,
    select: { weekKey: true },
  });

  return weeks.map(w => w.weekKey);
}
