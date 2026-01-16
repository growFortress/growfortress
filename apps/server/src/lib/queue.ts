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
  // Leaderboard snapshot every hour
  await leaderboardQueue.add(
    'snapshot',
    { type: 'snapshot', weekKey: getCurrentWeekKey() },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour
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
