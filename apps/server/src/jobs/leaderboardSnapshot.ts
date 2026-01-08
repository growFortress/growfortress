import { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getCurrentWeekKey, LeaderboardSnapshotJob, createWorker } from '../lib/queue.js';

/** Redis key prefix for leaderboard snapshots */
const SNAPSHOT_KEY_PREFIX = 'leaderboard:snapshot:';

/** TTL for cached snapshots in seconds (1 hour) */
const SNAPSHOT_TTL_SECONDS = 3600;

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
 */
async function processLeaderboardSnapshot(job: Job<LeaderboardSnapshotJob>): Promise<void> {
  const weekKey = job.data.weekKey || getCurrentWeekKey();

  console.log(`[LeaderboardSnapshot] Processing snapshot for week ${weekKey}`);

  try {
    // Get top entries
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

    // Store snapshot in Redis with TTL
    await redis.setex(
      SNAPSHOT_KEY_PREFIX + weekKey,
      SNAPSHOT_TTL_SECONDS,
      JSON.stringify(snapshot)
    );

    console.log(`[LeaderboardSnapshot] Snapshot completed: ${entries.length} entries cached for ${SNAPSHOT_TTL_SECONDS}s`);
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
