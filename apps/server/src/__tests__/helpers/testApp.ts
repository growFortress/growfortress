/**
 * Test app builder for integration tests
 */
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

// Plugins
import authPlugin from '../../plugins/auth.js';
import errorHandlerPlugin from '../../plugins/errorHandler.js';

// Routes
import healthRoutes from '../../routes/health.js';
import authRoutes from '../../routes/auth.js';
import sessionsRoutes from '../../routes/sessions.js';
import leaderboardRoutes from '../../routes/leaderboard.js';
import upgradesRoutes from '../../routes/upgrades.js';
import materialsRoutes from '../../routes/materials.js';
import artifactsRoutes from '../../routes/artifacts.js';

/**
 * Build a test app with mocked dependencies
 */
export async function buildTestApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false, // Disable logging in tests
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register plugins (skip rate limiting for tests)
  await fastify.register(errorHandlerPlugin);
  await fastify.register(authPlugin);

  // Register routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(sessionsRoutes);
  await fastify.register(leaderboardRoutes);
  await fastify.register(upgradesRoutes);
  await fastify.register(materialsRoutes);
  await fastify.register(artifactsRoutes);

  return fastify;
}

/**
 * Generate a valid JWT token for testing
 */
export async function generateTestToken(userId: string = 'user-123'): Promise<string> {
  const { SignJWT } = await import('jose');
  // Use the same secret format as config.ts
  const secret = new TextEncoder().encode(
    'test-jwt-secret-key-for-testing-purposes-only-minimum-32-chars'
  );

  return new SignJWT({ type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}
