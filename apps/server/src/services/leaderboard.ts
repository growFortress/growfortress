import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey } from '../lib/queue.js';

const LEADERBOARD_CACHE_KEY = 'leaderboard:weekly:';
const CACHE_TTL = 300; // 5 minutes
const MAX_CACHED_ENTRIES = 100; // Cache top 100, paginate in memory

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
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

  // Invalidate cache (use :full suffix to match new cache key format)
  await redis.del(`${LEADERBOARD_CACHE_KEY}${weekKey}:full`);
}

/**
 * Get weekly leaderboard
 * Uses a single cache key per week (top 100), then paginates in memory
 * This prevents cache key explosion from offset-based keys
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
  // Single cache key per week (no offset/limit in key)
  const cacheKey = `${LEADERBOARD_CACHE_KEY}${weekKey}:full`;
  const cached = await redis.get(cacheKey);

  let allEntries: LeaderboardEntry[];
  let total: number;

  if (cached) {
    const parsedCache = JSON.parse(cached) as { entries: LeaderboardEntry[]; total: number };
    allEntries = parsedCache.entries;
    total = parsedCache.total;
  } else {
    // Get top entries from database with user display names (no N+1)
    const [dbEntries, count] = await Promise.all([
      prisma.leaderboardEntry.findMany({
        where: { weekKey },
        orderBy: { score: 'desc' },
        take: MAX_CACHED_ENTRIES,
        select: {
          userId: true,
          score: true,
          createdAt: true,
          runId: true,
          user: {
            select: { displayName: true },
          },
        },
      }),
      prisma.leaderboardEntry.count({ where: { weekKey } }),
    ]);

    // Batch fetch run summaries (single query instead of N+1)
    // Skip query if no entries to avoid unnecessary database round-trip
    const runIds = dbEntries.map(e => e.runId);
    const runs = runIds.length > 0
      ? await prisma.run.findMany({
          where: { id: { in: runIds } },
          select: { id: true, summaryJson: true },
        })
      : [];
    const runMap = new Map(runs.map(r => [r.id, r.summaryJson]));

    allEntries = dbEntries.map((entry, index) => {
      const summary = runMap.get(entry.runId) as { wavesCleared?: number } | null;
      return {
        rank: index + 1,
        userId: entry.userId,
        displayName: entry.user.displayName,
        score: entry.score,
        wavesCleared: summary?.wavesCleared ?? 0,
        createdAt: entry.createdAt.toISOString(),
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
