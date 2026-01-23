import { FastifyPluginAsync } from 'fastify';
import {
  ThreadsQuerySchema,
  ComposeThreadRequestSchema,
  ReplyThreadRequestSchema,
  AddParticipantRequestSchema,
  SearchUsersQuerySchema,
} from '@arcade/protocol';
import {
  getUserThreads,
  getThread,
  createThread,
  replyToThread,
  addParticipant,
  leaveThread,
  markThreadRead,
  deleteThread,
  getUnreadCounts,
  searchUsers,
} from '../services/messages.js';

const MESSAGE_ERRORS = {
  THREAD_NOT_FOUND: 'Wątek nie istnieje',
  UNAUTHORIZED: 'Brak autoryzacji',
} as const;

const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  // Helper to check if guest user is trying to send messages
  const requireRegistration = (request: any, reply: any): boolean => {
    if (request.isGuest) {
      reply.status(403).send({
        error: 'Registration required',
        code: 'REGISTRATION_REQUIRED',
        message: 'Create an account to send messages'
      });
      return false;
    }
    return true;
  };

  // ============================================================================
  // THREADS
  // ============================================================================

  // Get user's threads
  fastify.get('/v1/messages/threads', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    const query = ThreadsQuerySchema.parse(request.query);
    const result = await getUserThreads(request.userId, query.type, query.limit, query.offset);
    return reply.send(result);
  });

  // Get thread by ID
  fastify.get('/v1/messages/threads/:threadId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    const { threadId } = request.params as { threadId: string };
    const thread = await getThread(threadId, request.userId);

    if (!thread) {
      return reply.status(404).send({ error: MESSAGE_ERRORS.THREAD_NOT_FOUND });
    }

    return reply.send({ thread });
  });

  // Create new thread
  fastify.post('/v1/messages/threads', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }
    if (!requireRegistration(request, reply)) return;

    try {
      const body = ComposeThreadRequestSchema.parse(request.body);
      const thread = await createThread(
        request.userId,
        body.recipientUsernames,
        body.subject,
        body.content
      );
      return reply.send({ thread });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Reply to thread
  fastify.post('/v1/messages/threads/:threadId/reply', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }
    if (!requireRegistration(request, reply)) return;

    try {
      const { threadId } = request.params as { threadId: string };
      const body = ReplyThreadRequestSchema.parse(request.body);
      const message = await replyToThread(threadId, request.userId, body.content);
      return reply.send({ message });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Add participant to group
  fastify.post('/v1/messages/threads/:threadId/participants', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }
    if (!requireRegistration(request, reply)) return;

    try {
      const { threadId } = request.params as { threadId: string };
      const body = AddParticipantRequestSchema.parse(request.body);
      const participant = await addParticipant(threadId, body.username, request.userId);
      return reply.send({ participant });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Leave group thread
  fastify.delete('/v1/messages/threads/:threadId/leave', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    try {
      const { threadId } = request.params as { threadId: string };
      await leaveThread(threadId, request.userId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  });

  // Mark thread as read
  fastify.patch('/v1/messages/threads/:threadId/read', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    const { threadId } = request.params as { threadId: string };
    await markThreadRead(threadId, request.userId);
    return reply.send({ success: true });
  });

  // Delete thread (soft delete for user)
  fastify.delete('/v1/messages/threads/:threadId', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    const { threadId } = request.params as { threadId: string };
    await deleteThread(threadId, request.userId);
    return reply.send({ success: true });
  });

  // ============================================================================
  // UNREAD COUNTS
  // ============================================================================

  // Get unread counts
  fastify.get('/v1/messages/unread-count', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    const counts = await getUnreadCounts(request.userId);
    return reply.send(counts);
  });

  // ============================================================================
  // USER SEARCH
  // ============================================================================

  // Search users for messaging
  fastify.get('/v1/messages/search-users', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: MESSAGE_ERRORS.UNAUTHORIZED });
    }

    const query = SearchUsersQuerySchema.parse(request.query);
    const users = await searchUsers(query.q, request.userId, query.limit);
    return reply.send({ users });
  });
};

export default messagesRoutes;
