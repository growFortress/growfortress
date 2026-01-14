/**
 * Sessions Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import {
  mockPrisma,
  createMockUser,
  createMockInventory,
  createMockProgression,
  createMockGameSession,
} from '../../mocks/prisma.js';
import { vi } from 'vitest';

describe('Sessions Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /v1/sessions/start', () => {
    it('should start a new session without relics', async () => {
      const mockUser = createMockUser({ activeGameSessionId: null });
      const mockInventory = createMockInventory({ gold: 500 });
      const mockProgression = createMockProgression({ level: 1 });

      // Auth plugin role check
      mockPrisma.user.findUnique.mockResolvedValueOnce({ role: 'USER' });

      // Profile lookup (getUserProfile)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        inventory: mockInventory,
        progression: mockProgression,
      });

      // User lookup for session creation (startGameSession)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        inventory: mockInventory,
        activeGameSessionId: null,
      });

      // GameConfig lookup
      mockPrisma.gameConfig.findMany.mockResolvedValue([]);

      // Game session creation
      const mockSession = createMockGameSession();
      mockPrisma.gameSession.create.mockResolvedValue(mockSession);

      // User update for active session
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, activeGameSessionId: mockSession.id });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions/start',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toBeDefined();
      expect(body.sessionToken).toBeDefined();
      expect(body.seed).toBeDefined();
    });

    it('should reject session start without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions/start',
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /v1/sessions/active', () => {
    it('should return active session for user', async () => {
      const mockUser = createMockUser({ activeGameSessionId: 'gs-123' });
      const mockSession = createMockGameSession();

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.gameSession.findUnique.mockResolvedValue(mockSession);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/sessions/active',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.sessionId).toBeDefined();
    });

    it('should return 404 when no active session', async () => {
      const mockUser = createMockUser({ activeGameSessionId: null });

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/sessions/active',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should reject request without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/sessions/active',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /v1/sessions/:sessionId/end', () => {
    it('should end active session', async () => {
      const mockUser = createMockUser({ highestWave: 10 });
      const mockSession = createMockGameSession({ currentWave: 5 });
      const mockInventory = createMockInventory();
      const mockProgression = createMockProgression();

      // Auth plugin role check
      mockPrisma.user.findUnique.mockResolvedValueOnce({ role: 'USER' });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [], // Include required segments array
        user: {
          ...mockUser,
          inventory: mockInventory,
          progression: mockProgression,
        },
      });

      // endGameSession needs progression.findUnique
      mockPrisma.progression.findUnique.mockResolvedValue(mockProgression);

      // $transaction mock - execute the callback and return its result
      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        if (typeof callback === 'function') {
          return callback(mockPrisma);
        }
        return [];
      });

      mockPrisma.gameSession.update.mockResolvedValue({
        ...mockSession,
        endedAt: new Date(),
        endReason: 'player_ended',
      });
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);
      mockPrisma.progression.update.mockResolvedValue(mockProgression);
      // inventory.findUnique is called inside the transaction
      mockPrisma.inventory.findUnique.mockResolvedValue({ gold: 500, dust: 100 });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions/gs-123/end',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          reason: 'player_ended',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.finalWave).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      mockPrisma.gameSession.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions/non-existent/end',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          reason: 'player_ended',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 403 when session belongs to another user', async () => {
      const mockUser = createMockUser({ id: 'user-999' });
      const mockSession = createMockGameSession({ userId: 'user-999' });

      mockPrisma.gameSession.findUnique.mockResolvedValue({
        ...mockSession,
        segments: [],
        user: mockUser,
      });

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions/gs-123/end',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          reason: 'player_ended',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should reject request without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions/gs-123/end',
        payload: {
          reason: 'player_ended',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
