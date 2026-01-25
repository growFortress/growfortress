/**
 * Integration tests for battlepass routes
 * Tests battle pass progress, reward claiming, tier purchasing, and premium upgrade.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockBattlePassSeason, createMockBattlePassProgress, createMockInventory } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Battle Pass Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/battlepass', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/battlepass',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 when no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/battlepass',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return battle pass progress for authenticated user', async () => {
      const mockSeason = createMockBattlePassSeason();
      const mockProgress = createMockBattlePassProgress();

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(mockProgress);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/battlepass',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.season).toBeDefined();
      expect(body.progress).toBeDefined();
    });
  });

  describe('POST /v1/battlepass/claim', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/claim',
        payload: {
          tier: 1,
          track: 'free',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 'invalid',
          track: 'free',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 with invalid track', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 1,
          track: 'invalid_track',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when tier not reached', async () => {
      const mockSeason = createMockBattlePassSeason();
      const mockProgress = createMockBattlePassProgress({ currentTier: 0 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(mockProgress);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/claim',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tier: 5, // User is at tier 0
          track: 'free',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /v1/battlepass/claim-all', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/claim-all',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should claim all available rewards', async () => {
      const mockSeason = createMockBattlePassSeason();
      const mockProgress = createMockBattlePassProgress({
        currentTier: 5,
        claimedFreeTiers: [],
      });
      const mockInventory = createMockInventory();

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(mockProgress);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);
      mockPrisma.battlePassProgress.update.mockResolvedValue({
        ...mockProgress,
        claimedFreeTiers: [1, 2, 3, 4, 5],
      });
      mockPrisma.inventory.update.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/claim-all',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.claimedRewards).toBeDefined();
    });
  });

  describe('POST /v1/battlepass/purchase-tier', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/purchase-tier',
        payload: {
          tierCount: 1,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid tier count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/purchase-tier',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tierCount: 0,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 with missing tier count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/purchase-tier',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when insufficient dust', async () => {
      const mockSeason = createMockBattlePassSeason();
      const mockProgress = createMockBattlePassProgress({ currentTier: 0 });
      const mockInventory = createMockInventory({ dust: 0 });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(mockProgress);
      mockPrisma.inventory.findUnique.mockResolvedValue(mockInventory);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/purchase-tier',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          tierCount: 10,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /v1/battlepass/upgrade-premium', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/upgrade-premium',
        payload: {},
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return error when no active season', async () => {
      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/upgrade-premium',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when already premium', async () => {
      const mockSeason = createMockBattlePassSeason();
      const mockProgress = createMockBattlePassProgress({ isPremium: true });

      mockPrisma.battlePassSeason.findFirst.mockResolvedValue(mockSeason);
      mockPrisma.battlePassProgress.findUnique.mockResolvedValue(mockProgress);

      const response = await app.inject({
        method: 'POST',
        url: '/v1/battlepass/upgrade-premium',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });
  });
});
