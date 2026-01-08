import { FastifyPluginAsync } from 'fastify';
import { UnlockHeroRequestSchema, UnlockTurretRequestSchema } from '@arcade/protocol';
import { unlockHero, unlockTurret } from '../services/heroes.js';

const heroesRoutes: FastifyPluginAsync = async (fastify) => {
  // Unlock hero
  fastify.post('/v1/heroes/unlock', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UnlockHeroRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await unlockHero(request.userId, body.heroId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
        heroId: result.heroId,
        unlockedHeroIds: result.unlockedHeroIds,
        inventory: result.inventory,
      });
    }

    return reply.send(result);
  });

  // Unlock turret
  fastify.post('/v1/turrets/unlock', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UnlockTurretRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await unlockTurret(request.userId, body.turretType);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
        turretType: result.turretType,
        unlockedTurretIds: result.unlockedTurretIds,
        inventory: result.inventory,
      });
    }

    return reply.send(result);
  });
};

export default heroesRoutes;
