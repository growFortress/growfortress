import rateLimit from '@fastify/rate-limit';
import { FastifyPluginAsync, RouteShorthandOptions } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';
import { redis } from '../lib/redis.js';

/**
 * Per-endpoint rate limit configurations
 * More restrictive limits for sensitive operations
 */
export const RATE_LIMITS = {
  // Authentication - very strict to prevent brute force
  auth: { max: 5, timeWindow: 60000 },  // 5 req/min
  
  // Password Reset - very strict
  passwordReset: { max: 3, timeWindow: 3600000 }, // 3 req/hour

  // Run operations - moderate limits
  runStart: { max: 20, timeWindow: 60000 },  // 20 req/min
  runFinish: { max: 40, timeWindow: 60000 }, // 40 req/min

  // Session operations
  session: { max: 60, timeWindow: 60000 },   // 60 req/min

  // Read-heavy operations - more permissive
  leaderboard: { max: 120, timeWindow: 60000 }, // 120 req/min
  profile: { max: 120, timeWindow: 60000 },     // 120 req/min

  // Guild operations - strict limits to prevent abuse
  guildCreate: { max: 3, timeWindow: 3600000 },     // 3 req/hour (guild creation)
  guildBattle: { max: 20, timeWindow: 60000 },      // 20 req/min (battles)
  guildShield: { max: 10, timeWindow: 60000 },      // 10 req/min (shield activation)
  guildInvite: { max: 40, timeWindow: 60000 },      // 40 req/min (invitations)
  guildApply: { max: 10, timeWindow: 60000 },       // 10 req/min (applications)
  guildManage: { max: 30, timeWindow: 60000 },      // 30 req/min (management actions)
  guildRead: { max: 120, timeWindow: 60000 },       // 120 req/min (read operations)

  // Default for other endpoints
  default: { max: 200, timeWindow: 60000 },
} as const;

/**
 * Create route config with specific rate limit
 */
export function withRateLimit(
  limitType: keyof typeof RATE_LIMITS = 'default',
  additionalConfig: RouteShorthandOptions = {}
): RouteShorthandOptions {
  const limit = RATE_LIMITS[limitType];
  return {
    ...additionalConfig,
    config: {
      ...additionalConfig.config,
      rateLimit: {
        max: limit.max,
        timeWindow: limit.timeWindow,
      },
    },
  };
}

const rateLimitPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    redis,
    keyGenerator: (request) => {
      // Use userId if authenticated, otherwise IP
      return request.userId || request.ip;
    },
    // Add rate limit info to response headers
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });
};

export default fp(rateLimitPlugin, {
  name: 'rateLimit',
  dependencies: ['auth'],
});
