import rateLimit from '@fastify/rate-limit';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';
import { redis } from '../lib/redis.js';

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
  });
};

export default fp(rateLimitPlugin, {
  name: 'rateLimit',
  dependencies: ['auth'],
});
