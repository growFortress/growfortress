import { FastifyPluginAsync } from 'fastify';
import { getPillarUnlocks, unlockPillar } from '../services/pillarUnlocks.js';
import { PillarUnlockIdSchema } from '@arcade/protocol';

const pillarUnlocksRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/pillars/unlocks
   * Get all pillar unlock statuses for the user
   */
  fastify.get('/v1/pillars/unlocks', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getPillarUnlocks(request.userId);
    return reply.send(status);
  });

  /**
   * POST /v1/pillars/:pillarId/unlock
   * Unlock a specific pillar using dust
   */
  fastify.post<{ Params: { pillarId: string } }>(
    '/v1/pillars/:pillarId/unlock',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate pillar ID
      const validation = PillarUnlockIdSchema.safeParse(request.params.pillarId);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid pillar ID' });
      }

      const result = await unlockPillar(request.userId, validation.data);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    }
  );
};

export default pillarUnlocksRoutes;
