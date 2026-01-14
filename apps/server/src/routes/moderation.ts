import { FastifyPluginAsync } from 'fastify';
import {
  ReportRequestSchema,
  ReportsQuerySchema,
  ReviewReportRequestSchema,
  MuteUserRequestSchema,
} from '@arcade/protocol';
import {
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportMessage,
  reportThread,
  getPendingReports,
  reviewReport,
  warnUser,
  muteUser,
  unmuteUser,
  getUserSanctions,
} from '../services/moderation.js';

const MODERATION_ERRORS = {
  UNAUTHORIZED: 'Brak autoryzacji',
  ADMIN_REQUIRED: 'Ta operacja wymaga uprawnień administratora',
} as const;

const moderationRoutes: FastifyPluginAsync = async (fastify) => {
  // ============================================================================
  // PLAYER ROUTES - REPORTS
  // ============================================================================

  // Report a message or thread
  fastify.post('/v1/moderation/report', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    try {
      const body = ReportRequestSchema.parse(request.body);

      if (body.messageId) {
        await reportMessage(request.userId, body.messageId, body.reason, body.details);
      } else if (body.threadId) {
        await reportThread(request.userId, body.threadId, body.reason, body.details);
      }

      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // ============================================================================
  // PLAYER ROUTES - BLOCKING
  // ============================================================================

  // Block a user
  fastify.post('/v1/moderation/block/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    try {
      const { userId: blockedId } = request.params as { userId: string };
      await blockUser(request.userId, blockedId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Unblock a user
  fastify.delete('/v1/moderation/block/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    const { userId: blockedId } = request.params as { userId: string };
    await unblockUser(request.userId, blockedId);
    return reply.send({ success: true });
  });

  // Get blocked users
  fastify.get('/v1/moderation/blocked', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    const blockedUsers = await getBlockedUsers(request.userId);
    return reply.send({ blockedUsers });
  });

  // ============================================================================
  // ADMIN ROUTES - REPORTS
  // ============================================================================

  // Get pending reports
  fastify.get('/v1/moderation/reports', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    // Check admin role
    if (!request.isAdmin) {
      return reply.status(403).send({ error: MODERATION_ERRORS.ADMIN_REQUIRED });
    }

    const query = ReportsQuerySchema.parse(request.query);
    const result = await getPendingReports(query.status, query.limit, query.offset);
    return reply.send(result);
  });

  // Review a report
  fastify.patch('/v1/moderation/reports/:reportId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    if (!request.isAdmin) {
      return reply.status(403).send({ error: MODERATION_ERRORS.ADMIN_REQUIRED });
    }

    try {
      const { reportId } = request.params as { reportId: string };
      const body = ReviewReportRequestSchema.parse(request.body);
      await reviewReport(reportId, request.userId, body.action, body.notes);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // ============================================================================
  // ADMIN ROUTES - SANCTIONS
  // ============================================================================

  // Warn a user
  fastify.post('/v1/moderation/warn/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    if (!request.isAdmin) {
      return reply.status(403).send({ error: MODERATION_ERRORS.ADMIN_REQUIRED });
    }

    try {
      const { userId: targetUserId } = request.params as { userId: string };
      const { reason, details } = request.body as { reason: string; details?: string };
      await warnUser(targetUserId, reason, request.userId, details);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Mute a user
  fastify.post('/v1/moderation/mute/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    if (!request.isAdmin) {
      return reply.status(403).send({ error: MODERATION_ERRORS.ADMIN_REQUIRED });
    }

    try {
      const { userId: targetUserId } = request.params as { userId: string };
      const body = MuteUserRequestSchema.parse(request.body);
      const duration = body.duration === 'permanent' ? null : body.duration;
      await muteUser(targetUserId, duration, body.reason, request.userId, body.details);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Unmute a user
  fastify.delete('/v1/moderation/mute/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    if (!request.isAdmin) {
      return reply.status(403).send({ error: MODERATION_ERRORS.ADMIN_REQUIRED });
    }

    try {
      const { userId: targetUserId } = request.params as { userId: string };
      await unmuteUser(targetUserId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Get user sanctions history
  fastify.get('/v1/moderation/sanctions/:userId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MODERATION_ERRORS.UNAUTHORIZED });
    }

    if (!request.isAdmin) {
      return reply.status(403).send({ error: MODERATION_ERRORS.ADMIN_REQUIRED });
    }

    const { userId: targetUserId } = request.params as { userId: string };
    const sanctions = await getUserSanctions(targetUserId);
    return reply.send(sanctions);
  });
};

export default moderationRoutes;
