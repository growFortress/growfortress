import { FastifyPluginAsync } from 'fastify';
import {
  calculatePendingIdleRewards,
  claimIdleRewards,
  getIdleRewardsConfig,
  upgradeColony,
} from '../services/idleRewards.js';
import { prisma } from '../lib/prisma.js';

const idleRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/idle/pending
   * Get pending idle rewards without claiming
   */
  fastify.get('/v1/idle/pending', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const pending = await calculatePendingIdleRewards(request.userId);

    if (!pending) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(pending);
  });

  /**
   * POST /v1/idle/claim
   * Claim all pending idle rewards
   */
  fastify.post('/v1/idle/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimIdleRewards(request.userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });

  /**
   * GET /v1/idle/config
   * Get idle rewards configuration for the user's commander level
   */
  fastify.get('/v1/idle/config', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const progression = await prisma.progression.findUnique({
      where: { userId: request.userId },
      select: { level: true },
    });

    if (!progression) {
      return reply.status(404).send({ error: 'Progression not found' });
    }

    const config = getIdleRewardsConfig(progression.level);

    return reply.send({
      commanderLevel: progression.level,
      ...config,
    });
  });

  /**
   * POST /v1/idle/colony/upgrade
   * Upgrade a colony building to increase gold production
   */
  fastify.post<{ Body: { colonyId: string } }>('/v1/idle/colony/upgrade', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { colonyId } = request.body;

    if (!colonyId || typeof colonyId !== 'string') {
      return reply.status(400).send({ error: 'Colony ID is required' });
    }

    const result = await upgradeColony(request.userId, colonyId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });
};

export default idleRoutes;
