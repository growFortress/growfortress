/**
 * Stat Points Routes
 *
 * API endpoints for free stat points system:
 * - GET /v1/stat-points - Get summary
 * - POST /v1/stat-points/allocate - Allocate points
 * - POST /v1/stat-points/reset - Reset allocations
 */

import { FastifyPluginAsync } from 'fastify';
import {
  AllocateStatPointsRequestSchema,
  ResetStatPointsRequestSchema,
} from '@arcade/protocol';
import {
  getStatPointsSummary,
  allocateFortressStatPoints,
  allocateHeroStatPoints,
  resetFortressAllocations,
  resetHeroAllocations,
} from '../services/stat-points.js';

const statPointsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/stat-points
   * Get stat points summary (available points, allocations)
   */
  fastify.get('/v1/stat-points', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const summary = await getStatPointsSummary(request.userId);
    return reply.send(summary);
  });

  /**
   * POST /v1/stat-points/allocate
   * Allocate points to fortress or hero stat
   */
  fastify.post('/v1/stat-points/allocate', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parseResult = AllocateStatPointsRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: parseResult.error.issues,
      });
    }

    const { targetType, heroId, stat, pointsToAllocate } = parseResult.data;

    let result;
    if (targetType === 'fortress') {
      result = await allocateFortressStatPoints(
        request.userId,
        stat,
        pointsToAllocate
      );
    } else if (targetType === 'hero') {
      if (!heroId) {
        return reply.status(400).send({
          error: 'heroId is required for hero stat allocation',
        });
      }
      result = await allocateHeroStatPoints(
        request.userId,
        heroId,
        stat,
        pointsToAllocate
      );
    } else {
      return reply.status(400).send({
        error: 'Invalid target type',
      });
    }

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  /**
   * POST /v1/stat-points/reset
   * Reset allocations and refund points
   */
  fastify.post('/v1/stat-points/reset', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const parseResult = ResetStatPointsRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: parseResult.error.issues,
      });
    }

    const { targetType, heroId } = parseResult.data;

    let result;
    if (targetType === 'fortress') {
      result = await resetFortressAllocations(request.userId);
    } else if (targetType === 'hero') {
      result = await resetHeroAllocations(request.userId, heroId);
    } else {
      return reply.status(400).send({
        error: 'Invalid target type',
      });
    }

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });
};

export default statPointsRoutes;
