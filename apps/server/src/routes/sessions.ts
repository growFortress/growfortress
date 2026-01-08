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
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId } = request.params;

    let body;
    try {
      body = SegmentSubmitRequestSchema.parse(request.body);
    } catch (error) {
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
      if (error instanceof GameSessionError && error.code === 'SESSION_FORBIDDEN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      throw error;
    }

    if (!result) {
      return reply.status(404).send({ error: 'Session not found or expired' });
    }

    if (!result.verified) {
      return reply.status(400).send({
        verified: false,
        reason: result.rejectReason,
      });
    }

    return reply.send(result);
  });

  // End game session
  fastify.post<{
    Params: { sessionId: string };
  }>('/v1/sessions/:sessionId/end', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { sessionId } = request.params;

    let body;
    try {
      body = SessionEndRequestSchema.parse(request.body || {});
    } catch (error) {
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
      if (error instanceof GameSessionError && error.code === 'SESSION_FORBIDDEN') {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      throw error;
    }

    if (!result) {
      return reply.status(404).send({ error: 'Session not found' });
    }

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
};

export default sessionsRoutes;
