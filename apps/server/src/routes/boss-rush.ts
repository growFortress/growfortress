import { FastifyPluginAsync } from 'fastify';
import {
  BossRushStartRequestSchema,
  BossRushFinishRequestSchema,
  BossRushLeaderboardQuerySchema,
  BossRushHistoryQuerySchema,
} from '@arcade/protocol';
import {
  startBossRushSession,
  finishBossRushSession,
  getBossRushSession,
  getBossRushHistory,
  BossRushError,
} from '../services/bossRush.js';
import {
  getBossRushLeaderboard,
  getUserBossRushRank,
  getBossRushAvailableWeeks,
} from '../services/bossRushLeaderboard.js';
import { getCurrentWeekKey } from '../lib/queue.js';

const bossRushRoutes: FastifyPluginAsync = async (fastify) => {
  // Start new boss rush session
  fastify.post('/v1/boss-rush/start', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = BossRushStartRequestSchema.parse(request.body || {});
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    let result;
    try {
      result = await startBossRushSession(request.userId, body);
    } catch (error) {
      if (error instanceof BossRushError && error.code === 'INVALID_LOADOUT') {
        return reply.status(400).send({ error: 'Invalid loadout' });
      }
      throw error;
    }

    if (!result) {
      return reply.status(500).send({ error: 'Failed to start boss rush session' });
    }

    return reply.status(201).send(result);
  });

  // Finish boss rush session
  fastify.post<{
    Params: { sessionId: string };
  }>('/v1/boss-rush/:sessionId/finish', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId } = request.params;

    let body;
    try {
      body = BossRushFinishRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    let result;
    try {
      result = await finishBossRushSession(sessionId, request.userId, body);
    } catch (error) {
      if (error instanceof BossRushError) {
        if (error.code === 'SESSION_FORBIDDEN') {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        if (error.code === 'SESSION_NOT_FOUND') {
          return reply.status(404).send({ error: 'Session not found' });
        }
      }
      throw error;
    }

    if (!result.verified) {
      return reply.status(400).send({
        verified: false,
        rejectReason: result.rejectReason,
      });
    }

    return reply.send(result);
  });

  // Get boss rush session details
  fastify.get<{
    Params: { sessionId: string };
  }>('/v1/boss-rush/:sessionId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId } = request.params;
    const session = await getBossRushSession(sessionId, request.userId);

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    return reply.send(session);
  });

  // Get boss rush leaderboard
  fastify.get('/v1/boss-rush/leaderboard', async (request, reply) => {
    let query;
    try {
      query = BossRushLeaderboardQuerySchema.parse(request.query);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const weekKey = query.week || getCurrentWeekKey();
    const result = await getBossRushLeaderboard(weekKey, query.limit, query.offset);

    // If user is authenticated, add their rank
    if (request.userId) {
      const userRank = await getUserBossRushRank(request.userId, weekKey);
      return reply.send({
        ...result,
        userRank: userRank?.rank,
        userTotalDamage: userRank?.totalDamage,
      });
    }

    return reply.send(result);
  });

  // Get available weeks for boss rush leaderboard
  fastify.get('/v1/boss-rush/leaderboard/weeks', async (_request, reply) => {
    const weeks = await getBossRushAvailableWeeks();
    return reply.send({ weeks });
  });

  // Get user's boss rush history
  fastify.get('/v1/boss-rush/history', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let query;
    try {
      query = BossRushHistoryQuerySchema.parse(request.query);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid query parameters' });
    }

    const result = await getBossRushHistory(request.userId, query.limit, query.offset);
    return reply.send(result);
  });
};

export default bossRushRoutes;
