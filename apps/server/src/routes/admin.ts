import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { createAuditLog } from '../services/adminAudit.js';
import { getGameConfig, updateConfig } from '../services/gameConfig.js';
import { getCurrentMetrics } from '../services/metrics.js';
import { listAllEvents, createScheduledEvent, updateScheduledEvent, deleteScheduledEvent } from '../services/events.js';
import { createBulkReward } from '../services/bulkRewards.js';
import { listBugReports, getBugReport } from '../services/bugReports.js';
import { getSessionStateAtTick } from '../services/debug.js';
import { createSystemBroadcast } from '../services/messages.js';
import { BroadcastRequestSchema } from '@arcade/protocol';
import { recalculateAllZeroPower, recalculateCachedPower } from '../services/power-upgrades.js';

// ============================================================================
// Zod Schemas for Admin API validation
// ============================================================================

// Common query/param schemas
const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const UserIdParamSchema = z.object({
  id: z.string().cuid(),
});

const IdParamSchema = z.object({
  id: z.string().cuid(),
});

// User management schemas
const UserListQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
});

const BanUserBodySchema = z.object({
  banned: z.boolean(),
});

const GrantRewardsBodySchema = z.object({
  gold: z.number().int().min(0).max(10_000_000).default(0),
  dust: z.number().int().min(0).max(10_000_000).default(0),
});

// Config schemas
const ConfigKeyParamSchema = z.object({
  key: z.string().min(1).max(100),
});

const UpdateConfigBodySchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
});

// Event schemas
const EventTypeSchema = z.enum(['gold_multiplier', 'xp_multiplier', 'dust_multiplier', 'special']);

const CreateEventBodySchema = z.object({
  name: z.string().min(1).max(100),
  type: EventTypeSchema,
  value: z.coerce.number().min(0).max(100),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  description: z.string().max(500).optional(),
});

const UpdateEventBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: EventTypeSchema.optional(),
  value: z.coerce.number().min(0).max(100).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  active: z.boolean().optional(),
});

// Bulk reward schemas
const BulkRewardTypeSchema = z.enum(['gold', 'dust', 'item']);

const CreateBulkRewardBodySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  type: BulkRewardTypeSchema,
  value: z.string().min(1).max(20),  // Stored as string in DB
  targetType: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

// Grant artifact schema
const GrantArtifactBodySchema = z.object({
  artifactId: z.string().min(1).max(100),
  level: z.number().int().min(1).max(20).default(1),
});

// Grant materials schema
const GrantMaterialsBodySchema = z.object({
  materials: z.record(z.string(), z.number().int().min(1).max(1000)),
});

// Debug schemas
const SessionStateQuerySchema = z.object({
  tick: z.coerce.number().int().min(0),
});

const SessionIdParamSchema = z.object({
  sessionId: z.string().cuid(),
});

