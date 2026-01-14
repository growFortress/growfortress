/**
 * Shop Routes - Microtransaction endpoints
 *
 * GET  /v1/shop              - Get shop overview
 * POST /v1/shop/checkout     - Create Stripe checkout session
 * GET  /v1/shop/verify/:id   - Verify checkout status
 * POST /v1/shop/webhook      - Stripe webhook handler
 * POST /v1/shop/buy-dust     - Buy with dust (boosters, convenience)
 * GET  /v1/shop/boosters     - Get active boosters
 * GET  /v1/shop/purchases    - Get purchase history
 */
import { FastifyPluginAsync } from 'fastify';
import {
  CreateCheckoutRequestSchema,
  BuyWithDustRequestSchema,
  GetPurchasesQuerySchema,
  SHOP_ERROR_CODES,
} from '@arcade/protocol';
import { isStripeConfigured } from '../lib/stripe.js';
import * as shopService from '../services/shop.js';

const shopRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/shop
   * Get shop overview with products and user purchase info
   */
  fastify.get('/v1/shop', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return shopService.getShopOverview(request.userId);
  });

  /**
   * POST /v1/shop/checkout
   * Create Stripe checkout session for a product
   */
  fastify.post('/v1/shop/checkout', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!isStripeConfigured()) {
      return reply.status(503).send({
        error: 'STRIPE_NOT_CONFIGURED',
        message: 'Payment processing is not available',
      });
    }

    const validation = CreateCheckoutRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: validation.error.issues,
      });
    }

    const { productId, successUrl, cancelUrl } = validation.data;

    try {
      const result = await shopService.createCheckout(
        request.userId,
        productId,
        successUrl,
        cancelUrl,
      );
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === SHOP_ERROR_CODES.PRODUCT_NOT_FOUND) {
        return reply.status(404).send({
          error: SHOP_ERROR_CODES.PRODUCT_NOT_FOUND,
          message: 'Product not found',
        });
      }
      if (message === SHOP_ERROR_CODES.PURCHASE_LIMIT_REACHED) {
        return reply.status(400).send({
          error: SHOP_ERROR_CODES.PURCHASE_LIMIT_REACHED,
          message: 'Purchase limit reached for this product',
        });
      }
      throw error;
    }
  });

  /**
   * GET /v1/shop/verify/:sessionId
   * Verify checkout session status (for client polling)
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/v1/shop/verify/:sessionId',
    async (request, reply) => {
      if (!request.userId) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const { sessionId } = request.params;
      return shopService.verifyCheckout(sessionId, request.userId);
    },
  );

  /**
   * POST /v1/shop/webhook
   * Stripe webhook handler
   * Note: This endpoint should NOT be behind auth middleware
   */
  fastify.post(
    '/v1/shop/webhook',
    {
      config: {
        rawBody: true,
        public: true,
      },
    },
    async (request, reply) => {
      const signature = request.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      try {
        // Get raw body for signature verification
        const rawBody = (request as unknown as { rawBody: Buffer }).rawBody;
        if (!rawBody) {
          return reply.status(400).send({ error: 'Raw body not available' });
        }

        await shopService.handleStripeWebhook(rawBody, signature);
        return { received: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        fastify.log.error({ error: message }, 'Stripe webhook error');
        return reply.status(400).send({
          error: 'WEBHOOK_ERROR',
          message: 'Webhook processing failed',
        });
      }
    },
  );

  /**
   * POST /v1/shop/buy-dust
   * Buy a booster or convenience item with dust
   */
  fastify.post('/v1/shop/buy-dust', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = BuyWithDustRequestSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: validation.error.issues,
      });
    }

    const { itemType, itemId } = validation.data;

    try {
      return await shopService.buyWithDust(request.userId, itemType, itemId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (message === SHOP_ERROR_CODES.INSUFFICIENT_DUST) {
        return reply.status(400).send({
          error: SHOP_ERROR_CODES.INSUFFICIENT_DUST,
          message: 'Insufficient dust balance',
        });
      }
      if (message === SHOP_ERROR_CODES.PRODUCT_NOT_FOUND) {
        return reply.status(404).send({
          error: SHOP_ERROR_CODES.PRODUCT_NOT_FOUND,
          message: 'Item not found',
        });
      }
      throw error;
    }
  });

  /**
   * GET /v1/shop/boosters
   * Get user's active boosters
   */
  fastify.get('/v1/shop/boosters', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return shopService.getActiveBoosters(request.userId);
  });

  /**
   * GET /v1/shop/purchases
   * Get user's purchase history
   */
  fastify.get('/v1/shop/purchases', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const validation = GetPurchasesQuerySchema.safeParse(request.query);
    if (!validation.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: validation.error.issues,
      });
    }

    const { limit, offset } = validation.data;
    return shopService.getPurchases(request.userId, limit, offset);
  });
};

export default shopRoutes;
