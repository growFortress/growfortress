/**
 * Integration tests for pillar challenge routes
 * Tests challenge session lifecycle, crystal crafting, and matrix assembly.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory, createMockPillarChallengeSession, createMockPillarChallengeLimits, createMockCrystalProgress } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Pillar Challenge Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /challenge/status', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/challenge/status',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return challenge status for authenticated user', async () => {
      // Mock player progress (pillar challenge sessions for getPlayerProgress)
      mockPrisma.pillarChallengeSession.findMany.mockResolvedValue([]);

      // Mock daily limits
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(
        createMockPillarChallengeLimits()
      );

      // Mock crystal progress
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress()
      );

      const response = await app.inject({
        method: 'GET',
        url: '/challenge/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.limits).toBeDefined();
      expect(body.crystalProgress).toBeDefined();
      expect(body.progress).toBeDefined();
      expect(body.unlockedTiers).toBeDefined();
    });
  });

  describe('POST /challenge/start', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/start',
        payload: {
          pillarId: 'streets',
          tier: 'normal',
          loadout: {
            fortressClass: 'natural',
            heroes: [{ heroId: 'vanguard', artifacts: [] }],
            turrets: [{ turretId: 'railgun', slotIndex: 0 }],
          },
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/start',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          pillarId: 'invalid',
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when daily limit reached', async () => {
      // No active session
      mockPrisma.pillarChallengeSession.findFirst.mockResolvedValue(null);

      // Mock limits with all attempts used
      const limits = createMockPillarChallengeLimits({
        dailyAttempts: 3, // Max free attempts used
        dailyPaidAttempts: 2, // Max paid attempts used
      });
      mockPrisma.pillarChallengeLimits.findUnique.mockResolvedValue(limits);

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/start',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          pillarId: 'streets',
          tier: 'normal',
          loadout: {
            fortressClass: 'natural',
            heroes: [{ heroId: 'vanguard', artifacts: [] }],
            turrets: [{ turretId: 'railgun', slotIndex: 0 }],
          },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /challenge/submit', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/submit',
        payload: {
          sessionId: 'pcs-123',
          events: [],
          checkpoints: {},
          finalHash: 12345,
          result: { wavesCleared: 10, fortressDamageTaken: 0 },
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/submit',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          sessionId: 'pcs-123',
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when session not found', async () => {
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/submit',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          sessionId: 'non-existent-session',
          events: [],
          checkpoints: {},
          finalHash: 12345,
          result: { wavesCleared: 10, fortressDamageTaken: 0 },
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /challenge/abandon', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/abandon',
        payload: {
          sessionId: 'pcs-123',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with missing sessionId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/abandon',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when session not found', async () => {
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/abandon',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          sessionId: 'non-existent-session',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should successfully abandon active session', async () => {
      const mockSession = createMockPillarChallengeSession();
      mockPrisma.pillarChallengeSession.findUnique.mockResolvedValue(mockSession);
      mockPrisma.pillarChallengeSession.update.mockResolvedValue({
        ...mockSession,
        endedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/abandon',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          sessionId: mockSession.id,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });

  describe('GET /challenge/rewards/preview', () => {
    it('should return 400 with missing query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/challenge/rewards/preview',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 with invalid pillarId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/challenge/rewards/preview?pillarId=invalid&tier=normal',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return rewards preview for valid params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/challenge/rewards/preview?pillarId=streets&tier=normal',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.baseFragments).toBeDefined();
      expect(body.crystalTypes).toBeDefined();
      expect(body.performanceBonuses).toBeDefined();
    });
  });

  describe('GET /challenge/leaderboard', () => {
    it('should return 400 with missing query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/challenge/leaderboard',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return leaderboard for valid params', async () => {
      mockPrisma.pillarChallengeSession.findMany.mockResolvedValue([]);
      mockPrisma.pillarChallengeSession.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/challenge/leaderboard?pillarId=streets&tier=normal',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.entries).toBeDefined();
    });
  });

  describe('POST /challenge/crystal/craft', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/crystal/craft',
        payload: {
          crystalType: 'power',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid crystal type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/crystal/craft',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          crystalType: 'invalid',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when insufficient fragments', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ powerFragments: 5 }) // Need 10
      );

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/crystal/craft',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          crystalType: 'power',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should successfully craft crystal with enough fragments', async () => {
      const crystalProgress = createMockCrystalProgress({ powerFragments: 10 });
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(crystalProgress);
      mockPrisma.crystalProgress.update.mockResolvedValue({
        ...crystalProgress,
        powerFragments: 0,
        fullCrystals: ['power'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/crystal/craft',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          crystalType: 'power',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /challenge/matrix/assemble', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/challenge/matrix/assemble',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return error when missing crystals', async () => {
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(
        createMockCrystalProgress({ fullCrystals: ['power', 'space'] }) // Missing 4 crystals
      );

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/matrix/assemble',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should successfully assemble matrix with all crystals', async () => {
      const crystalProgress = createMockCrystalProgress({
        fullCrystals: ['power', 'space', 'time', 'reality', 'soul', 'mind'],
      });
      mockPrisma.crystalProgress.findUnique.mockResolvedValue(crystalProgress);
      mockPrisma.crystalProgress.update.mockResolvedValue({
        ...crystalProgress,
        matrixAssembled: true,
      });

      // Mock inventory for rewards
      const mockInventory = createMockInventory();
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/challenge/matrix/assemble',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });
});
