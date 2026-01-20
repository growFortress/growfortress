import { FastifyPluginAsync } from 'fastify';
import { getPillarUnlocks } from '../services/pillarUnlocks.js';

const pillarUnlocksRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/pillars/unlocks
   * Get all pillar unlock statuses for the user (level-based)
   */
  fastify.get('/v1/pillars/unlocks', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getPillarUnlocks(request.userId);
    return reply.send(status);
  });
};

export default pillarUnlocksRoutes;
