/**
 * Integration tests for daily quests routes
 * Tests quest progress retrieval, reward claiming, and bulk claiming.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

// Helper to get current reset time (midnight UTC today)
function getCurrentResetTime(): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
}

// Helper to create a mock daily quest progress record
function createMockDailyQuestProgress(overrides: {
  questId?: string;
  progress?: number;
  completed?: boolean;
  claimed?: boolean;
} = {}) {
  const currentReset = getCurrentResetTime();
  return {
    id: `dqp-${overrides.questId || 'first_blood'}`,
    userId: 'user-123',
    questId: overrides.questId || 'first_blood',
    progress: overrides.progress ?? 0,
    completed: overrides.completed ?? false,
    claimed: overrides.claimed ?? false,
    resetAt: currentReset,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('Daily Quests Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/daily-quests', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/daily-quests',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return daily quests for authenticated user', async () => {
      // Mock findMany to return quest progress records
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([
        createMockDailyQuestProgress({ questId: 'first_blood', progress: 1, completed: true }),
        createMockDailyQuestProgress({ questId: 'wave_hunter', progress: 50, completed: false }),
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/daily-quests',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.quests).toBeDefined();
      expect(body.resetAt).toBeDefined();
    });

    it('should return default quests for new user', async () => {
      // No progress records exist
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/daily-quests',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.quests).toBeDefined();
      expect(Array.isArray(body.quests)).toBe(true);
    });
  });

  describe('POST /v1/daily-quests/:questId/claim', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/first_blood/claim',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 for invalid quest ID', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/invalid_quest_id/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when quest not completed', async () => {
      // Quest exists but not completed
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue(
        createMockDailyQuestProgress({ questId: 'first_blood', progress: 0, completed: false })
      );

      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/first_blood/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should return error when quest already claimed', async () => {
      // Quest completed and already claimed
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue(
        createMockDailyQuestProgress({ questId: 'first_blood', progress: 1, completed: true, claimed: true })
      );

      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/first_blood/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });

    it('should successfully claim completed quest reward', async () => {
      // Quest completed but not claimed
      const questProgress = createMockDailyQuestProgress({
        questId: 'first_blood',
        progress: 1,
        completed: true,
        claimed: false,
      });
      mockPrisma.dailyQuestProgress.findUnique.mockResolvedValue(questProgress);

      // Mock inventory for reward distribution
      const mockInventory = createMockInventory();
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        dust: mockInventory.dust + 50,
      });

      // Mock the claim update
      mockPrisma.dailyQuestProgress.update.mockResolvedValue({
        ...questProgress,
        claimed: true,
      });

      // Mock battle pass points (called by claimQuestReward)
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/first_blood/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /v1/daily-quests/claim-all', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/claim-all',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return error when no claimable quests', async () => {
      // No quest progress records (new user) - returns completed: true, claimed: false quests only
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue([]);

      // Mock inventory lookup for the error response
      const mockInventory = createMockInventory();
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/claim-all',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Service returns success: false when no quests to claim, route returns 400
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.claimedCount).toBe(0);
    });

    it('should claim all completed quests', async () => {
      // Only completed unclaimed quests are returned by findMany filter
      const questProgresses = [
        createMockDailyQuestProgress({ questId: 'first_blood', progress: 1, completed: true, claimed: false }),
        createMockDailyQuestProgress({ questId: 'wave_hunter', progress: 100, completed: true, claimed: false }),
      ];
      mockPrisma.dailyQuestProgress.findMany.mockResolvedValue(questProgresses);

      // Mock inventory
      const mockInventory = createMockInventory();
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.inventory.update.mockResolvedValue({
        ...mockInventory,
        dust: mockInventory.dust + 100,
      });

      // Mock bulk update for claims
      mockPrisma.dailyQuestProgress.updateMany.mockResolvedValue({ count: 2 });

      // Mock battle pass (called during claim)
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/daily-quests/claim-all',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.claimedCount).toBeDefined();
      expect(body.claimedCount).toBe(2);
    });
  });
});
