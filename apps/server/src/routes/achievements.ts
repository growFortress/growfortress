import { FastifyPluginAsync } from 'fastify';
import {
  GetAchievementsResponseSchema,
  ClaimAchievementRewardResponseSchema,
  ClaimAllAchievementsResponseSchema,
  SetActiveTitleRequestSchema,
  SetActiveTitleResponseSchema,
  AchievementIdSchema,
  ACHIEVEMENT_ERROR_CODES,
  type AchievementId,
} from '@arcade/protocol';
import {
  getAchievements,
  claimAchievementReward,
  claimAllAchievementRewards,
  setActiveTitle,
} from '../services/achievements.js';

const achievementsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/achievements
   * Get all achievements with progress and lifetime stats
   */
  fastify.get('/v1/achievements', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await getAchievements(request.userId);

    // Validate response matches protocol schema
    const responseValidation = GetAchievementsResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'GetAchievementsResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/achievements/:id/claim/:tier
   * Claim a specific achievement tier reward
   */
  fastify.post<{ Params: { id: string; tier: string } }>(
    '/v1/achievements/:id/claim/:tier',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { id, tier } = request.params;

      // Validate achievement ID
      const idValidation = AchievementIdSchema.safeParse(id);
      if (!idValidation.success) {
        return reply.status(400).send({
          error: ACHIEVEMENT_ERROR_CODES.ACHIEVEMENT_NOT_FOUND,
          details: idValidation.error.issues,
        });
      }

      // Validate tier is a number
      const tierNum = parseInt(tier, 10);
      if (isNaN(tierNum) || tierNum < 1) {
        return reply.status(400).send({
          error: 'Invalid tier',
          details: 'Tier must be a positive integer',
        });
      }

      const result = await claimAchievementReward(
        request.userId,
        id as AchievementId,
        tierNum
      );

      if (!result.success) {
        return reply.status(400).send(result);
      }

      // Validate response matches protocol schema
      const responseValidation = ClaimAchievementRewardResponseSchema.safeParse(result);
      if (!responseValidation.success) {
        fastify.log.error({ error: responseValidation.error }, 'ClaimAchievementRewardResponse validation failed');
      }

      return reply.send(result);
    }
  );

  /**
   * POST /v1/achievements/claim-all
   * Claim all unclaimed achievement rewards
   */
  fastify.post('/v1/achievements/claim-all', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimAllAchievementRewards(request.userId);

    // Validate response matches protocol schema
    const responseValidation = ClaimAllAchievementsResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'ClaimAllAchievementsResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/achievements/title
   * Set the active title
   */
  fastify.post<{ Body: { title: string | null } }>(
    '/v1/achievements/title',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = SetActiveTitleRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
      }

      const { title } = validation.data;
      const success = await setActiveTitle(request.userId, title);

      if (!success) {
        return reply.status(400).send({
          success: false,
          error: ACHIEVEMENT_ERROR_CODES.TITLE_NOT_UNLOCKED,
        });
      }

      const response = { success: true, activeTitle: title };

      // Validate response matches protocol schema
      const responseValidation = SetActiveTitleResponseSchema.safeParse(response);
      if (!responseValidation.success) {
        fastify.log.error({ error: responseValidation.error }, 'SetActiveTitleResponse validation failed');
      }

      return reply.send(response);
    }
  );
};

export default achievementsRoutes;
