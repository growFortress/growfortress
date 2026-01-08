import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey } from '../lib/queue.js';

const LEADERBOARD_CACHE_KEY = 'leaderboard:weekly:';
const CACHE_TTL = 300; // 5 minutes

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
  wavesCleared: number;
  createdAt: string;
}

/**
 * Upsert leaderboard entry for a run
 */
export async function upsertLeaderboardEntry(
  userId: string,
  runId: string,
  score: number,
  weekKey: string = getCurrentWeekKey()
): Promise<void> {
  // Check if user already has an entry for this week
  const existing = await prisma.leaderboardEntry.findUnique({
    where: {
      weekKey_userId: {
        weekKey,
        userId,
      },
    },
  });

  // Only update if new score is higher
  if (existing && existing.score >= score) {
    return;
  }

  await prisma.leaderboardEntry.upsert({
    where: {
      weekKey_userId: {
        weekKey,
        userId,
      },
    },
    update: {
      score,
      runId,
    },
    create: {
      weekKey,
      userId,
      score,
      runId,
    },
  });

  // Invalidate cache
  await redis.del(LEADERBOARD_CACHE_KEY + weekKey);
}

/**
 * Get weekly leaderboard
 */
export async function getWeeklyLeaderboard(
  weekKey: string = getCurrentWeekKey(),
  limit: number = 10,
  offset: number = 0
): Promise<{
  weekKey: string;
  entries: LeaderboardEntry[];
  total: number;
}> {
  // Try cache first
  const cacheKey = `${LEADERBOARD_CACHE_KEY}${weekKey}:${limit}:${offset}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  // Get entries from database
  const [entries, total] = await Promise.all([
    prisma.leaderboardEntry.findMany({
      where: { weekKey },
      orderBy: { score: 'desc' },
      skip: offset,
      take: limit,
      include: {
        user: {
          include: {
            runs: {
              where: { verified: true },
              orderBy: { score: 'desc' },
              take: 1,
              select: { summaryJson: true },
            },
          },
        },
      },
    }),
    prisma.leaderboardEntry.count({ where: { weekKey } }),
  ]);

  const result = {
    weekKey,
    entries: entries.map((entry, index) => {
      const summary = entry.user.runs[0]?.summaryJson as { wavesCleared?: number } | null;
      return {
        rank: offset + index + 1,
        userId: entry.userId,
        score: entry.score,
        wavesCleared: summary?.wavesCleared ?? 0,
        createdAt: entry.createdAt.toISOString(),
      };
    }),
    total,
  };

  // Cache result
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));

  return result;
}

/**
 * Get user's rank in leaderboard
 */
export async function getUserRank(
  userId: string,
  weekKey: string = getCurrentWeekKey()
): Promise<{ rank: number; score: number } | null> {
  const entry = await prisma.leaderboardEntry.findUnique({
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

  // Count how many entries have higher score
  const higherScores = await prisma.leaderboardEntry.count({
    where: {
      weekKey,
      score: { gt: entry.score },
    },
  });

  return {
    rank: higherScores + 1,
    score: entry.score,
  };
}

/**
 * Get available week keys
 */
export async function getAvailableWeeks(limit = 10): Promise<string[]> {
  const weeks = await prisma.leaderboardEntry.findMany({
    distinct: ['weekKey'],
    orderBy: { weekKey: 'desc' },
    take: limit,
    select: { weekKey: true },
  });

  return weeks.map(w => w.weekKey);
}