export async function adminRoutes(fastify: FastifyInstance) {
  // Protect all routes in this plugin (auth plugin handles authentication globally)
  fastify.addHook('preHandler', requireAdmin);

  // GET /admin/users - List users
  fastify.get('/users', async (request, reply) => {
    const parseResult = UserListQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid query parameters', details: parseResult.error.flatten() });
    }
    const { page, limit, search } = parseResult.data;
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { username: { contains: search, mode: 'insensitive' as const } },
        { displayName: { contains: search, mode: 'insensitive' as const } },
        { id: { equals: search } }
      ]
    } : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          banned: true,
          createdAt: true,
          lastIdleClaimAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /admin/users/:id - User details
  fastify.get('/users/:id', async (request, reply) => {
    const parseResult = UserIdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        inventory: true,
        progression: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        runs: {
          orderBy: { issuedAt: 'desc' },
          take: 10
        },
        gameSessions: {
          orderBy: { startedAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return user;
  });

  // POST /admin/users/:id/ban - Ban/Unban
  fastify.post('/users/:id/ban', async (request, reply) => {
    const paramsResult = UserIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: paramsResult.error.flatten() });
    }
    const bodyResult = BanUserBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: bodyResult.error.flatten() });
    }
    const { id } = paramsResult.data;
    const { banned } = bodyResult.data;

    const user = await prisma.user.update({
      where: { id },
      data: { banned }
    });

    // If banning, revoke all sessions
    if (banned) {
      await prisma.session.updateMany({
        where: { userId: id },
        data: { revoked: true }
      });
    }

    await createAuditLog(request.userId!, 'BAN_PLAYER', id, { banned });

    return user;
  });

  // POST /admin/users/:id/reset - Reset Progress
  fastify.post('/users/:id/reset', async (request, reply) => {
    const parseResult = UserIdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    const [progression, inventory] = await prisma.$transaction([
      prisma.progression.update({
        where: { userId: id },
        data: { level: 1, xp: 0, totalXp: 0 }
      }),
      prisma.inventory.update({
        where: { userId: id },
        data: { gold: 0, dust: 0, materials: {}, items: {} }
      })
    ]);

    await createAuditLog(request.userId!, 'RESET_PROGRESS', id);

    return { success: true, progression, inventory };
  });

  // POST /admin/users/:id/grant - Grant Rewards
  fastify.post('/users/:id/grant', async (request, reply) => {
    const paramsResult = UserIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: paramsResult.error.flatten() });
    }
    const bodyResult = GrantRewardsBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: bodyResult.error.flatten() });
    }
    const { id } = paramsResult.data;
    const { gold, dust } = bodyResult.data;

    const inventory = await prisma.inventory.update({
      where: { userId: id },
      data: {
        gold: { increment: gold },
        dust: { increment: dust }
      }
    });

    await createAuditLog(request.userId!, 'GRANT_REWARDS', id, { gold, dust });

    return { success: true, inventory };
  });

  // POST /admin/users/:id/grant-artifact - Grant Artifact to player
  fastify.post('/users/:id/grant-artifact', async (request, reply) => {
    const paramsResult = UserIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: paramsResult.error.flatten() });
    }
    const bodyResult = GrantArtifactBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: bodyResult.error.flatten() });
    }
    const { id } = paramsResult.data;
    const { artifactId, level } = bodyResult.data;

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Check if player already has this artifact
    const existingArtifact = await prisma.playerArtifact.findUnique({
      where: { userId_artifactId: { userId: id, artifactId } },
    });

    if (existingArtifact) {
      // Update existing artifact level if higher
      if (level > existingArtifact.level) {
        const updated = await prisma.playerArtifact.update({
          where: { id: existingArtifact.id },
          data: { level, upgradedAt: new Date() },
        });
        await createAuditLog(request.userId!, 'GRANT_ARTIFACT', id, { artifactId, level, action: 'upgraded' });
        return { success: true, artifact: updated, action: 'upgraded' };
      }
      return reply.code(400).send({ error: 'Player already owns this artifact at equal or higher level' });
    }

    // Create new artifact
    const artifact = await prisma.playerArtifact.create({
      data: {
        userId: id,
        artifactId,
        level,
      },
    });

    await createAuditLog(request.userId!, 'GRANT_ARTIFACT', id, { artifactId, level, action: 'created' });

    return { success: true, artifact, action: 'created' };
  });

  // POST /admin/users/:id/grant-materials - Grant Materials to player
  fastify.post('/users/:id/grant-materials', async (request, reply) => {
    const paramsResult = UserIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: paramsResult.error.flatten() });
    }
    const bodyResult = GrantMaterialsBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: bodyResult.error.flatten() });
    }
    const { id } = paramsResult.data;
    const { materials } = bodyResult.data;

    // Get current inventory
    const inventory = await prisma.inventory.findUnique({
      where: { userId: id },
      select: { materials: true },
    });

    if (!inventory) {
      return reply.code(404).send({ error: 'Inventory not found' });
    }

    // Merge materials
    const currentMaterials =
      typeof inventory.materials === 'object' && inventory.materials !== null
        ? (inventory.materials as Record<string, number>)
        : {};

    const updatedMaterials = { ...currentMaterials };
    for (const [materialId, amount] of Object.entries(materials)) {
      updatedMaterials[materialId] = (updatedMaterials[materialId] ?? 0) + amount;
    }

    // Update inventory
    const updated = await prisma.inventory.update({
      where: { userId: id },
      data: { materials: updatedMaterials },
    });

    await createAuditLog(request.userId!, 'GRANT_MATERIALS', id, { materials });

    return { success: true, materials: updated.materials };
  });

  // GET /admin/audit-logs - List audit logs
  fastify.get('/audit-logs', async (request, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid query parameters', details: parseResult.error.flatten() });
    }
    const { page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count()
    ]);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  });

  // GET /admin/config - Get game config
  fastify.get('/config', async (_request, _reply) => {
    return getGameConfig();
  });

  // POST /admin/config/:key - Update game config
  fastify.post('/config/:key', async (request, reply) => {
    const paramsResult = ConfigKeyParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid config key', details: paramsResult.error.flatten() });
    }
    const bodyResult = UpdateConfigBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: bodyResult.error.flatten() });
    }
    const { key } = paramsResult.data;
    const { value, description } = bodyResult.data;

    const config = await updateConfig(key, value, description);
    await createAuditLog(request.userId!, 'UPDATE_CONFIG', key, { value });

    return config;
  });

  // GET /admin/runs/:id/replay-data - Get replay data for a run
  fastify.get('/runs/:id/replay-data', async (request, reply) => {
    const parseResult = IdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid run ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    const run = await prisma.run.findUnique({
      where: { id },
      include: { events: true }
    });

    if (!run) return reply.code(404).send({ error: 'Run not found' });

    // Flatten events data
    const events = run.events.flatMap(e => e.data as unknown[]);

    return {
      seed: run.seed,
      config: run.configJson,
      events,
      tickHz: run.tickHz,
      maxWaves: run.maxWaves
    };
  });

  // GET /admin/sessions/:id/replay-data - Get replay data for an endless session
  fastify.get('/sessions/:id/replay-data', async (request, reply) => {
    const parseResult = IdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid session ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    const session = await prisma.gameSession.findUnique({
      where: { id },
      include: {
        segments: {
          orderBy: { startWave: 'asc' },
          where: { verified: true }
        }
      }
    });

    if (!session) return reply.code(404).send({ error: 'Session not found' });

    // Flatten segment events
    const events = session.segments.flatMap(s => s.eventsJson as unknown[]);

    return {
      seed: session.seed,
      config: session.configJson,
      events,
      startingWave: session.startingWave
    };
  });

  // GET /admin/dashboard/stats - Current system health
  fastify.get('/dashboard/stats', async (_request, _reply) => {
    const stats = await getCurrentMetrics();
    return stats;
  });

  // GET /admin/dashboard/charts - Metrics history for charts
  fastify.get('/dashboard/charts', async (_request, _reply) => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapshots = await prisma.metricSnapshot.findMany({
      where: { timestamp: { gte: twentyFourHoursAgo } },
      orderBy: { timestamp: 'asc' }
    });
    return snapshots;
  });
  
  // GET /admin/events - List all scheduled events
  fastify.get('/events', async (_request, _reply) => {
    return listAllEvents();
  });

  // POST /admin/events - Create new event
  fastify.post('/events', async (request, reply) => {
    const parseResult = CreateEventBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }
    const data = parseResult.data;

    const event = await createScheduledEvent({
      name: data.name,
      type: data.type,
      value: data.value,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      description: data.description,
    });
    await createAuditLog(request.userId!, 'CREATE_EVENT', event.id, data);
    return event;
  });

  // PATCH /admin/events/:id - Update event
  fastify.patch('/events/:id', async (request, reply) => {
    const paramsResult = IdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid event ID', details: paramsResult.error.flatten() });
    }
    const bodyResult = UpdateEventBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: bodyResult.error.flatten() });
    }
    const { id } = paramsResult.data;
    const data = bodyResult.data;

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.value !== undefined) updateData.value = data.value;
    if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
    if (data.endsAt !== undefined) updateData.endsAt = new Date(data.endsAt);
    if (data.description !== undefined) updateData.description = data.description;
    if (data.active !== undefined) updateData.active = data.active;

    const event = await updateScheduledEvent(id, updateData);
    await createAuditLog(request.userId!, 'UPDATE_EVENT', id, data);
    return event;
  });

  // DELETE /admin/events/:id - Delete event
  fastify.delete('/events/:id', async (request, reply) => {
    const parseResult = IdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid event ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    await deleteScheduledEvent(id);
    await createAuditLog(request.userId!, 'DELETE_EVENT', id);
    return { success: true };
  });

  // GET /admin/bulk-rewards - List all bulk rewards
  fastify.get('/bulk-rewards', async (_request, _reply) => {
    return await prisma.bulkReward.findMany({
      orderBy: { createdAt: 'desc' }
    });
  });

  // POST /admin/bulk-rewards - Create new bulk reward
  fastify.post('/bulk-rewards', async (request, reply) => {
    const parseResult = CreateBulkRewardBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }
    const data = parseResult.data;

    const reward = await createBulkReward({
      title: data.title,
      description: data.description,
      type: data.type,
      value: data.value,
      targetType: data.targetType,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    });
    await createAuditLog(request.userId!, 'CREATE_BULK_REWARD', reward.id, data);
    return reward;
  });

  // GET /admin/bug-reports - List bug reports
  fastify.get('/bug-reports', async (request, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid query parameters', details: parseResult.error.flatten() });
    }
    const { page, limit } = parseResult.data;
    return await listBugReports(page, limit);
  });

  // GET /admin/bug-reports/:id - Get bug report details
  fastify.get('/bug-reports/:id', async (request, reply) => {
    const parseResult = IdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid bug report ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    const report = await getBugReport(id);
    if (!report) return reply.code(404).send({ error: 'Bug report not found' });
    return report;
  });

  // GET /admin/debug/session/:sessionId/state - Get simulation state at tick
  fastify.get('/debug/session/:sessionId/state', async (request, reply) => {
    const paramsResult = SessionIdParamSchema.safeParse(request.params);
    if (!paramsResult.success) {
      return reply.code(400).send({ error: 'Invalid session ID', details: paramsResult.error.flatten() });
    }
    const queryResult = SessionStateQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      return reply.code(400).send({ error: 'Invalid query parameters', details: queryResult.error.flatten() });
    }
    const { sessionId } = paramsResult.data;
    const { tick } = queryResult.data;

    try {
      const state = await getSessionStateAtTick(sessionId, tick);
      return state;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return reply.code(500).send({ error: message });
    }
  });

  // ============================================================================
  // SYSTEM BROADCASTS
  // ============================================================================

  // POST /admin/messages/broadcast - Send system broadcast
  fastify.post('/messages/broadcast', async (request, reply) => {
    const parseResult = BroadcastRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid request body', details: parseResult.error.flatten() });
    }
    const { subject, content, targetUsernames } = parseResult.data;

    // If target usernames provided, resolve to user IDs
    let targetUserIds: string[] | undefined;
    if (targetUsernames && targetUsernames.length > 0) {
      const users = await prisma.user.findMany({
        where: { username: { in: targetUsernames } },
        select: { id: true },
      });
      targetUserIds = users.map(u => u.id);

      if (targetUserIds.length === 0) {
        return reply.code(400).send({ error: 'No valid users found' });
      }
    }

    const sentCount = await createSystemBroadcast(subject, content, targetUserIds);

    // Log the broadcast
    await prisma.systemBroadcast.create({
      data: {
        subject,
        content,
        sentById: request.userId!,
        targetCount: sentCount,
      },
    });

    await createAuditLog(request.userId!, 'SEND_BROADCAST', 'SYSTEM', {
      subject,
      targetCount: sentCount,
      isGlobal: !targetUsernames || targetUsernames.length === 0,
    });

    return { success: true, sentCount };
  });

  // GET /admin/messages/history - Get broadcast history
  fastify.get('/messages/history', async (request, reply) => {
    const parseResult = PaginationQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid query parameters', details: parseResult.error.flatten() });
    }
    const { page, limit } = parseResult.data;
    const skip = (page - 1) * limit;

    const [broadcasts, total] = await Promise.all([
      prisma.systemBroadcast.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sentBy: {
            select: { username: true, displayName: true },
          },
        },
      }),
      prisma.systemBroadcast.count(),
    ]);

    return {
      broadcasts: broadcasts.map(b => ({
        id: b.id,
        subject: b.subject,
        content: b.content,
        sentBy: b.sentBy.displayName,
        targetCount: b.targetCount,
        createdAt: b.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  });

  // ============================================================================
  // POWER RECALCULATION
  // ============================================================================

  // POST /admin/power/recalculate-all - Recalculate power for all users with 0 power
  fastify.post('/power/recalculate-all', async (request, _reply) => {
    const updatedCount = await recalculateAllZeroPower();
    await createAuditLog(request.userId!, 'RECALCULATE_POWER', 'ALL_ZERO', { updatedCount });
    return { success: true, updatedCount };
  });

  // POST /admin/users/:id/recalculate-power - Recalculate power for a specific user
  fastify.post('/users/:id/recalculate-power', async (request, reply) => {
    const parseResult = UserIdParamSchema.safeParse(request.params);
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid user ID', details: parseResult.error.flatten() });
    }
    const { id } = parseResult.data;

    const newPower = await recalculateCachedPower(id);
    await createAuditLog(request.userId!, 'RECALCULATE_POWER', id, { newPower });
    return { success: true, newPower };
  });
}
