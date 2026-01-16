/**
 * Guild Preview Routes
 * Endpoints for viewing other guilds' public information
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { getGuildPreview } from '../services/guildPreview.js';

const guildPreviewRoutes: FastifyPluginAsync = async (fastify) => {
  // Get guild preview for a specific guild (public - for viewing other guilds)
  fastify.get<{
    Params: { guildId: string };
  }>('/v1/guilds/:guildId/preview', { config: { public: true } }, async (request, reply) => {
    const paramsSchema = z.object({
      guildId: z.string().min(1),
    });

    const { guildId } = paramsSchema.parse(request.params);

    const preview = await getGuildPreview(guildId);

    if (!preview) {
      return reply.status(404).send({ error: 'Guild not found' });
    }

    return reply.send(preview);
  });
};

export default guildPreviewRoutes;
