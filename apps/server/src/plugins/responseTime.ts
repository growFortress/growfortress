import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';

// Store response times in memory (circular buffer)
const responseTimes: number[] = [];
const MAX_SAMPLES = 1000; // Keep last 1000 response times

/**
 * Middleware to track response times for all requests
 */
const responseTimePlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    // Store start time in request context
    (request as any).startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = (request as any).startTime;
    if (startTime) {
      const responseTime = Date.now() - startTime;
      
      // Store response time (circular buffer)
      responseTimes.push(responseTime);
      if (responseTimes.length > MAX_SAMPLES) {
        responseTimes.shift();
      }

      // Add response time header for debugging
      reply.header('X-Response-Time', `${responseTime}ms`);
    }
  });
};

/**
 * Get response time statistics
 */
export function getResponseTimeStats() {
  if (responseTimes.length === 0) {
    return {
      count: 0,
      avg: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0,
    };
  }

  const sorted = [...responseTimes].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / count;
  const p50 = sorted[Math.floor(count * 0.5)];
  const p95 = sorted[Math.floor(count * 0.95)];
  const p99 = sorted[Math.floor(count * 0.99)];
  const max = sorted[count - 1];

  return { count, avg, p50, p95, p99, max };
}

export default fp(responseTimePlugin, {
  name: 'responseTime',
});
