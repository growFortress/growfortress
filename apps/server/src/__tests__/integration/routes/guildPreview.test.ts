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
    it('should return 401 without auth token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/guilds/guild-123/preview',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 404 for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

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
      mockPrisma.guild.findUnique.mockResolvedValue(null);

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
        level: 5,
        xp: 5000,
        totalXp: 5000,
        honor: 2500,
        techLevels: {
          fortress: { hp: 3, damage: 2, regen: 1 },
          hero: { hp: 2, damage: 3, cooldown: 1 },
          turret: { damage: 4, speed: 2, range: 1 },
          economy: { gold: 2, dust: 1, xp: 1 },
        },
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

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

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
      expect(body.level).toBe(5);
      expect(body.honor).toBe(2500);
      expect(body.memberCount).toBe(3);
      expect(body.trophies).toEqual(['FIRST_BLOOD', 'WAVE_MASTER']);

      // Check tech levels
      expect(body.techLevels.fortress.hp).toBe(3);
      expect(body.techLevels.hero.damage).toBe(3);
      expect(body.techLevels.turret.damage).toBe(4);

      // Check bonuses (2% per level)
      expect(body.bonuses.fortressHpPercent).toBe(0.06); // 3 * 0.02
      expect(body.bonuses.heroDamagePercent).toBe(0.06); // 3 * 0.02
      expect(body.bonuses.turretDamagePercent).toBe(0.08); // 4 * 0.02

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
        level: 10,
        xp: 50000,
        totalXp: 50000,
        honor: 10000,
        techLevels: {
          fortress: { hp: 0, damage: 0, regen: 0 },
          hero: { hp: 0, damage: 0, cooldown: 0 },
          turret: { damage: 0, speed: 0, range: 0 },
          economy: { gold: 0, dust: 0, xp: 0 },
        },
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

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

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
        level: 1,
        xp: 0,
        totalXp: 0,
        honor: 0,
        techLevels: null,
        trophies: null,
        createdAt: new Date('2024-06-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

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
      expect(body.level).toBe(1);
      expect(body.honor).toBe(0);
      expect(body.memberCount).toBe(0);
      expect(body.trophies).toEqual([]);
      expect(body.topMembers).toEqual([]);

      // Default tech levels
      expect(body.techLevels.fortress.hp).toBe(0);
      expect(body.techLevels.hero.damage).toBe(0);

      // All bonuses should be 0
      expect(body.bonuses.fortressHpPercent).toBe(0);
      expect(body.bonuses.heroDamagePercent).toBe(0);
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
        level: 2,
        xp: 1000,
        totalXp: 1000,
        honor: 500,
        techLevels: {
          fortress: { hp: 1, damage: 0, regen: 0 },
          hero: { hp: 0, damage: 1, cooldown: 0 },
          turret: { damage: 0, speed: 0, range: 0 },
          economy: { gold: 0, dust: 0, xp: 0 },
        },
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

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

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
