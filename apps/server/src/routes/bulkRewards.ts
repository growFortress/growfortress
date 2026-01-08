import { FastifyPluginAsync } from 'fastify';
import { listAvailableRewards, claimReward } from '../services/bulkRewards.js';

const bulkRewardsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get available rewards for the current player
  fastify.get('/v1/rewards', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rewards = await listAvailableRewards(request.userId);
    return reply.send({ rewards });
  });

  // Claim a reward
  fastify.post('/v1/rewards/:id/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params as { id: string };

    try {
      const result = await claimReward(request.userId, id);
      return reply.send(result);
    } catch (error: any) {
      return reply.status(400).send({ 
        success: false, 
        error: error.message || 'Failed to claim reward' 
      });
    }
  });
};

export default bulkRewardsRoutes;
