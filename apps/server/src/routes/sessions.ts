import { FastifyPluginAsync } from 'fastify';
import {
  SessionStartRequestSchema,
  SessionEndRequestSchema,
  SegmentSubmitRequestSchema,
} from '@arcade/protocol';
import {
  startGameSession,
  submitSegment,
  endGameSession,
  getActiveSession,
  refreshSessionToken,
  GameSessionError,
} from '../services/gameSessions.js';

const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  // Start new game session (endless mode)
  fastify.post('/v1/sessions/start', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = SessionStartRequestSchema.parse(request.body || {});
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    let result;
    try {
      result = await startGameSession(request.userId, body);
    } catch (error) {
      if (error instanceof GameSessionError && error.code === 'INVALID_LOADOUT') {
        return reply.status(400).send({ error: 'Invalid loadout' });
      }
      throw error;
    }

    if (!result) {
      return reply.status(500).send({ error: 'Failed to start session' });
    }

    return reply.status(201).send(result);
  });

  // Submit a segment for verification
  fastify.post<{
    Params: { sessionId: string };
  }>('/v1/sessions/:sessionId/segment', async (request, reply) => {
    const requestStartTime = Date.now();
    const { sessionId } = request.params;

    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = SegmentSubmitRequestSchema.parse(request.body);
    } catch (error) {
      const latency = Date.now() - requestStartTime;
      request.log.warn({
        sessionId,
        userId: request.userId,
        latency,
        validationError: error instanceof Error ? error.message : 'Unknown',
        body: request.body,
      }, 'Segment schema validation failed');
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    let result;
    try {
      result = await submitSegment(
        request.userId,
        sessionId,
        body.sessionToken,
        body.startWave,
        body.endWave,
        body.events,
        body.checkpoints,
        body.finalHash
      );
    } catch (error) {
      const latency = Date.now() - requestStartTime;
      request.log.error({
        sessionId,
        userId: request.userId,
        latency,
        startWave: body.startWave,
        endWave: body.endWave,
        error: error instanceof Error ? error.message : 'Unknown',
        errorCode: error instanceof GameSessionError ? error.code : undefined,
      }, 'Segment submission error');
      if (error instanceof GameSessionError && error.code === 'SESSION_FORBIDDEN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      throw error;
    }

    const latency = Date.now() - requestStartTime;

    if (!result) {
      request.log.warn({
        sessionId,
        userId: request.userId,
        latency,
        startWave: body.startWave,
        endWave: body.endWave,
      }, 'Segment submission: session not found or expired');
      return reply.status(404).send({ error: 'Session not found or expired' });
    }

    if (!result.verified) {
      request.log.warn({
        sessionId,
        userId: request.userId,
        latency,
        rejectReason: result.rejectReason,
        startWave: body.startWave,
        endWave: body.endWave,
        eventsCount: body.events?.length ?? 0,
        checkpointsCount: body.checkpoints?.length ?? 0,
      }, 'Segment verification failed');
      return reply.status(400).send({
        verified: false,
        reason: result.rejectReason,
      });
    }

    // Log successful segment submission with full details
    request.log.info({
      sessionId,
      userId: request.userId,
      latency,
      startWave: body.startWave,
      endWave: body.endWave,
      wavesCompleted: body.endWave - body.startWave,
      goldEarned: result.goldEarned,
      dustEarned: result.dustEarned,
      xpEarned: result.xpEarned,
      newLevel: result.newProgression.level,
      newGold: result.newInventory.gold,
      newDust: result.newInventory.dust,
      eventsCount: body.events?.length ?? 0,
      checkpointsCount: body.checkpoints?.length ?? 0,
    }, 'Segment verified and persisted');

    return reply.send(result);
  });

  // End game session
  fastify.post<{
    Params: { sessionId: string };
  }>('/v1/sessions/:sessionId/end', async (request, reply) => {
    const requestStartTime = Date.now();
    const { sessionId } = request.params;

    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = SessionEndRequestSchema.parse(request.body || {});
    } catch (error) {
      const latency = Date.now() - requestStartTime;
      request.log.warn({
        sessionId,
        userId: request.userId,
        latency,
        validationError: error instanceof Error ? error.message : 'Unknown',
        body: request.body,
      }, 'End session schema validation failed');
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    let result;
    try {
      result = await endGameSession(
        sessionId,
        request.userId,
        body.reason,
        body.partialRewards
      );
    } catch (error) {
      const latency = Date.now() - requestStartTime;
      request.log.error({
        sessionId,
        userId: request.userId,
        latency,
        reason: body.reason,
        partialRewards: body.partialRewards,
        error: error instanceof Error ? error.message : 'Unknown',
        errorCode: error instanceof GameSessionError ? error.code : undefined,
      }, 'End session error');
      if (error instanceof GameSessionError && error.code === 'SESSION_FORBIDDEN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      throw error;
    }

    const latency = Date.now() - requestStartTime;

    if (!result) {
      request.log.warn({
        sessionId,
        userId: request.userId,
        latency,
        reason: body.reason,
        partialRewards: body.partialRewards,
      }, 'End session: session not found');
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Log successful session end with full details
    request.log.info({
      sessionId,
      userId: request.userId,
      latency,
      reason: body.reason,
      finalWave: result.finalWave,
      totalGoldEarned: result.totalGoldEarned,
      totalDustEarned: result.totalDustEarned,
      totalXpEarned: result.totalXpEarned,
      newLevel: result.newProgression.level,
      newGold: result.newInventory.gold,
      newDust: result.newInventory.dust,
      partialRewardsRequested: body.partialRewards ? {
        gold: body.partialRewards.gold,
        dust: body.partialRewards.dust,
        xp: body.partialRewards.xp,
        finalWave: body.partialRewards.finalWave,
      } : null,
      partialRewardsApplied: body.partialRewards ? {
        gold: result.totalGoldEarned,
        dust: result.totalDustEarned,
        xp: result.totalXpEarned,
      } : null,
    }, 'Session ended and persisted');

    return reply.send(result);
  });

  // Get active session
  fastify.get('/v1/sessions/active', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const session = await getActiveSession(request.userId);

    if (!session) {
      return reply.status(404).send({ error: 'No active session' });
    }

    return reply.send(session);
  });

  // Refresh session token (extend expiry for long gameplay sessions)
  fastify.post<{
    Params: { sessionId: string };
  }>('/v1/sessions/:sessionId/refresh-token', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId } = request.params;
    const body = request.body as { sessionToken?: string };

    if (!body.sessionToken) {
      return reply.status(400).send({ error: 'sessionToken is required' });
    }

    const result = await refreshSessionToken(
      request.userId,
      sessionId,
      body.sessionToken,
    );

    if (!result) {
      return reply.status(404).send({ error: 'Session not found or token invalid' });
    }

    return reply.send(result);
  });
};

export default sessionsRoutes;
