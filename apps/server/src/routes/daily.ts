import { FastifyPluginAsync } from 'fastify';
import {
  getDailyLoginStatus,
  claimDailyReward,
} from '../services/dailyLogin.js';

/**
 * Daily Login Routes
 *
 * GET  /v1/daily/status - Get daily login status and rewards
 * POST /v1/daily/claim  - Claim today's daily reward
 */

const dailyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/daily/status
   * Get daily login status including current day, streak, and available rewards
   */
  fastify.get('/v1/daily/status', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getDailyLoginStatus(request.userId);

    if (!status) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(status);
  });

  /**
   * POST /v1/daily/claim
   * Claim today's daily login reward
   */
  fastify.post('/v1/daily/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimDailyReward(request.userId);

    if (!result.success) {
      // Map error codes to HTTP status codes
      if (result.error === 'ALREADY_CLAIMED_TODAY') {
        return reply.status(400).send({
          error: result.error,
          message: 'You have already claimed your daily reward today',
        });
      }
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });
};

export default dailyRoutes;
