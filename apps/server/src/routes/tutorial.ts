import { FastifyPluginAsync } from 'fastify';
import {
  getTutorialStatus,
  completeTutorial,
} from '../services/tutorial.js';

/**
 * Tutorial Routes
 *
 * GET  /v1/tutorial/status   - Get tutorial completion status
 * POST /v1/tutorial/complete - Mark tutorial as completed
 */

const tutorialRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/tutorial/status
   * Get tutorial completion status
   */
  fastify.get('/v1/tutorial/status', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getTutorialStatus(request.userId);

    if (!status) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(status);
  });

  /**
   * POST /v1/tutorial/complete
   * Mark tutorial as completed (called when all 17 steps are done)
   */
  fastify.post('/v1/tutorial/complete', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await completeTutorial(request.userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });
};

export default tutorialRoutes;
