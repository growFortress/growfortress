/**
 * Power Upgrades Routes
 *
 * API endpoints for the permanent meta-progression power system.
 */

import { FastifyPluginAsync } from 'fastify';
import {
  UpgradeFortressStatRequestSchema,
  UpgradeHeroStatRequestSchema,
  UpgradeTurretStatRequestSchema,
  UpgradeItemTierRequestSchema,
  PrestigeFortressStatRequestSchema,
  PrestigeTurretStatRequestSchema,
} from '@arcade/protocol';
import {
  upgradeFortressStat,
  upgradeHeroStat,
  upgradeTurretStat,
  upgradeItemTier,
  getPowerSummary,
  prestigeFortressStat,
  prestigeTurretStat,
  getPrestigeStatus,
} from '../services/power-upgrades.js';

const powerUpgradesRoutes: FastifyPluginAsync = async (fastify) => {
  // Get power summary
  fastify.get('/v1/power', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const summary = await getPowerSummary(request.userId);
    return reply.send(summary);
  });

  // Upgrade fortress stat
  fastify.post('/v1/power/fortress', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UpgradeFortressStatRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await upgradeFortressStat(request.userId, body.stat);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // Upgrade hero stat
  fastify.post('/v1/power/hero', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UpgradeHeroStatRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await upgradeHeroStat(request.userId, body.heroId, body.stat);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // Upgrade turret stat
  fastify.post('/v1/power/turret', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UpgradeTurretStatRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await upgradeTurretStat(request.userId, body.turretType, body.stat);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // Upgrade item tier
  fastify.post('/v1/power/item', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = UpgradeItemTierRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await upgradeItemTier(request.userId, body.itemId);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // ============================================================================
  // PRESTIGE ROUTES
  // ============================================================================

  // Get prestige status
  fastify.get('/v1/power/prestige', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getPrestigeStatus(request.userId);
    return reply.send(status);
  });

  // Prestige fortress stat
  fastify.post('/v1/power/prestige/fortress', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = PrestigeFortressStatRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await prestigeFortressStat(request.userId, body.stat);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });

  // Prestige turret stat
  fastify.post('/v1/power/prestige/turret', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = PrestigeTurretStatRequestSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({ error: 'Invalid request body' });
    }

    const result = await prestigeTurretStat(request.userId, body.turretType, body.stat);

    if (!result.success) {
      return reply.status(400).send(result);
    }

    return reply.send(result);
  });
};

export default powerUpgradesRoutes;
