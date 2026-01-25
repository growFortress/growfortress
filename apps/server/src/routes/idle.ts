import { FastifyPluginAsync } from 'fastify';
import {
  calculatePendingIdleRewards,
  claimIdleRewards,
  getIdleRewardsConfig,
  upgradeColony,
  getPrestigeStatus,
  performPrestige,
  getMilestoneStatus,
  claimMilestone,
} from '../services/idleRewards.js';
import { prisma } from '../lib/prisma.js';
import { UpgradeColonyRequestSchema, ClaimMilestoneRequestSchema } from '@arcade/protocol';

// Rate limiting for colony upgrades (prevents spam clicking)
const lastUpgrade = new Map<string, number>();
const UPGRADE_COOLDOWN_MS = 1000; // 1 second between upgrades

const idleRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/idle/pending
   * Get pending idle rewards without claiming
   */
  fastify.get('/v1/idle/pending', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const pending = await calculatePendingIdleRewards(request.userId);

    if (!pending) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(pending);
  });

  /**
   * POST /v1/idle/claim
   * Claim all pending idle rewards
   */
  fastify.post('/v1/idle/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimIdleRewards(request.userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });

  /**
   * GET /v1/idle/config
   * Get idle rewards configuration for the user's commander level
   */
  fastify.get('/v1/idle/config', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const progression = await prisma.progression.findUnique({
      where: { userId: request.userId },
      select: { level: true },
    });

    if (!progression) {
      return reply.status(404).send({ error: 'Progression not found' });
    }

    const config = getIdleRewardsConfig(progression.level);

    return reply.send({
      commanderLevel: progression.level,
      ...config,
    });
  });

  /**
   * POST /v1/idle/colony/upgrade
   * Upgrade a colony building to increase gold production
   */
  fastify.post<{ Body: { colonyId: string } }>('/v1/idle/colony/upgrade', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Rate limiting - prevent spam clicking
    const now = Date.now();
    const last = lastUpgrade.get(request.userId) || 0;
    if (now - last < UPGRADE_COOLDOWN_MS) {
      return reply.status(429).send({ error: 'Too many requests. Please wait.' });
    }
    lastUpgrade.set(request.userId, now);

    // Zod validation
    const parsed = UpgradeColonyRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request: Colony ID is required' });
    }
    const { colonyId } = parsed.data;

    const result = await upgradeColony(request.userId, colonyId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });

  // ============================================================================
  // PRESTIGE SYSTEM
  // ============================================================================

  /**
   * GET /v1/idle/prestige
   * Get prestige status (stellar points, bonuses, etc.)
   */
  fastify.get('/v1/idle/prestige', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getPrestigeStatus(request.userId);

    if (!status) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(status);
  });

  /**
   * POST /v1/idle/prestige
   * Perform stellar rebirth (reset colonies for stellar points)
   */
  fastify.post('/v1/idle/prestige', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await performPrestige(request.userId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });

  // ============================================================================
  // MILESTONES
  // ============================================================================

  /**
   * GET /v1/idle/milestones
   * Get milestone progress and status
   */
  fastify.get('/v1/idle/milestones', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const status = await getMilestoneStatus(request.userId);

    if (!status) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(status);
  });

  /**
   * POST /v1/idle/milestone/claim
   * Claim a milestone reward
   */
  fastify.post<{ Body: { milestoneId: string } }>('/v1/idle/milestone/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Zod validation
    const parsed = ClaimMilestoneRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request: Milestone ID is required' });
    }
    const { milestoneId } = parsed.data;

    const result = await claimMilestone(request.userId, milestoneId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send(result);
  });
};

export default idleRoutes;
