import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { createAuditLog } from '../services/adminAudit.js';
import { getGameConfig, updateConfig } from '../services/gameConfig.js';
import { getCurrentMetrics } from '../services/metrics.js';
import { listAllEvents, createScheduledEvent, updateScheduledEvent, deleteScheduledEvent } from '../services/events.js';
import { createBulkReward } from '../services/bulkRewards.js';
import { listBugReports, getBugReport } from '../services/bugReports.js';
import { getSessionStateAtTick } from '../services/debug.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // Protect all routes in this plugin (auth plugin handles authentication globally)
  fastify.addHook('preHandler', requireAdmin);

  // GET /admin/users - List users
  fastify.get('/users', async (request, _reply) => {
    const { page = 1, limit = 20, search } = request.query as { page?: number, limit?: number, search?: string };
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

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
        take,
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

    return { users, total, page: Number(page), totalPages: Math.ceil(total / take) };
  });

  // GET /admin/users/:id - User details
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
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
  fastify.post('/users/:id/ban', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const { banned } = request.body as { banned: boolean };

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
  fastify.post('/users/:id/reset', async (request, _reply) => {
    const { id } = request.params as { id: string };
    
    // Reset progression to level 1, 0 xp
    // Reset inventory (keep unlocks? Plan said "reset user progression and inventory")
    // Let's reset gold/dust/sigils to 0, but maybe keep unlocks or not? 
    // "Reset Player Account" usually implies a hard reset or just progress.
    // Based on typical admin needs: Resetting progress usually means starting over.
    
    const [progression, inventory] = await prisma.$transaction([
      prisma.progression.update({
        where: { userId: id },
        data: { level: 1, xp: 0, totalXp: 0 }
      }),
      prisma.inventory.update({
        where: { userId: id },
        data: { gold: 0, dust: 0, sigils: 0, materials: {}, items: {} } // Resetting consumables
      })
    ]);

    await createAuditLog(request.userId!, 'RESET_PROGRESS', id);

    return { success: true, progression, inventory };
  });

  // POST /admin/users/:id/grant - Grant Rewards
  fastify.post('/users/:id/grant', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const { gold = 0, dust = 0 } = request.body as { gold?: number, dust?: number };

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

  // GET /admin/audit-logs - List audit logs
  fastify.get('/audit-logs', async (request, _reply) => {
    const { page = 1, limit = 50 } = request.query as { page?: number, limit?: number };
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count()
    ]);

    return { logs, total, page: Number(page), totalPages: Math.ceil(total / take) };
  });

  // GET /admin/config - Get game config
  fastify.get('/config', async (_request, _reply) => {
    return getGameConfig();
  });

  // POST /admin/config/:key - Update game config
  fastify.post('/config/:key', async (request, _reply) => {
    const { key } = request.params as { key: string };
    const { value, description } = request.body as { value: any, description?: string };

    const config = await updateConfig(key, value, description);
    await createAuditLog(request.userId!, 'UPDATE_CONFIG', key, { value });

    return config;
  });

  // GET /admin/runs/:id/replay-data - Get replay data for a run
  fastify.get('/runs/:id/replay-data', async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await prisma.run.findUnique({
      where: { id },
      include: { events: true }
    });

    if (!run) return reply.code(404).send({ error: 'Run not found' });

    // Flatten events data
    const events = run.events.flatMap(e => e.data as any[]);

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
    const { id } = request.params as { id: string };
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
    const events = session.segments.flatMap(s => s.eventsJson as any[]);

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
  fastify.post('/events', async (request, _reply) => {
    const data = request.body as any;
    // Basic validation
    if (!data.name || !data.type || !data.value || !data.startsAt || !data.endsAt) {
      throw new Error('Missing required fields');
    }
    const event = await createScheduledEvent({
        ...data,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        value: Number(data.value)
    });
    await createAuditLog(request.userId!, 'CREATE_EVENT', event.id, data);
    return event;
  });

  // PATCH /admin/events/:id - Update event
  fastify.patch('/events/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const upd: any = { ...data };
    if (data.startsAt) upd.startsAt = new Date(data.startsAt);
    if (data.endsAt) upd.endsAt = new Date(data.endsAt);
    if (data.value) upd.value = Number(data.value);
    
    const event = await updateScheduledEvent(id, upd);
    await createAuditLog(request.userId!, 'UPDATE_EVENT', id, data);
    return event;
  });

  // DELETE /admin/events/:id - Delete event
  fastify.delete('/events/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
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
  fastify.post('/bulk-rewards', async (request, _reply) => {
    const data = request.body as any;
    if (!data.title || !data.type || !data.value) {
      throw new Error('Missing required fields');
    }
    const reward = await createBulkReward({
      ...data,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    });
    await createAuditLog(request.userId!, 'CREATE_BULK_REWARD', reward.id, data);
    return reward;
  });

  // GET /admin/bug-reports - List bug reports
  fastify.get('/bug-reports', async (request, _reply) => {
    const { page = 1, limit = 20 } = request.query as { page?: number, limit?: number };
    return await listBugReports(Number(page), Number(limit));
  });

  // GET /admin/bug-reports/:id - Get bug report details
  fastify.get('/bug-reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const report = await getBugReport(id);
    if (!report) return reply.code(404).send({ error: 'Bug report not found' });
    return report;
  });

  // GET /admin/debug/session/:sessionId/state - Get simulation state at tick
  fastify.get('/debug/session/:sessionId/state', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { tick } = request.query as { tick: string };
    
    if (!tick) return reply.code(400).send({ error: 'Missing tick parameter' });
    
    try {
      const state = await getSessionStateAtTick(sessionId, Number(tick));
      return state;
    } catch (error: any) {
      return reply.code(500).send({ error: error.message });
    }
  });
}
