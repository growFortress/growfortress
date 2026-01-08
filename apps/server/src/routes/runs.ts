import { FastifyPluginAsync } from 'fastify';
import {
  RunFinishRequestSchema,
  RUN_REJECTION_REASONS,
} from '@arcade/protocol';
import { verifyRunToken } from '../lib/tokens.js';
import { startRun, getRun, isRunWithinTTL, finishRun, saveRunEvents, getRunHistory, getRunDetails, getPlayerStats } from '../services/runs.js';
import { verifyRunSubmission } from '../services/verification.js';
import { calculateRewards, applyRewards } from '../services/rewards.js';
import { getActiveMultipliers } from '../services/events.js';
import { upsertLeaderboardEntry } from '../services/leaderboard.js';

const runsRoutes: FastifyPluginAsync = async (fastify) => {
  // Rate limit for run operations
  fastify.addHook('onRequest', async (request, _reply) => {
    if (request.url.startsWith('/v1/runs')) {
      // Additional rate limiting for runs (10 starts, 20 finishes per minute)
      // This is handled by the global rate limiter with custom keys
    }
  });

  // Start new run
  fastify.post('/v1/runs/start', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await startRun(request.userId);

    if (!result) {
      return reply.status(500).send({ error: 'Failed to start run' });
    }

    return reply.status(201).send(result);
  });

  // Finish run
  fastify.post<{
    Params: { runId: string };
  }>('/v1/runs/:runId/finish', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { runId } = request.params;

    // Parse and validate request body
    let body;
    try {
      body = RunFinishRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Invalid request body',
        reason: RUN_REJECTION_REASONS.EVENTS_INVALID,
      });
    }

    // Verify run token
    const tokenPayload = await verifyRunToken(body.runToken);
    if (!tokenPayload) {
      return reply.status(401).send({
        verified: false,
        reason: RUN_REJECTION_REASONS.TOKEN_INVALID,
      });
    }

    // Verify run ID matches
    if (tokenPayload.runId !== runId) {
      return reply.status(400).send({
        verified: false,
        reason: RUN_REJECTION_REASONS.TOKEN_INVALID,
      });
    }

    // Verify user ID matches
    if (tokenPayload.userId !== request.userId) {
      return reply.status(403).send({
        verified: false,
        reason: RUN_REJECTION_REASONS.TOKEN_INVALID,
      });
    }

    // Get run from database
    const run = await getRun(runId);
    if (!run) {
      return reply.status(404).send({
        verified: false,
        reason: RUN_REJECTION_REASONS.RUN_NOT_FOUND,
      });
    }

    // Check if already finished
    if (run.endedAt) {
      return reply.status(400).send({
        verified: false,
        reason: RUN_REJECTION_REASONS.RUN_ALREADY_FINISHED,
      });
    }

    // Check TTL
    if (!isRunWithinTTL(run.issuedAt)) {
      await finishRun(runId, false, RUN_REJECTION_REASONS.TOKEN_EXPIRED, 0, 0, {});
      return reply.status(400).send({
        verified: false,
        reason: RUN_REJECTION_REASONS.TOKEN_EXPIRED,
      });
    }

    // Verify run
    const verification = verifyRunSubmission(body, tokenPayload);

    // Save events
    await saveRunEvents(runId, body.events);

    if (!verification.verified) {
      // Mark run as rejected
      await finishRun(
        runId,
        false,
        verification.reason || 'UNKNOWN',
        body.finalHash,
        verification.score,
        verification.summary
      );

      return reply.status(400).send({
        verified: false,
        reason: verification.reason,
      });
    }

    // Calculate and apply rewards
    const eventMultipliers = await getActiveMultipliers();
    const rewards = calculateRewards(verification.summary, eventMultipliers);
    const { newInventory, newProgression, levelUp, newLevel } = await applyRewards(
      request.userId,
      rewards
    );

    // Update leaderboard
    await upsertLeaderboardEntry(request.userId, runId, verification.score);

    // Mark run as verified
    await finishRun(
      runId,
      true,
      null,
      body.finalHash,
      verification.score,
      verification.summary
    );

    return reply.send({
      verified: true,
      rewards: {
        gold: rewards.gold,
        dust: rewards.dust,
        xp: rewards.xp,
        levelUp,
        newLevel,
      },
      newInventory,
      newProgression,
    });
  });

  // Get run history
  fastify.get('/v1/runs', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const offset = parseInt(query.offset || '0', 10);

    const result = await getRunHistory(request.userId, limit, offset);
    return reply.send(result);
  });

  // Get run details
  fastify.get<{
    Params: { runId: string };
  }>('/v1/runs/:runId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { runId } = request.params;
    const details = await getRunDetails(runId, request.userId);

    if (!details) {
      return reply.status(404).send({ error: 'Run not found' });
    }

    return reply.send(details);
  });

  // Get player stats
  fastify.get('/v1/profile/stats', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const stats = await getPlayerStats(request.userId);
    return reply.send(stats);
  });
};

export default runsRoutes;
