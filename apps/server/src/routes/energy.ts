import { FastifyPluginAsync } from 'fastify';
import { getEnergyStatus, refillEnergy } from '../services/energy.js';

const energyRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/energy
   * Get current energy status with regeneration info
   */
  fastify.get('/v1/energy', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getEnergyStatus(request.userId);
    return reply.send(status);
  });

  /**
   * POST /v1/energy/refill
   * Refill energy to maximum using dust
   */
  fastify.post('/v1/energy/refill', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await refillEnergy(request.userId);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });
};

export default energyRoutes;
