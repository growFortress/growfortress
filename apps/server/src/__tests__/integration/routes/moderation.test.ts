/**
 * Moderation Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockUser } from '../../mocks/prisma.js';
import '../../helpers/setup.js';

// Mock the websocket module to avoid WebSocket broadcast issues
vi.mock('../../../services/websocket.js', () => ({
  broadcastToUser: vi.fn(),
}));

// Mock the messages service to avoid complex dependencies
vi.mock('../../../services/messages.js', () => ({
  createSystemMessage: vi.fn().mockResolvedValue('thread-123'),
}));

// Helper to create mock message report
function createMockMessageReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-123',
    reporterId: 'user-456',
    threadId: 'thread-123',
    messageId: 'msg-123',
    reason: 'SPAM',
    details: 'Test report details',
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    actionTaken: null,
    createdAt: new Date(),
    reporter: { username: 'reporter' },
    reviewer: null,
    message: {
      content: 'Reported message content',
      senderId: 'user-789',
      sender: { username: 'sender' },
    },
    thread: { subject: 'Test Thread' },
    ...overrides,
  };
}

// Helper to create mock user block
function createMockUserBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-123',
    blockerId: 'user-123',
    blockedId: 'user-456',
    createdAt: new Date(),
    blocked: {
      id: 'user-456',
      username: 'blockeduser',
      displayName: 'Blocked User',
    },
    ...overrides,
  };
}

describe('Moderation Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    // Register moderation routes
    const moderationRoutes = await import('../../../routes/moderation.js');
    await app.register(moderationRoutes.default);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // POST /v1/moderation/block/:userId - Block a user
  // ============================================================================

  describe('POST /v1/moderation/block/:userId', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/block/user-456',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should block a user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(createMockUser({ id: 'user-456' }));
      mockPrisma.userBlock.upsert.mockResolvedValue(createMockUserBlock());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/block/user-456',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockPrisma.userBlock.upsert).toHaveBeenCalled();
    });

    it('should reject blocking self', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/block/user-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('siebie');
    });

    it('should return 400 when user to block does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/block/nonexistent',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('nie istnieje');
    });
  });

  // ============================================================================
  // DELETE /v1/moderation/block/:userId - Unblock a user
  // ============================================================================

  describe('DELETE /v1/moderation/block/:userId', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/moderation/block/user-456',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should unblock a user successfully', async () => {
      mockPrisma.userBlock.deleteMany.mockResolvedValue({ count: 1 });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/moderation/block/user-456',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockPrisma.userBlock.deleteMany).toHaveBeenCalledWith({
        where: { blockerId: 'user-123', blockedId: 'user-456' },
      });
    });
  });

  // ============================================================================
  // GET /v1/moderation/blocked - Get blocked users list
  // ============================================================================

  describe('GET /v1/moderation/blocked', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/blocked',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return blocked users list', async () => {
      mockPrisma.userBlock.findMany.mockResolvedValue([
        createMockUserBlock({ id: 'block-1' }),
        createMockUserBlock({ id: 'block-2', blockedId: 'user-789' }),
      ]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/blocked',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.blockedUsers).toBeDefined();
      expect(Array.isArray(body.blockedUsers)).toBe(true);
      expect(body.blockedUsers.length).toBe(2);
    });

    it('should return empty list when no users blocked', async () => {
      mockPrisma.userBlock.findMany.mockResolvedValue([]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/blocked',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.blockedUsers).toEqual([]);
    });
  });

  // ============================================================================
  // POST /v1/moderation/report - Report a message or thread
  // ============================================================================

  describe('POST /v1/moderation/report', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/report',
        payload: { messageId: 'msg-123', reason: 'SPAM' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should create a report for a message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-123',
        threadId: 'thread-123',
        thread: { id: 'thread-123' },
      });
      mockPrisma.messageReport.findFirst.mockResolvedValue(null);
      mockPrisma.messageReport.create.mockResolvedValue(createMockMessageReport());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/report',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          messageId: 'msg-123',
          reason: 'SPAM',
          details: 'This is spam content',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(mockPrisma.messageReport.create).toHaveBeenCalled();
    });

    it('should create a report for a thread', async () => {
      mockPrisma.messageThread.findUnique.mockResolvedValue({
        id: 'thread-123',
        subject: 'Test Thread',
      });
      mockPrisma.messageReport.findFirst.mockResolvedValue(null);
      mockPrisma.messageReport.create.mockResolvedValue(createMockMessageReport({ messageId: null }));

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/report',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          threadId: 'thread-123',
          reason: 'HARASSMENT',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('should reject duplicate reports', async () => {
      mockPrisma.message.findUnique.mockResolvedValue({
        id: 'msg-123',
        threadId: 'thread-123',
        thread: { id: 'thread-123' },
      });
      mockPrisma.messageReport.findFirst.mockResolvedValue(createMockMessageReport());

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/report',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          messageId: 'msg-123',
          reason: 'SPAM',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Ju');
    });

    it('should return 400 for non-existent message', async () => {
      mockPrisma.message.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/report',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          messageId: 'nonexistent',
          reason: 'SPAM',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('nie istnieje');
    });
  });

  // ============================================================================
  // ADMIN ROUTES - GET /v1/moderation/reports
  // ============================================================================

  describe('GET /v1/moderation/reports (Admin)', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/reports',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/reports',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('administratora');
    });
  });

  // ============================================================================
  // ADMIN ROUTES - PATCH /v1/moderation/reports/:reportId
  // ============================================================================

  describe('PATCH /v1/moderation/reports/:reportId (Admin)', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/moderation/reports/report-123',
        payload: { action: 'dismiss' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'PATCH',
        url: '/v1/moderation/reports/report-123',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { action: 'dismiss' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('administratora');
    });
  });

  // ============================================================================
  // ADMIN ROUTES - POST /v1/moderation/warn/:userId
  // ============================================================================

  describe('POST /v1/moderation/warn/:userId (Admin)', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/warn/user-789',
        payload: { reason: 'Test warning' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/warn/user-789',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { reason: 'Test warning' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('administratora');
    });
  });

  // ============================================================================
  // ADMIN ROUTES - POST /v1/moderation/mute/:userId
  // ============================================================================

  describe('POST /v1/moderation/mute/:userId (Admin)', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/mute/user-789',
        payload: { reason: 'SPAM', duration: '24h' },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/moderation/mute/user-789',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: { reason: 'SPAM', duration: '24h' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('administratora');
    });
  });

  // ============================================================================
  // ADMIN ROUTES - DELETE /v1/moderation/mute/:userId
  // ============================================================================

  describe('DELETE /v1/moderation/mute/:userId (Admin)', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/moderation/mute/user-789',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'DELETE',
        url: '/v1/moderation/mute/user-789',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('administratora');
    });
  });

  // ============================================================================
  // ADMIN ROUTES - GET /v1/moderation/sanctions/:userId
  // ============================================================================

  describe('GET /v1/moderation/sanctions/:userId (Admin)', () => {
    it('should require authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/sanctions/user-789',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should require admin role', async () => {
      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/moderation/sanctions/user-789',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('administratora');
    });
  });
});
