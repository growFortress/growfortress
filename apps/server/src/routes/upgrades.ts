import { FastifyPluginAsync } from 'fastify';
import { UpgradeHeroRequestSchema, UpgradeTurretRequestSchema } from '@arcade/protocol';
import { upgradeHero, upgradeTurret } from '../services/upgrades.js';

const upgradesRoutes: FastifyPluginAsync = async (fastify) => {
  // Upgrade hero
  fastify.post('/v1/upgrades/hero', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UpgradeHeroRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await upgradeHero(
      request.userId,
      body.heroId,
      body.currentTier
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
        newInventory: result.newInventory,
      });
    }

    return reply.send(result);
  });

  // Upgrade turret
  fastify.post('/v1/upgrades/turret', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UpgradeTurretRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await upgradeTurret(
      request.userId,
      body.turretType,
      body.slotIndex,
      body.currentTier
    );

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error,
        newInventory: result.newInventory,
      });
    }

    return reply.send(result);
  });
};

export default upgradesRoutes;
