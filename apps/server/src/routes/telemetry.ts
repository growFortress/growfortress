import { FastifyPluginAsync } from 'fastify';
import { TelemetryBatchRequestSchema } from '@arcade/protocol';
import { prisma, Prisma } from '../lib/prisma.js';

const telemetryRoutes: FastifyPluginAsync = async (fastify) => {
  // Batch telemetry events
  fastify.post('/v1/telemetry/batch', async (request, reply) => {
    const body = TelemetryBatchRequestSchema.parse(request.body);

    // Insert events
    const created = await prisma.telemetryEvent.createMany({
      data: body.events.map(event => ({
        userId: request.userId || null,
        eventType: event.eventType,
        data: (event.data || {}) as Prisma.InputJsonValue,
      })),
    });

    return reply.send({
      accepted: created.count,
    });
  });
};

export default telemetryRoutes;
