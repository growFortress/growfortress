import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { initializeJobs, cleanFailedJobs } from './lib/queue.js';
import { createLeaderboardWorker } from './jobs/leaderboardSnapshot.js';
import { createCleanupWorker } from './jobs/cleanupExpiredRuns.js';
import { createMetricsWorker } from './jobs/metricsJob.js';
import { createWeeklyPlayerResetWorker } from './jobs/weeklyPlayerReset.js';
import { createWeeklyGuildResetWorker } from './jobs/weeklyGuildReset.js';
import { initializeLeaderboardCache } from './services/leaderboard.js';

async function main() {
  console.log('Starting Arcade TD Server...');

  // Build Fastify app
  const app = await buildApp();

  // Initialize job workers
  const leaderboardWorker = createLeaderboardWorker();
  const cleanupWorker = createCleanupWorker();
  const metricsWorker = createMetricsWorker();
  const weeklyPlayerResetWorker = createWeeklyPlayerResetWorker();
  const weeklyGuildResetWorker = createWeeklyGuildResetWorker();

  // Clean old failed jobs from previous runs
  await cleanFailedJobs();

  // Initialize recurring jobs
  await initializeJobs();

  // Initialize leaderboard sorted sets (sync current week from DB)
  await initializeLeaderboardCache();

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');

    await leaderboardWorker.close();
    await cleanupWorker.close();
    await metricsWorker.close();
    await weeklyPlayerResetWorker.close();
    await weeklyGuildResetWorker.close();
    await redis.quit();
    await prisma.$disconnect();
    await app.close();

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Start server
  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });

    console.log(`Server listening on http://localhost:${config.PORT}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
