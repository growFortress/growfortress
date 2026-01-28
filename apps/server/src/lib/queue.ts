import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis.js';
import {
  getCurrentWeekKey as getWeekKeyFromUtils,
  getPreviousWeekKey as getPrevWeekKeyFromUtils,
} from './weekUtils.js';

// Queue definitions
export const leaderboardQueue = new Queue('leaderboard', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export const cleanupQueue = new Queue('cleanup', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export const metricsQueue = new Queue('metrics', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 100,
  },
});

export const playerLeaderboardQueue = new Queue('player-leaderboard', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 50,
  },
});

export const guildWeeklyQueue = new Queue('guild-weekly', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 50,
  },
});

// Job types
export interface LeaderboardSnapshotJob {
  type: 'snapshot';
  weekKey: string;
}

export interface CleanupExpiredRunsJob {
  type: 'cleanup_expired_runs';
}

export interface PlayerLeaderboardResetJob {
  type: 'weekly_reset';
  weekKey: string; // The week that just ended
}

export interface GuildWeeklyResetJob {
  type: 'guild_weekly_reset';
  weekKey: string; // The week that just ended
}

// Initialize recurring jobs
export async function initializeJobs(): Promise<void> {
  // Leaderboard snapshot for previous week (historical data only)
  // Current week uses real-time sorted sets, so we only snapshot completed weeks
  await leaderboardQueue.add(
    'snapshot',
    { type: 'snapshot', weekKey: getPreviousWeekKey() },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour - creates historical snapshots
      },
    }
  );

  // Cleanup expired runs every 5 minutes
  await cleanupQueue.add(
    'cleanup',
    { type: 'cleanup_expired_runs' },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
    }
  );

  // Take metric snapshots every 1 minute
  await metricsQueue.add(
    'take_snapshot',
    {},
    {
      repeat: {
        pattern: '* * * * *', // Every minute
      },
    }
  );

  // Weekly player leaderboard reset - every Monday at 00:00 UTC
  await playerLeaderboardQueue.add(
    'weekly_reset',
    { type: 'weekly_reset', weekKey: getPreviousWeekKey() },
    {
      repeat: {
        pattern: '0 0 * * 1', // Monday 00:00 UTC
        tz: 'UTC',
      },
    }
  );

  // Weekly guild reset - every Monday at 00:05 UTC (5 min after player reset)
  await guildWeeklyQueue.add(
    'guild_weekly_reset',
    { type: 'guild_weekly_reset', weekKey: getPreviousWeekKey() },
    {
      repeat: {
        pattern: '5 0 * * 1', // Monday 00:05 UTC
        tz: 'UTC',
      },
    }
  );
}

/**
 * Get current week key in ISO format (e.g., "2024-W01")
 * Uses centralized weekUtils for consistent calculation
 */
export function getCurrentWeekKey(): string {
  return getWeekKeyFromUtils();
}

/**
 * Get previous week key (the week before current)
 * Uses centralized weekUtils for consistent calculation
 */
export function getPreviousWeekKey(): string {
  return getPrevWeekKeyFromUtils();
}

/**
 * Create worker for a queue
 */
export function createWorker<T>(
  queueName: string,
  processor: (job: Job<T>) => Promise<void>
): Worker<T> {
  return new Worker<T>(queueName, processor, {
    connection: redis,
  });
}

/**
 * Clean failed jobs from all queues
 * @param gracePeriodMs - Only clean jobs older than this (default: 0 = all failed jobs)
 */
export async function cleanFailedJobs(gracePeriodMs: number = 0): Promise<number> {
  const queues = [
    leaderboardQueue,
    cleanupQueue,
    metricsQueue,
    playerLeaderboardQueue,
    guildWeeklyQueue,
  ];

  let totalCleaned = 0;
  for (const queue of queues) {
    const cleaned = await queue.clean(gracePeriodMs, 1000, 'failed');
    totalCleaned += cleaned.length;
  }

  console.log(`[Queue] Cleaned ${totalCleaned} failed jobs from all queues`);
  return totalCleaned;
}

/**
 * Get queue metrics for all queues
 */
export async function getQueueMetrics() {
  const queues = [
    { name: 'leaderboard', queue: leaderboardQueue },
    { name: 'cleanup', queue: cleanupQueue },
    { name: 'metrics', queue: metricsQueue },
    { name: 'player-leaderboard', queue: playerLeaderboardQueue },
    { name: 'guild-weekly', queue: guildWeeklyQueue },
  ];

  const metrics = await Promise.all(
    queues.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return {
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + delayed,
      };
    })
  );

  // Calculate totals
  const totals = metrics.reduce(
    (acc, m) => ({
      waiting: acc.waiting + m.waiting,
      active: acc.active + m.active,
      completed: acc.completed + m.completed,
      failed: acc.failed + m.failed,
      delayed: acc.delayed + m.delayed,
      total: acc.total + m.total,
    }),
    { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, total: 0 }
  );

  return {
    queues: metrics,
    totals,
  };
}
