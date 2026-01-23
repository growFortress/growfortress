import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey } from '../lib/queue.js';

const LEADERBOARD_CACHE_KEY = 'leaderboard:weekly:';
const LEADERBOARD_ZSET_KEY = 'leaderboard:zset:'; // Redis sorted set key prefix
const MAX_CACHED_ENTRIES = 100; // Cache top 100, paginate in memory
const METADATA_CACHE_TTL = 3600; // 1 hour for user metadata cache

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
 * Uses Redis sorted set for real-time updates
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

  // Update database
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

  // Update Redis sorted set in real-time (score as sorted set score, userId as member)
  const zsetKey = `${LEADERBOARD_ZSET_KEY}${weekKey}`;
  await redis.zadd(zsetKey, score, userId);

  // Invalidate metadata cache (user display names, run summaries)
  await redis.del(`${LEADERBOARD_CACHE_KEY}${weekKey}:metadata`);
}

/**
 * Sync sorted set from database (fallback when sorted set is missing)
 */
async function syncSortedSetFromDb(weekKey: string): Promise<void> {
  const zsetKey = `${LEADERBOARD_ZSET_KEY}${weekKey}`;
  
  // Get all entries from database
  const entries = await prisma.leaderboardEntry.findMany({
    where: { weekKey },
    select: {
      userId: true,
      score: true,
    },
  });

  if (entries.length === 0) {
    return;
  }

  // Batch add to sorted set using pipeline for efficiency
  const pipeline = redis.pipeline();
  entries.forEach(entry => {
    pipeline.zadd(zsetKey, entry.score, entry.userId);
  });
  await pipeline.exec();
}

/**
 * Get user metadata (display names, run summaries) with caching
 */
async function getUserMetadata(
  userIds: string[],
  weekKey: string
): Promise<Map<string, { displayName: string; wavesCleared: number; createdAt: string }>> {
  const metadataKey = `${LEADERBOARD_CACHE_KEY}${weekKey}:metadata`;
  const cached = await redis.get(metadataKey);

  if (cached) {
    const metadata = JSON.parse(cached) as Record<string, { displayName: string; wavesCleared: number; createdAt: string }>;
    return new Map(Object.entries(metadata));
  }

  // Fetch from database
  const entries = await prisma.leaderboardEntry.findMany({
    where: {
      weekKey,
      userId: { in: userIds },
    },
    select: {
      userId: true,
      createdAt: true,
      runId: true,
      user: {
        select: { displayName: true },
      },
    },
  });

  // Batch fetch run summaries
  const runIds = entries.map(e => e.runId);
  const runs = runIds.length > 0
    ? await prisma.run.findMany({
        where: { id: { in: runIds } },
        select: { id: true, summaryJson: true },
      })
    : [];
  const runMap = new Map(runs.map(r => [r.id, r.summaryJson]));

  const metadata = new Map<string, { displayName: string; wavesCleared: number; createdAt: string }>();
  entries.forEach(entry => {
    const summary = runMap.get(entry.runId) as { wavesCleared?: number } | null;
    metadata.set(entry.userId, {
      displayName: entry.user.displayName,
      wavesCleared: summary?.wavesCleared ?? 0,
      createdAt: entry.createdAt.toISOString(),
    });
  });

  // Cache metadata
  const metadataObj = Object.fromEntries(metadata);
  await redis.setex(metadataKey, METADATA_CACHE_TTL, JSON.stringify(metadataObj));

  return metadata;
}

/**
 * Get weekly leaderboard
 * Uses Redis sorted sets for real-time ranking with metadata caching
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
  const zsetKey = `${LEADERBOARD_ZSET_KEY}${weekKey}`;

  // Check if sorted set exists, sync from DB if missing
  const exists = await redis.exists(zsetKey);
  if (!exists) {
    await syncSortedSetFromDb(weekKey);
  }

  // Get total count from sorted set
  const total = await redis.zcard(zsetKey);

  // Get top entries from sorted set (descending order by score)
  // Fetch enough entries to cover offset + limit
  const maxRange = Math.min(offset + limit, MAX_CACHED_ENTRIES) - 1; // -1 because Redis range is inclusive
  const userIdsWithScores = await redis.zrevrange(zsetKey, 0, maxRange, 'WITHSCORES');

  // Parse userIds and scores from Redis response
  const userIds: string[] = [];
  const scoreMap = new Map<string, number>();
  
  for (let i = 0; i < userIdsWithScores.length; i += 2) {
    const userId = userIdsWithScores[i];
    const score = parseFloat(userIdsWithScores[i + 1]);
    userIds.push(userId);
    scoreMap.set(userId, score);
  }

  if (userIds.length === 0) {
    return {
      weekKey,
      entries: [],
      total: 0,
    };
  }

  // Get user metadata (display names, run summaries)
  const metadata = await getUserMetadata(userIds, weekKey);

  // Build entries with pagination
  const allEntries: LeaderboardEntry[] = userIds.map((userId, index) => {
    const meta = metadata.get(userId);
    return {
      rank: index + 1,
      userId,
      displayName: meta?.displayName ?? 'Unknown',
      score: scoreMap.get(userId) ?? 0,
      wavesCleared: meta?.wavesCleared ?? 0,
      createdAt: meta?.createdAt ?? new Date().toISOString(),
    };
  });

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
 * Uses Redis sorted set for O(log N) rank lookup
 */
export async function getUserRank(
  userId: string,
  weekKey: string = getCurrentWeekKey()
): Promise<{ rank: number; score: number } | null> {
  const zsetKey = `${LEADERBOARD_ZSET_KEY}${weekKey}`;

  // Check if sorted set exists, sync from DB if missing
  const exists = await redis.exists(zsetKey);
  if (!exists) {
    await syncSortedSetFromDb(weekKey);
  }

  // Get user's score from sorted set
  const score = await redis.zscore(zsetKey, userId);
  if (score === null) {
    // User not in sorted set, check database
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

    // Add to sorted set for future queries
    await redis.zadd(zsetKey, entry.score, userId);
    
    // Get rank (0-indexed, so add 1)
    const rank = await redis.zrevrank(zsetKey, userId);
    return {
      rank: rank !== null ? rank + 1 : 1,
      score: entry.score,
    };
  }

  // Get rank from sorted set (0-indexed, so add 1)
  const rank = await redis.zrevrank(zsetKey, userId);
  if (rank === null) {
    return null;
  }

  return {
    rank: rank + 1,
    score: parseFloat(score),
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

/**
 * Initialize leaderboard sorted sets on server startup
 * Syncs current week's sorted set from database to ensure consistency
 */
export async function initializeLeaderboardCache(): Promise<void> {
  const currentWeekKey = getCurrentWeekKey();
  const zsetKey = `${LEADERBOARD_ZSET_KEY}${currentWeekKey}`;

  console.log(`[Leaderboard] Initializing sorted set for current week: ${currentWeekKey}`);

  // Check if sorted set already exists
  const exists = await redis.exists(zsetKey);
  if (exists) {
    const count = await redis.zcard(zsetKey);
    console.log(`[Leaderboard] Sorted set already exists with ${count} entries`);
    return;
  }

  // Sync from database
  await syncSortedSetFromDb(currentWeekKey);
  const count = await redis.zcard(zsetKey);
  console.log(`[Leaderboard] Initialized sorted set with ${count} entries`);
}
