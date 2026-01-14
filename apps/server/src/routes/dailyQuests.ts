import { FastifyPluginAsync } from 'fastify';
import {
  ClaimQuestRewardRequestSchema,
  DailyQuestsResponseSchema,
  ClaimQuestRewardResponseSchema,
  ClaimAllQuestsResponseSchema,
  type DailyQuestId,
} from '@arcade/protocol';
import {
  getDailyQuests,
  claimQuestReward,
  claimAllQuestRewards,
} from '../services/dailyQuests.js';

const dailyQuestsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/daily-quests
   * Get all daily quest progress for the current user
   */
  fastify.get('/v1/daily-quests', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await getDailyQuests(request.userId);

    // Validate response matches protocol schema
    const responseValidation = DailyQuestsResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'DailyQuestsResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/daily-quests/:questId/claim
   * Claim reward for a completed quest
   */
  fastify.post<{ Params: { questId: string } }>(
    '/v1/daily-quests/:questId/claim',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { questId } = request.params;

      // Validate questId
      const validation = ClaimQuestRewardRequestSchema.safeParse({ questId });
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid quest ID', details: validation.error.issues });
      }

      const result = await claimQuestReward(request.userId, questId as DailyQuestId);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      // Validate response matches protocol schema
      const responseValidation = ClaimQuestRewardResponseSchema.safeParse(result);
      if (!responseValidation.success) {
        fastify.log.error({ error: responseValidation.error }, 'ClaimQuestRewardResponse validation failed');
      }

      return reply.send(result);
    }
  );

  /**
   * POST /v1/daily-quests/claim-all
   * Claim all completed but unclaimed quest rewards
   */
  fastify.post('/v1/daily-quests/claim-all', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimAllQuestRewards(request.userId);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    // Validate response matches protocol schema
    const responseValidation = ClaimAllQuestsResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'ClaimAllQuestsResponse validation failed');
    }

    return reply.send(result);
  });
};

export default dailyQuestsRoutes;
