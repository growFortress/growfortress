/**
 * IAP Routes - In-App Purchase endpoints
 *
 * GET /v1/iap/packages - Get available dust packages
 * POST /v1/iap/grant - Grant dust (admin only)
 * GET /v1/iap/transactions - Get user's transaction history
 */
import { FastifyPluginAsync } from 'fastify';
import { GrantDustRequestSchema } from '@arcade/protocol';
import { requireAdmin } from '../middleware/adminAuth.js';
import * as iapService from '../services/iap.js';

const iapRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/iap/packages
   * Get available dust packages with first-purchase bonus info
   */
  fastify.get('/v1/iap/packages', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    return iapService.getPackages(request.userId);
  });

  /**
   * POST /v1/iap/grant
   * Grant dust after successful IAP (admin only)
   * Called by external webhook or admin panel
   */
  fastify.post(
    '/v1/iap/grant',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const validation = GrantDustRequestSchema.safeParse(request.body);
      if (!validation.success) {
        return reply.status(400).send({
          error: 'VALIDATION_ERROR',
          details: validation.error.issues,
        });
      }

      const { userId, packageId, transactionId, platform, receipt } = validation.data;

      try {
        const result = await iapService.grantDust(
          userId,
          packageId,
          transactionId,
          platform,
          receipt
        );
        return result;
      } catch (error: any) {
        if (error.message.includes('already processed')) {
          return reply.status(409).send({
            error: 'TRANSACTION_ALREADY_PROCESSED',
            message: error.message,
          });
        }
        if (error.message.includes('Unknown package')) {
          return reply.status(400).send({
            error: 'UNKNOWN_PACKAGE',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  /**
   * GET /v1/iap/transactions
   * Get user's IAP transaction history
   */
  fastify.get('/v1/iap/transactions', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit || '50', 10), 100);
    const offset = parseInt(query.offset || '0', 10);

    return iapService.getTransactions(request.userId, limit, offset);
  });
};

export default iapRoutes;
