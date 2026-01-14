/**
 * Mastery System API Routes
 *
 * Endpoints for mastery progress, node unlocking, and respec
 */

import { FastifyPluginAsync } from 'fastify';
import {
  UnlockMasteryNodeRequestSchema,
  RespecMasteryTreeRequestSchema,
  FortressClassSchema,
} from '@arcade/protocol';
import { MASTERY_TREES } from '@arcade/sim-core';
import {
  getMasteryProgress,
  unlockMasteryNode,
  respecMasteryTree,
  getClassProgressSummaries,
} from '../services/mastery.js';

const masteryRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // GET /v1/mastery - Get player's mastery progress
  // ============================================================================
  fastify.get('/v1/mastery', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const progress = await getMasteryProgress(request.userId);

    return reply.send({ progress });
  });

  // ============================================================================
  // POST /v1/mastery/unlock - Unlock a mastery node
  // ============================================================================
  fastify.post('/v1/mastery/unlock', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UnlockMasteryNodeRequestSchema.parse(request.body);
    } catch {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await unlockMasteryNode(request.userId, body.nodeId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        progress: result.progress,
        message: result.message,
      });
    }

    return reply.send(result);
  });

  // ============================================================================
  // POST /v1/mastery/respec - Reset a class mastery tree (with penalty)
  // ============================================================================
  fastify.post('/v1/mastery/respec', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = RespecMasteryTreeRequestSchema.parse(request.body);
    } catch {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    // Validate class
    const parseResult = FortressClassSchema.safeParse(body.class);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Invalid class' });
    }

    const result = await respecMasteryTree(request.userId, parseResult.data);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        progress: result.progress,
        pointsReturned: result.pointsReturned,
        pointsLost: result.pointsLost,
        message: result.message,
      });
    }

    return reply.send(result);
  });

  // ============================================================================
  // GET /v1/mastery/trees - Get all mastery tree definitions (static, cacheable)
  // ============================================================================
  fastify.get('/v1/mastery/trees', async (_request, reply) => {
    // This is static data - can be cached heavily
    reply.header('Cache-Control', 'public, max-age=3600'); // 1 hour cache

    return reply.send({ trees: MASTERY_TREES });
  });

  // ============================================================================
  // GET /v1/mastery/summaries - Get class progress summaries for UI
  // ============================================================================
  fastify.get('/v1/mastery/summaries', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await getClassProgressSummaries(request.userId);

    return reply.send(result);
  });
};

export default masteryRoutes;
