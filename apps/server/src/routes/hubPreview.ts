/**
 * Hub Preview Routes
 * Endpoints for viewing other players' hub configurations
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getHubPreview } from '../services/hubPreview.js';
import { withRateLimit } from '../plugins/rateLimit.js';

// Validate userId format (CUID2 or similar)
const userIdSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);

const hubPreviewRoutes: FastifyPluginAsync = async (fastify) => {
  // Get hub preview for a specific user (requires authentication)
  fastify.get<{
    Params: { userId: string };
  }>(
    '/v1/hub/:userId',
    withRateLimit('hubPreview', { config: { public: false } }),
    async (request, reply) => {
      const paramsSchema = z.object({
        userId: userIdSchema,
      });

      const parseResult = paramsSchema.safeParse(request.params);
      if (!parseResult.success) {
        return reply.status(400).send({ error: 'Invalid user ID format' });
      }

      const { userId } = parseResult.data;

      const preview = await getHubPreview(userId);

      if (!preview) {
        return reply.status(404).send({ error: 'User not found' });
      }

      return reply.send(preview);
    }
  );
};

export default hubPreviewRoutes;
