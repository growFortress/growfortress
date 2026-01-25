/**
 * Expedition Routes
 *
 * API endpoints for the expedition system (offline wave progress).
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  getExpeditionStatus,
  startExpedition,
  claimExpeditionRewards,
  cancelExpedition,
  type LoadoutSnapshot,
} from '../services/expedition.js';

// Start expedition schema
const StartExpeditionSchema = z.object({
  loadout: z.object({
    heroIds: z.array(z.string()),
    turretIds: z.array(z.string()),
    fortressClass: z.string(),
    artifactIds: z.array(z.string()),
  }),
  power: z.number().int().positive(),
  highestWave: z.number().int().nonnegative(),
});

const expeditionRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/expedition/status
   * Get expedition status
   */
  fastify.get('/v1/expedition/status', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const status = await getExpeditionStatus(request.userId);
      return reply.send({ status });
    } catch (error) {
      fastify.log.error(error, 'Error getting expedition status');
      return reply.status(500).send({ error: 'Failed to get expedition status' });
    }
  });

  /**
   * POST /v1/expedition/start
   * Start expedition
   */
  fastify.post('/v1/expedition/start', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parseResult = StartExpeditionSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }

    const { loadout, power, highestWave } = parseResult.data;

    try {
      const status = await startExpedition(
        request.userId,
        loadout as LoadoutSnapshot,
        power,
        highestWave
      );
      return reply.send({ status, message: 'Expedition started' });
    } catch (error) {
      fastify.log.error(error, 'Error starting expedition');
      return reply.status(500).send({ error: 'Failed to start expedition' });
    }
  });

  /**
   * POST /v1/expedition/claim
   * Claim expedition rewards
   */
  fastify.post('/v1/expedition/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const rewards = await claimExpeditionRewards(request.userId);
      return reply.send({ rewards, message: 'Rewards claimed' });
    } catch (error) {
      fastify.log.error(error, 'Error claiming expedition rewards');
      return reply.status(500).send({ error: 'Failed to claim expedition rewards' });
    }
  });

  /**
   * POST /v1/expedition/cancel
   * Cancel expedition
   */
  fastify.post('/v1/expedition/cancel', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      await cancelExpedition(request.userId);
      return reply.send({ message: 'Expedition cancelled' });
    } catch (error) {
      fastify.log.error(error, 'Error cancelling expedition');
      return reply.status(500).send({ error: 'Failed to cancel expedition' });
    }
  });
};

export default expeditionRoutes;
