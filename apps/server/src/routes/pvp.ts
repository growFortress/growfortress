import { FastifyPluginAsync } from 'fastify';
import {
  PvpCreateChallengeRequestSchema,
  PvpChallengesQuerySchema,
} from '@arcade/protocol';
import {
  getOpponents,
  createChallenge,
  getChallenges,
  getChallenge,
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  getReplayData,
  getUserPvpStats,
  PvpError,
} from '../services/pvp.js';

const pvpRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // OPPONENTS
  // ============================================================================

  // Get list of random opponents for PVP arena (always 6 random players)
  fastify.get('/v1/pvp/opponents', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as { limit?: string; offset?: string } | undefined;
    const limit = query?.limit ? Number(query.limit) : undefined;
    const offset = query?.offset ? Number(query.offset) : undefined;

    const result = await getOpponents(request.userId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    return reply.send(result);
  });

  // ============================================================================
  // CHALLENGES
  // ============================================================================

  // Create a new challenge
  fastify.post('/v1/pvp/challenges', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = PvpCreateChallengeRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    try {
      const challenge = await createChallenge(request.userId, body.challengedId, {
        enforcePowerRange: true,
      });
      return reply.status(201).send({ challenge });
    } catch (error) {
      if (error instanceof PvpError) {
        const statusMap: Record<string, number> = {
          CANNOT_CHALLENGE_SELF: 400,
          COOLDOWN_ACTIVE: 429,
          OPPONENT_NOT_FOUND: 404,
          POWER_OUT_OF_RANGE: 400,
          USER_NOT_FOUND: 404,
        };
        const status = statusMap[error.code] ?? 400;
        return reply.status(status).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // Get list of challenges
  fastify.get('/v1/pvp/challenges', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let query;
    try {
      query = PvpChallengesQuerySchema.parse(request.query);
    } catch (error) {
      fastify.log.error({ 
        query: request.query, 
        error: error instanceof Error ? error.message : String(error),
        userId: request.userId 
      }, 'Invalid query parameters for GET /v1/pvp/challenges');
      return reply.status(400).send({ 
        error: 'Invalid query parameters',
        details: error instanceof Error ? error.message : undefined
      });
    }

    const result = await getChallenges(
      request.userId,
      query.type,
      query.status,
      query.limit,
      query.offset
    );
    return reply.send(result);
  });

  // Get a single challenge
  fastify.get<{
    Params: { id: string };
  }>('/v1/pvp/challenges/:id', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const challenge = await getChallenge(request.params.id, request.userId);
      return reply.send(challenge);
    } catch (error) {
      if (error instanceof PvpError) {
        if (error.code === 'CHALLENGE_NOT_FOUND') {
          return reply.status(404).send({ error: error.message, code: error.code });
        }
        if (error.code === 'CHALLENGE_FORBIDDEN') {
          return reply.status(403).send({ error: error.message, code: error.code });
        }
      }
      throw error;
    }
  });

  // Accept a challenge
  fastify.post<{
    Params: { id: string };
  }>('/v1/pvp/challenges/:id/accept', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const result = await acceptChallenge(request.params.id, request.userId);
      return reply.send(result);
    } catch (error) {
      if (error instanceof PvpError) {
        const statusMap: Record<string, number> = {
          CHALLENGE_NOT_FOUND: 404,
          CHALLENGE_FORBIDDEN: 403,
          CHALLENGE_NOT_PENDING: 400,
          CHALLENGE_EXPIRED: 410,
          USER_NOT_FOUND: 500,
        };
        const status = statusMap[error.code] ?? 400;
        return reply.status(status).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // Decline a challenge
  fastify.post<{
    Params: { id: string };
  }>('/v1/pvp/challenges/:id/decline', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const result = await declineChallenge(request.params.id, request.userId);
      return reply.send(result);
    } catch (error) {
      if (error instanceof PvpError) {
        const statusMap: Record<string, number> = {
          CHALLENGE_NOT_FOUND: 404,
          CHALLENGE_FORBIDDEN: 403,
          CHALLENGE_NOT_PENDING: 400,
        };
        const status = statusMap[error.code] ?? 400;
        return reply.status(status).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // Cancel a challenge
  fastify.post<{
    Params: { id: string };
  }>('/v1/pvp/challenges/:id/cancel', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const result = await cancelChallenge(request.params.id, request.userId);
      return reply.send(result);
    } catch (error) {
      if (error instanceof PvpError) {
        const statusMap: Record<string, number> = {
          CHALLENGE_NOT_FOUND: 404,
          CHALLENGE_FORBIDDEN: 403,
          CHALLENGE_NOT_PENDING: 400,
        };
        const status = statusMap[error.code] ?? 400;
        return reply.status(status).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // ============================================================================
  // REPLAY
  // ============================================================================

  // Get replay data for a challenge
  fastify.get<{
    Params: { id: string };
  }>('/v1/pvp/replay/:id', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const replay = await getReplayData(request.params.id, request.userId);
      return reply.send(replay);
    } catch (error) {
      if (error instanceof PvpError) {
        const statusMap: Record<string, number> = {
          CHALLENGE_NOT_FOUND: 404,
          CHALLENGE_FORBIDDEN: 403,
          CHALLENGE_NOT_PENDING: 400,
        };
        const status = statusMap[error.code] ?? 400;
        return reply.status(status).send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });

  // ============================================================================
  // STATS
  // ============================================================================

  // Get user's PvP stats
  fastify.get('/v1/pvp/stats', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const stats = await getUserPvpStats(request.userId);
    return reply.send(stats);
  });
};

export default pvpRoutes;
