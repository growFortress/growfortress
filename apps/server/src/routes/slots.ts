import { FastifyPluginAsync } from 'fastify';
import { purchaseHeroSlot, purchaseTurretSlot, getSlotStatus } from '../services/slots.js';
import { withRateLimit } from '../plugins/rateLimit.js';

const slotsRoutes: FastifyPluginAsync = async (fastify) => {
  // Purchase hero slot
  fastify.post('/v1/slots/hero/purchase', withRateLimit('slotPurchase'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await purchaseHeroSlot(request.userId);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // Purchase turret slot
  fastify.post('/v1/slots/turret/purchase', withRateLimit('slotPurchase'), async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await purchaseTurretSlot(request.userId);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // Get slot status (for UI display)
  fastify.get('/v1/slots/status', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getSlotStatus(request.userId);

    if (!status) {
      return reply.status(404).send({ error: 'User data not found' });
    }

    return reply.send(status);
  });
};

export default slotsRoutes;
