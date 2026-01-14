/**
 * Integration tests for boss-rush routes
 * Note: Boss rush has complex validation and service logic.
 * These tests focus on auth and basic validation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Boss Rush Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /v1/boss-rush/start', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/boss-rush/start',
        payload: {
          heroIds: ['storm'],
          turretTypes: ['railgun'],
          fortressClass: 'lightning',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/boss-rush/start',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          heroIds: [], // Empty heroes - may be invalid
          turretTypes: [],
          fortressClass: 'invalid_class',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /v1/boss-rush/:sessionId', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/boss-rush/brs-123',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent session', async () => {
      mockPrisma.bossRushSession.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/boss-rush/nonexistent',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('Session not found');
    });
  });

  describe('POST /v1/boss-rush/:sessionId/finish', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/boss-rush/brs-123/finish',
        payload: {
          sessionToken: 'test-token',
          events: [],
          checkpoints: [],
          finalHash: 12345,
          summary: {
            totalDamage: 100000,
            bossesKilled: 5,
            cyclesCompleted: 1,
            goldEarned: 1000,
            dustEarned: 100,
            materialsEarned: {},
            timeSurvived: 3000,
          },
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 with invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/boss-rush/brs-123/finish',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          // Missing required fields
          finalHash: 'not-a-number', // Invalid type
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /v1/boss-rush/history', () => {
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/boss-rush/history',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return user boss rush history', async () => {
      mockPrisma.bossRushSession.findMany.mockResolvedValue([]);
      mockPrisma.bossRushSession.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/boss-rush/history',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.sessions).toBeDefined();
      expect(body.total).toBe(0);
    });

    it('should accept pagination parameters', async () => {
      mockPrisma.bossRushSession.findMany.mockResolvedValue([]);
      mockPrisma.bossRushSession.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/boss-rush/history?limit=5&offset=10',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
