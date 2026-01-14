/**
 * Hub Preview Routes
 * Endpoints for viewing other players' hub configurations
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getHubPreview } from '../services/hubPreview.js';

const hubPreviewRoutes: FastifyPluginAsync = async (fastify) => {
  // Get hub preview for a specific user (requires authentication)
  fastify.get<{
    Params: { userId: string };
  }>('/v1/hub/:userId', { config: { public: false } }, async (request, reply) => {
    const paramsSchema = z.object({
      userId: z.string().min(1),
    });

    const { userId } = paramsSchema.parse(request.params);

    const preview = await getHubPreview(userId);

    if (!preview) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(preview);
  });
};

export default hubPreviewRoutes;
