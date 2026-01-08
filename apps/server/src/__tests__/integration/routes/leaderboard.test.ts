/**
 * Leaderboard Routes Integration Tests
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma } from '../../mocks/prisma.js';
import { vi } from 'vitest';

describe('Leaderboard Routes Integration', () => {
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

  describe('GET /v1/leaderboards/weekly', () => {
    it('should return empty leaderboard when no entries exist', async () => {
      // Mock empty leaderboard with proper user structure
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);
      // Mock for getUserRank - user has no entry
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/leaderboards/weekly',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toBeDefined();
      expect(body.entries).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should allow request without authentication', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/leaderboards/weekly',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.entries).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('should accept week query parameter', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/leaderboards/weekly?week=2024-01',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /v1/leaderboards/weeks', () => {
    it('should return available weeks', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        { weekKey: '2024-03' },
        { weekKey: '2024-02' },
        { weekKey: '2024-01' },
      ]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/leaderboards/weeks',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentWeek).toBeDefined();
      expect(body.weeks).toBeDefined();
      expect(Array.isArray(body.weeks)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        { weekKey: '2024-03' },
        { weekKey: '2024-02' },
      ]);

      const token = await generateTestToken('user-123');

      const response = await app.inject({
        method: 'GET',
        url: '/v1/leaderboards/weeks?limit=2',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.weeks.length).toBeLessThanOrEqual(2);
    });
  });
});
