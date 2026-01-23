import { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey, LeaderboardSnapshotJob, createWorker } from '../lib/queue.js';

/** Redis key prefix for leaderboard snapshots */
const SNAPSHOT_KEY_PREFIX = 'leaderboard:snapshot:';

/** Maximum number of top entries to include in snapshot */
const TOP_ENTRIES_LIMIT = 100;

/** Snapshot entry structure */
interface LeaderboardSnapshotEntry {
  rank: number;
  userId: string;
  score: number;
  createdAt: string;
}

/** Full snapshot structure stored in Redis */
interface LeaderboardSnapshot {
  weekKey: string;
  generatedAt: string;
  entries: LeaderboardSnapshotEntry[];
}

/**
 * Process leaderboard snapshot job
 * Creates historical snapshots only (not for current week - that uses real-time sorted sets)
 */
async function processLeaderboardSnapshot(job: Job<LeaderboardSnapshotJob>): Promise<void> {
  const weekKey = job.data.weekKey || getCurrentWeekKey();
  const currentWeekKey = getCurrentWeekKey();

  // Skip snapshot for current week - it uses real-time sorted sets
  if (weekKey === currentWeekKey) {
    console.log(`[LeaderboardSnapshot] Skipping snapshot for current week ${weekKey} (using real-time sorted sets)`);
    return;
  }

  console.log(`[LeaderboardSnapshot] Processing historical snapshot for week ${weekKey}`);

  try {
    // Get top entries from database (historical data)
    const entries = await prisma.leaderboardEntry.findMany({
      where: { weekKey },
      orderBy: { score: 'desc' },
      take: TOP_ENTRIES_LIMIT,
      select: {
        userId: true,
        score: true,
        createdAt: true,
      },
    });

    if (entries.length === 0) {
      console.warn(`[LeaderboardSnapshot] No entries found for week ${weekKey}`);
      return;
    }

    // Build typed snapshot object
    const snapshot: LeaderboardSnapshot = {
      weekKey,
      generatedAt: new Date().toISOString(),
      entries: entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        score: entry.score,
        createdAt: entry.createdAt.toISOString(),
      })),
    };

    // Store snapshot in Redis with longer TTL for historical data (7 days)
    const historicalTtl = 7 * 24 * 3600; // 7 days
    await redis.setex(
      SNAPSHOT_KEY_PREFIX + weekKey,
      historicalTtl,
      JSON.stringify(snapshot)
    );

    console.log(`[LeaderboardSnapshot] Historical snapshot completed: ${entries.length} entries cached for ${historicalTtl}s`);
  } catch (error) {
    console.error(`[LeaderboardSnapshot] Job failed for week ${weekKey}:`, error);
    throw error; // Re-throw so BullMQ knows job failed and can retry
  }
}

/**
 * Create leaderboard snapshot worker
 */
export function createLeaderboardWorker() {
  return createWorker<LeaderboardSnapshotJob>('leaderboard', processLeaderboardSnapshot);
}
