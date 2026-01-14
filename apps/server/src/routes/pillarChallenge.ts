/**
 * Pillar Challenge Routes
 *
 * API endpoints for deterministic crystal farming mode.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  StartPillarChallengeRequestSchema,
  SubmitPillarChallengeRequestSchema,
  AbandonPillarChallengeRequestSchema,
  PreviewChallengeRewardsRequestSchema,
  GetChallengeLeaderboardRequestSchema,
  CraftCrystalRequestSchema,
  type StartPillarChallengeRequest,
  type SubmitPillarChallengeRequest,
  type AbandonPillarChallengeRequest,
  type PreviewChallengeRewardsRequest,
  type GetChallengeLeaderboardRequest,
  type CraftCrystalRequest,
} from '@arcade/protocol';

import {
  startPillarChallenge,
  submitPillarChallenge,
  getPillarChallengeStatus,
  abandonPillarChallenge,
  previewChallengeRewards,
  getChallengeLeaderboard,
  craftCrystal,
  assembleMatrix,
} from '../services/pillarChallenge.js';

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

export default async function pillarChallengeRoutes(
  app: FastifyInstance
): Promise<void> {
  // ========================================================================
  // GET STATUS
  // ========================================================================

  /**
   * GET /challenge/status
   * Get player's challenge progress, crystal progress, and daily limits
   */
  app.get(
    '/challenge/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;
      const result = await getPillarChallengeStatus(userId);
      return reply.send(result);
    }
  );

  // ========================================================================
  // START CHALLENGE
  // ========================================================================

  /**
   * POST /challenge/start
   * Start a new pillar challenge session
   */
  app.post(
    '/challenge/start',
    async (
      request: FastifyRequest<{ Body: StartPillarChallengeRequest }>,
      reply: FastifyReply
    ) => {
      const userId = request.userId!;

      // Validate body
      const parsed = StartPillarChallengeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      const { pillarId, tier, loadout, usePaidAttempt } = parsed.data;

      const result = await startPillarChallenge(
        userId,
        pillarId,
        tier,
        loadout,
        usePaidAttempt ?? false
      );

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    }
  );

  // ========================================================================
  // SUBMIT CHALLENGE
  // ========================================================================

  /**
   * POST /challenge/submit
   * Submit challenge results for verification
   */
  app.post(
    '/challenge/submit',
    async (
      request: FastifyRequest<{ Body: SubmitPillarChallengeRequest }>,
      reply: FastifyReply
    ) => {
      const userId = request.userId!;

      // Validate body
      const parsed = SubmitPillarChallengeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      const { sessionId, events, checkpoints, finalHash, result } = parsed.data;

      const response = await submitPillarChallenge(
        userId,
        sessionId,
        events,
        checkpoints,
        finalHash,
        result
      );

      if (!response.success) {
        return reply.status(400).send(response);
      }

      return reply.send(response);
    }
  );

  // ========================================================================
  // ABANDON CHALLENGE
  // ========================================================================

  /**
   * POST /challenge/abandon
   * Abandon an active challenge session
   */
  app.post(
    '/challenge/abandon',
    async (
      request: FastifyRequest<{ Body: AbandonPillarChallengeRequest }>,
      reply: FastifyReply
    ) => {
      const userId = request.userId!;

      // Validate body
      const parsed = AbandonPillarChallengeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      const { sessionId } = parsed.data;

      const result = await abandonPillarChallenge(userId, sessionId);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    }
  );

  // ========================================================================
  // PREVIEW REWARDS
  // ========================================================================

  /**
   * GET /challenge/rewards/preview
   * Preview potential rewards for a pillar/tier combination
   */
  app.get(
    '/challenge/rewards/preview',
    async (
      request: FastifyRequest<{ Querystring: PreviewChallengeRewardsRequest }>,
      reply: FastifyReply
    ) => {
      // Validate query
      const parsed = PreviewChallengeRewardsRequestSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: parsed.error.errors,
        });
      }

      const { pillarId, tier } = parsed.data;
      const result = await previewChallengeRewards(pillarId, tier);

      return reply.send(result);
    }
  );

  // ========================================================================
  // LEADERBOARD
  // ========================================================================

  /**
   * GET /challenge/leaderboard
   * Get leaderboard for a specific pillar/tier
   */
  app.get(
    '/challenge/leaderboard',
    async (
      request: FastifyRequest<{ Querystring: GetChallengeLeaderboardRequest }>,
      reply: FastifyReply
    ) => {
      const userId = request.userId;

      // Validate query
      const parsed = GetChallengeLeaderboardRequestSchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: parsed.error.errors,
        });
      }

      const { pillarId, tier, limit, offset } = parsed.data;

      const result = await getChallengeLeaderboard(
        pillarId,
        tier,
        limit ?? 50,
        offset ?? 0,
        userId
      );

      return reply.send(result);
    }
  );

  // ========================================================================
  // CRYSTAL CRAFTING
  // ========================================================================

  /**
   * POST /challenge/crystal/craft
   * Craft a full crystal from 10 fragments
   */
  app.post(
    '/challenge/crystal/craft',
    async (
      request: FastifyRequest<{ Body: CraftCrystalRequest }>,
      reply: FastifyReply
    ) => {
      const userId = request.userId!;

      // Validate body
      const parsed = CraftCrystalRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request body',
          details: parsed.error.errors,
        });
      }

      const { crystalType } = parsed.data;
      const result = await craftCrystal(userId, crystalType);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    }
  );

  // ========================================================================
  // ASSEMBLE MATRIX
  // ========================================================================

  /**
   * POST /challenge/matrix/assemble
   * Assemble the Crystal Matrix from all 6 crystals
   */
  app.post(
    '/challenge/matrix/assemble',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;
      const result = await assembleMatrix(userId);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send(result);
    }
  );
}
