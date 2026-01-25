/**
 * Integration tests for gacha routes
 * Tests banner retrieval, gacha pulls, spark redemption, and pull history.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { GachaType } from '@prisma/client';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma, createMockInventory } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Gacha Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/gacha/banners', () => {
    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/banners',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return active banners for authenticated user', async () => {
      const now = new Date();
      const mockBanners = [
        {
          id: 'banner-1',
          name: 'Standard Hero Banner',
          description: 'Standard hero gacha banner',
          gachaType: GachaType.HERO,
          featuredItems: ['storm', 'vanguard'],
          rateUpMultiplier: 1.5,
          startsAt: new Date(now.getTime() - 86400000),
          endsAt: new Date(now.getTime() + 86400000),
          isActive: true,
          priority: 1,
          imageUrl: 'https://example.com/banner.png',
          createdAt: now,
          updatedAt: now,
        },
      ];

      mockPrisma.gachaBanner.findMany.mockResolvedValue(mockBanners);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/banners',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.banners).toBeDefined();
      expect(body.banners).toHaveLength(1);
      expect(body.banners[0].name).toBe('Standard Hero Banner');
    });

    it('should filter banners by type when provided', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/banners?type=hero',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.gachaBanner.findMany).toHaveBeenCalled();
    });

    it('should handle artifact type filter', async () => {
      mockPrisma.gachaBanner.findMany.mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/banners?type=artifact',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /v1/gacha/status', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/status',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return gacha status for authenticated user', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue({
        id: 'gp-123',
        userId: 'user-123',
        heroPityCount: 45,
        heroSparkCount: 150,
        heroShards: 30,
        artifactPity: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.gachaPull.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.heroPityCount).toBeDefined();
    });

    it('should return default status for new user', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue(null);
      // When no progress exists, the service creates one
      mockPrisma.gachaProgress.create.mockResolvedValue({
        id: 'gp-new',
        userId: 'user-123',
        heroPityCount: 0,
        heroSparkCount: 0,
        heroShards: 0,
        artifactPity: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.gachaPull.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/status',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /v1/gacha/pull/hero', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/pull/hero',
        payload: {
          pullCount: 'single',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid pull count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/pull/hero',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          pullCount: 'invalid', // Invalid - must be 'single' or 'ten'
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 with missing pull count', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/pull/hero',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when user has insufficient dust', async () => {
      // Gacha uses dust, not gems
      mockPrisma.inventory.findUnique.mockResolvedValue(
        createMockInventory({ dust: 0 })
      );

      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/pull/hero',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          pullCount: 'single',
        },
      });

      // Should return 400 with error about insufficient dust
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('INSUFFICIENT_DUST');
    });
  });

  describe('POST /v1/gacha/spark/redeem', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/spark/redeem',
        payload: {
          heroId: 'storm',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with missing heroId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/spark/redeem',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return error when user has insufficient spark', async () => {
      mockPrisma.gachaProgress.findUnique.mockResolvedValue({
        id: 'gp-123',
        userId: 'user-123',
        heroPityCount: 0,
        heroSparkCount: 100, // Less than required 300
        heroShards: 0,
        artifactPity: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/gacha/spark/redeem',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          heroId: 'storm',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('GET /v1/gacha/history', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/history',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return empty history for new user', async () => {
      mockPrisma.gachaPull.findMany.mockResolvedValue([]);
      mockPrisma.gachaPull.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/history',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.pulls).toBeDefined();
      expect(body.pulls).toHaveLength(0);
    });

    it('should return pull history with pagination', async () => {
      mockPrisma.gachaPull.findMany.mockResolvedValue([
        {
          id: 'pull-1',
          userId: 'user-123',
          gachaType: GachaType.HERO,
          itemId: 'storm',
          rarity: 5,
          isPity: false,
          isFeatured: false,
          bannerId: null,
          createdAt: new Date(),
        },
      ]);
      mockPrisma.gachaPull.count.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/history?limit=10&offset=0',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.pulls).toBeDefined();
    });

    it('should filter by gacha type', async () => {
      mockPrisma.gachaPull.findMany.mockResolvedValue([]);
      mockPrisma.gachaPull.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/history?gachaType=hero',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for invalid query parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/gacha/history?limit=invalid',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
