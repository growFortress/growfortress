import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';

// Plugins
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rateLimit.js';
import errorHandlerPlugin from './plugins/errorHandler.js';

// Routes
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import runsRoutes from './routes/runs.js';
import sessionsRoutes from './routes/sessions.js';
import leaderboardRoutes from './routes/leaderboard.js';
import telemetryRoutes from './routes/telemetry.js';
import upgradesRoutes from './routes/upgrades.js';
import materialsRoutes from './routes/materials.js';
import artifactsRoutes from './routes/artifacts.js';
import powerUpgradesRoutes from './routes/power-upgrades.js';
import heroesRoutes from './routes/heroes.js';
import idleRoutes from './routes/idle.js';
import bulkRewardsRoutes from './routes/bulkRewards.js';
import bossRushRoutes from './routes/boss-rush.js';
import pvpRoutes from './routes/pvp.js';
import { adminRoutes } from './routes/admin.js';
import { bugReportRoutes } from './routes/bugReports.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'development' ? 'debug' : 'info',
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register plugins
  await fastify.register(errorHandlerPlugin);
  await fastify.register(authPlugin);
  await fastify.register(rateLimitPlugin);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(runsRoutes);
  await fastify.register(sessionsRoutes);
  await fastify.register(leaderboardRoutes);
  await fastify.register(telemetryRoutes);
  await fastify.register(upgradesRoutes);
  await fastify.register(materialsRoutes);
  await fastify.register(artifactsRoutes);
  await fastify.register(powerUpgradesRoutes);
  await fastify.register(heroesRoutes);
  await fastify.register(idleRoutes);
  await fastify.register(bulkRewardsRoutes);
  await fastify.register(bossRushRoutes);
  await fastify.register(pvpRoutes);
  await fastify.register(bugReportRoutes);

  // Admin routes (separate auth system)
  await fastify.register(adminRoutes, { prefix: '/admin' });

  return fastify;
}
