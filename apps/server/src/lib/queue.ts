import { Queue, Worker, Job } from 'bullmq';
import { redis } from './redis.js';

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

// Job types
export interface LeaderboardSnapshotJob {
  type: 'snapshot';
  weekKey: string;
}

export interface CleanupExpiredRunsJob {
  type: 'cleanup_expired_runs';
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
}

/**
 * Get current week key in ISO format (e.g., "2024-W01")
 */
export function getCurrentWeekKey(): string {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
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
