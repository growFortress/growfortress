/**
 * Integration tests for guild preview routes
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildTestApp, generateTestToken } from '../../helpers/testApp.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Import test setup (mocks prisma, redis, config)
import '../../helpers/setup.js';

describe('Guild Preview Routes', () => {
  let app: FastifyInstance;
  let authToken: string;

  beforeEach(async () => {
    app = await buildTestApp();
    authToken = await generateTestToken('user-123');
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/guilds/:guildId/preview', () => {
    it('should not require auth token (public endpoint)', async () => {
      // This is a public endpoint, so it should work without auth
      // It returns 404 because we haven't mocked the guild
      mockPrisma.guild.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/guild-123/preview',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'Guild not found' });
    });

    it('should return 404 for non-existent guild', async () => {
      mockPrisma.guild.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/nonexistent-guild/preview',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'Guild not found' });
    });

    it('should return 404 for disbanded guild', async () => {
      // The query has disbanded: false filter, so disbanded guilds return null
      mockPrisma.guild.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/disbanded-guild/preview',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return guild preview for valid guild', async () => {
      const guildId = 'guild-123';
      const mockGuild = {
        id: guildId,
        name: 'Epic Warriors',
        tag: 'EPIC',
        description: 'A guild of epic warriors',
        honor: 2500,
        structureKwatera: 3,
        structureSkarbiec: 2,
        structureAkademia: 2,
        structureZbrojownia: 4,
        trophies: ['FIRST_BLOOD', 'WAVE_MASTER'],
        createdAt: new Date('2024-01-15'),
        members: [
          {
            userId: 'leader-1',
            role: 'LEADER',
            user: {
              displayName: 'GuildMaster',
              progression: { level: 30 },
              powerUpgrades: { cachedTotalPower: 10000 },
            },
          },
          {
            userId: 'officer-1',
            role: 'OFFICER',
            user: {
              displayName: 'RightHand',
              progression: { level: 25 },
              powerUpgrades: { cachedTotalPower: 7500 },
            },
          },
          {
            userId: 'member-1',
            role: 'MEMBER',
            user: {
              displayName: 'Warrior',
              progression: { level: 20 },
              powerUpgrades: { cachedTotalPower: 5000 },
            },
          },
        ],
        _count: { members: 3 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/guilds/${guildId}/preview`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.guildId).toBe(guildId);
      expect(body.name).toBe('Epic Warriors');
      expect(body.tag).toBe('EPIC');
      expect(body.description).toBe('A guild of epic warriors');
      expect(body.honor).toBe(2500);
      expect(body.memberCount).toBe(3);
      expect(body.trophies).toEqual(['FIRST_BLOOD', 'WAVE_MASTER']);

      // Check structures
      expect(body.structures.kwatera).toBe(3);
      expect(body.structures.skarbiec).toBe(2);
      expect(body.structures.akademia).toBe(2);
      expect(body.structures.zbrojownia).toBe(4);

      // Check bonuses
      expect(body.bonuses.goldBoost).toBeDefined();
      expect(body.bonuses.xpBoost).toBeDefined();
      expect(body.bonuses.statBoost).toBeDefined();

      // Check top members
      expect(body.topMembers).toHaveLength(3);
      expect(body.topMembers[0].role).toBe('LEADER');
      expect(body.topMembers[0].displayName).toBe('GuildMaster');
      expect(body.topMembers[1].role).toBe('OFFICER');
      expect(body.topMembers[2].role).toBe('MEMBER');
    });

    it('should limit top members to 5', async () => {
      const guildId = 'large-guild';
      const mockGuild = {
        id: guildId,
        name: 'Large Guild',
        tag: 'BIG',
        description: null,
        honor: 10000,
        structureKwatera: 5,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: Array.from({ length: 15 }, (_, i) => ({
          userId: `user-${i}`,
          role: i === 0 ? 'LEADER' : i < 3 ? 'OFFICER' : 'MEMBER',
          user: {
            displayName: `Player${i}`,
            progression: { level: 30 - i },
            powerUpgrades: { cachedTotalPower: 15000 - i * 500 },
          },
        })),
        _count: { members: 15 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/guilds/${guildId}/preview`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.memberCount).toBe(15);
      expect(body.topMembers).toHaveLength(5);
    });

    it('should handle guild with minimal data', async () => {
      const guildId = 'new-guild';
      const mockGuild = {
        id: guildId,
        name: 'New Guild',
        tag: 'NEW',
        description: null,
        honor: 0,
        structureKwatera: 1,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: null,
        createdAt: new Date('2024-06-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/guilds/${guildId}/preview`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.name).toBe('New Guild');
      expect(body.honor).toBe(0);
      expect(body.memberCount).toBe(0);
      expect(body.trophies).toEqual([]);
      expect(body.topMembers).toEqual([]);

      // Default structure levels
      expect(body.structures.kwatera).toBe(1);
      expect(body.structures.skarbiec).toBe(0);

      // Bonuses should be defined (base values)
      expect(body.bonuses.goldBoost).toBeDefined();
      expect(body.bonuses.xpBoost).toBeDefined();
    });

    it('should validate guildId parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds//preview',
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      // Empty guildId should result in 404 (route not matched) or 400
      expect([400, 404]).toContain(response.statusCode);
    });

    it('should handle members with missing optional data', async () => {
      const guildId = 'guild-missing-data';
      const mockGuild = {
        id: guildId,
        name: 'Data Test Guild',
        tag: 'TEST',
        description: null,
        honor: 500,
        structureKwatera: 2,
        structureSkarbiec: 1,
        structureAkademia: 1,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-03-01'),
        members: [
          {
            userId: 'user-no-progression',
            role: 'LEADER',
            user: {
              displayName: 'NoProgressionPlayer',
              progression: null,
              powerUpgrades: null,
            },
          },
        ],
        _count: { members: 1 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const response = await app.inject({
        method: 'GET',
        url: `/v1/guilds/${guildId}/preview`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.topMembers).toHaveLength(1);
      expect(body.topMembers[0].displayName).toBe('NoProgressionPlayer');
      expect(body.topMembers[0].level).toBe(1); // Default level
      expect(body.topMembers[0].power).toBe(0); // Default power
    });
  });
});
