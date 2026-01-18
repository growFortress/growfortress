import { FastifyPluginAsync } from 'fastify';
import {
  GetBattlePassResponseSchema,
  ClaimBattlePassRewardRequestSchema,
  ClaimBattlePassRewardResponseSchema,
  ClaimAllBattlePassRewardsResponseSchema,
  BuyBattlePassTiersRequestSchema,
  BuyBattlePassTiersResponseSchema,
  PurchaseBattlePassResponseSchema,
  BATTLE_PASS_ERROR_CODES,
} from '@arcade/protocol';
import {
  getUserProgress,
  claimTierReward,
  claimAllRewards,
  purchaseTiers,
  upgradeToPremium,
} from '../services/battlepass.js';

const battlepassRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/battlepass
   * Get current battle pass season and user progress
   */
  fastify.get('/v1/battlepass', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await getUserProgress(request.userId);

    if (!result) {
      return reply.status(404).send({ error: BATTLE_PASS_ERROR_CODES.NO_ACTIVE_SEASON });
    }

    // Validate response matches protocol schema
    const responseValidation = GetBattlePassResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'GetBattlePassResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/battlepass/claim
   * Claim a single tier reward
   */
  fastify.post<{ Body: { tier: number; track: 'free' | 'premium' } }>(
    '/v1/battlepass/claim',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = ClaimBattlePassRewardRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
      }

      const { tier, track } = validation.data;
      const result = await claimTierReward(request.userId, tier, track);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      // Validate response matches protocol schema
      const responseValidation = ClaimBattlePassRewardResponseSchema.safeParse(result);
      if (!responseValidation.success) {
        fastify.log.error({ error: responseValidation.error }, 'ClaimBattlePassRewardResponse validation failed');
      }

      return reply.send(result);
    }
  );

  /**
   * POST /v1/battlepass/claim-all
   * Claim all available rewards
   */
  fastify.post('/v1/battlepass/claim-all', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimAllRewards(request.userId);

    // Validate response matches protocol schema
    const responseValidation = ClaimAllBattlePassRewardsResponseSchema.safeParse(result);
    if (!responseValidation.success) {
      fastify.log.error({ error: responseValidation.error }, 'ClaimAllBattlePassRewardsResponse validation failed');
    }

    return reply.send(result);
  });

  /**
   * POST /v1/battlepass/purchase-tier
   * Purchase tiers with dust
   */
  fastify.post<{ Body: { tierCount: number } }>(
    '/v1/battlepass/purchase-tier',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      // Validate request body
      const validation = BuyBattlePassTiersRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({ error: 'Invalid request', details: validation.error.issues });
      }

      const { tierCount } = validation.data;
      const result = await purchaseTiers(request.userId, tierCount);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      // Validate response matches protocol schema
      const responseValidation = BuyBattlePassTiersResponseSchema.safeParse(result);
      if (!responseValidation.success) {
        fastify.log.error({ error: responseValidation.error }, 'BuyBattlePassTiersResponse validation failed');
      }

      return reply.send(result);
    }
  );

  /**
   * POST /v1/battlepass/upgrade-premium
   * Create Stripe checkout session for premium upgrade
   */
  fastify.post<{ Body: { successUrl?: string; cancelUrl?: string } }>(
    '/v1/battlepass/upgrade-premium',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { successUrl, cancelUrl } = request.body || {};
      const result = await upgradeToPremium(request.userId, successUrl, cancelUrl);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      // Validate response matches protocol schema
      const responseValidation = PurchaseBattlePassResponseSchema.safeParse(result);
      if (!responseValidation.success) {
        fastify.log.error({ error: responseValidation.error }, 'PurchaseBattlePassResponse validation failed');
      }

      return reply.send(result);
    }
  );
};

export default battlepassRoutes;
