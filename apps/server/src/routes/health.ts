import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import {
  leaderboardQueue,
  cleanupQueue,
  metricsQueue,
  playerLeaderboardQueue,
  guildWeeklyQueue,
} from '../lib/queue.js';
import { getStripe, isStripeConfigured } from '../lib/stripe.js';

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        redis: 'unknown',
        queues: {
          leaderboard: 'unknown',
          cleanup: 'unknown',
          metrics: 'unknown',
          playerLeaderboard: 'unknown',
          guildWeekly: 'unknown',
        },
        downstream: {} as Record<string, string>,
      },
    };

    // Check database
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.services.database = 'ok';
    } catch (error) {
      checks.services.database = 'error';
      checks.status = 'degraded';
    }

    // Check Redis
    try {
      await redis.ping();
      checks.services.redis = 'ok';
    } catch (error) {
      checks.services.redis = 'error';
      checks.status = 'degraded';
    }

    // Check queues (BullMQ)
    const queues = [
      { name: 'leaderboard', queue: leaderboardQueue },
      { name: 'cleanup', queue: cleanupQueue },
      { name: 'metrics', queue: metricsQueue },
      { name: 'playerLeaderboard', queue: playerLeaderboardQueue },
      { name: 'guildWeekly', queue: guildWeeklyQueue },
    ];

    for (const { name, queue } of queues) {
      try {
        // Check if queue can access Redis by getting queue info
        await queue.getJobCounts();
        checks.services.queues[name as keyof typeof checks.services.queues] = 'ok';
      } catch (error) {
        checks.services.queues[name as keyof typeof checks.services.queues] = 'error';
        checks.status = 'degraded';
      }
    }

    // Check downstream services (optional)
    // Stripe (if configured)
    if (isStripeConfigured()) {
      try {
        const stripe = getStripe();
        if (stripe) {
          // Simple API call to verify connectivity
          await stripe.balance.retrieve();
          checks.services.downstream.stripe = 'ok';
        } else {
          checks.services.downstream.stripe = 'not_configured';
        }
      } catch (error) {
        checks.services.downstream.stripe = 'error';
        checks.status = 'degraded';
      }
    }

    const statusCode = checks.status === 'ok' ? 200 : 503;
    return reply.status(statusCode).send(checks);
  });
};

export default healthRoutes;
