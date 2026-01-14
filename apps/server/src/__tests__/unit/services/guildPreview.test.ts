/**
 * Unit tests for guildPreview service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getGuildPreview, invalidateGuildPreviewCache } from '../../../services/guildPreview.js';
import { mockPrisma } from '../../mocks/prisma.js';
import { setMockRedisValue, getMockRedisKeys } from '../../mocks/redis.js';

// Import test setup
import '../../helpers/setup.js';

describe('GuildPreview Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGuildPreview', () => {
    const guildId = 'guild-123';

    it('should return null for non-existent guild', async () => {
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const result = await getGuildPreview(guildId);

      expect(result).toBeNull();
      expect(mockPrisma.guild.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: guildId, disbanded: false },
        })
      );
    });

    it('should return null for disbanded guild', async () => {
      // The query has `disbanded: false` filter, so disbanded guilds won't be found
      mockPrisma.guild.findUnique.mockResolvedValue(null);

      const result = await getGuildPreview(guildId);

      expect(result).toBeNull();
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        guildId,
        name: 'Test Guild',
        tag: 'TEST',
        description: 'A test guild',
        level: 5,
        xp: 1000,
        xpToNextLevel: 500,
        honor: 1500,
        memberCount: 10,
        maxMembers: 12,
        trophies: ['FIRST_BLOOD'],
        techLevels: {
          fortress: { hp: 2, damage: 1, regen: 0 },
          hero: { hp: 1, damage: 2, cooldown: 0 },
          turret: { damage: 3, speed: 1, range: 0 },
          economy: { gold: 2, dust: 1, xp: 0 },
        },
        bonuses: {
          goldPercent: 0.04,
          dustPercent: 0.02,
          xpPercent: 0.02,
          fortressHpPercent: 0.04,
          fortressDamagePercent: 0.02,
          fortressRegenPercent: 0,
          heroHpPercent: 0.02,
          heroDamagePercent: 0.04,
          heroCooldownPercent: 0,
          turretDamagePercent: 0.06,
          turretSpeedPercent: 0.02,
          turretRangePercent: 0,
        },
        topMembers: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      setMockRedisValue(`guild:preview:${guildId}`, JSON.stringify(cachedData));

      const result = await getGuildPreview(guildId);

      expect(result).toEqual(cachedData);
      expect(mockPrisma.guild.findUnique).not.toHaveBeenCalled();
    });

    it('should fetch and return guild data from database', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Epic Guild',
        tag: 'EPIC',
        description: 'An epic guild',
        level: 3,
        xp: 2500,
        totalXp: 2500,
        honor: 2000,
        techLevels: {
          fortress: { hp: 1, damage: 0, regen: 0 },
          hero: { hp: 0, damage: 1, cooldown: 0 },
          turret: { damage: 0, speed: 0, range: 0 },
          economy: { gold: 0, dust: 0, xp: 0 },
        },
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [
          {
            userId: 'user-1',
            role: 'LEADER',
            user: {
              displayName: 'LeaderPlayer',
              progression: { level: 20 },
              powerUpgrades: { cachedTotalPower: 5000 },
            },
          },
          {
            userId: 'user-2',
            role: 'OFFICER',
            user: {
              displayName: 'OfficerPlayer',
              progression: { level: 15 },
              powerUpgrades: { cachedTotalPower: 3000 },
            },
          },
        ],
        _count: { members: 2 },
      };

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result).not.toBeNull();
      expect(result?.guildId).toBe(guildId);
      expect(result?.name).toBe('Epic Guild');
      expect(result?.tag).toBe('EPIC');
      expect(result?.description).toBe('An epic guild');
      expect(result?.level).toBe(3);
      expect(result?.honor).toBe(2000);
      expect(result?.memberCount).toBe(2);
      expect(result?.topMembers).toHaveLength(2);

      // Check top members are ordered by role
      expect(result?.topMembers[0].role).toBe('LEADER');
      expect(result?.topMembers[0].displayName).toBe('LeaderPlayer');
      expect(result?.topMembers[1].role).toBe('OFFICER');
    });

    it('should calculate bonuses from tech levels', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Tech Guild',
        tag: 'TECH',
        description: null,
        level: 5,
        xp: 10000,
        totalXp: 10000,
        honor: 1000,
        techLevels: {
          fortress: { hp: 5, damage: 3, regen: 2 },
          hero: { hp: 4, damage: 5, cooldown: 1 },
          turret: { damage: 6, speed: 4, range: 2 },
          economy: { gold: 3, dust: 2, xp: 1 },
        },
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result).not.toBeNull();
      // Tech bonuses = level * 0.02 (2% per level)
      expect(result?.bonuses.fortressHpPercent).toBe(0.1); // 5 * 0.02
      expect(result?.bonuses.fortressDamagePercent).toBe(0.06); // 3 * 0.02
      expect(result?.bonuses.heroDamagePercent).toBe(0.1); // 5 * 0.02
      expect(result?.bonuses.turretDamagePercent).toBe(0.12); // 6 * 0.02
    });

    it('should limit top members to 5', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Big Guild',
        tag: 'BIG',
        description: null,
        level: 10,
        xp: 75000,
        totalXp: 75000,
        honor: 5000,
        techLevels: {
          fortress: { hp: 0, damage: 0, regen: 0 },
          hero: { hp: 0, damage: 0, cooldown: 0 },
          turret: { damage: 0, speed: 0, range: 0 },
          economy: { gold: 0, dust: 0, xp: 0 },
        },
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: Array.from({ length: 10 }, (_, i) => ({
          userId: `user-${i}`,
          role: i === 0 ? 'LEADER' : i < 3 ? 'OFFICER' : 'MEMBER',
          user: {
            displayName: `Player${i}`,
            progression: { level: 20 - i },
            powerUpgrades: { cachedTotalPower: 10000 - i * 500 },
          },
        })),
        _count: { members: 10 },
      };

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.topMembers).toHaveLength(5);
    });

    it('should use default values when optional data is missing', async () => {
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
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result).not.toBeNull();
      expect(result?.techLevels.fortress.hp).toBe(0);
      expect(result?.techLevels.hero.damage).toBe(0);
      expect(result?.trophies).toEqual([]);
      expect(result?.topMembers).toEqual([]);
    });

    it('should cache result after fetching from database', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Cache Test Guild',
        tag: 'CACH',
        description: null,
        level: 2,
        xp: 1000,
        totalXp: 1000,
        honor: 500,
        techLevels: {
          fortress: { hp: 0, damage: 0, regen: 0 },
          hero: { hp: 0, damage: 0, cooldown: 0 },
          turret: { damage: 0, speed: 0, range: 0 },
          economy: { gold: 0, dust: 0, xp: 0 },
        },
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findUnique.mockResolvedValue(mockGuild);

      // First call - fetches from DB and caches
      const result1 = await getGuildPreview(guildId);
      expect(result1?.name).toBe('Cache Test Guild');
      expect(mockPrisma.guild.findUnique).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const result2 = await getGuildPreview(guildId);
      expect(result2?.name).toBe('Cache Test Guild');
      // Still only 1 call because second call used cache
      expect(mockPrisma.guild.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateGuildPreviewCache', () => {
    const guildId = 'guild-123';

    it('should delete cache key for guild', async () => {
      // Set up cached data
      setMockRedisValue(`guild:preview:${guildId}`, JSON.stringify({ guildId }));

      // Verify cache exists
      let keys = getMockRedisKeys();
      expect(keys).toContain(`guild:preview:${guildId}`);

      // Invalidate cache
      await invalidateGuildPreviewCache(guildId);

      // After fetching again, prisma should be called
      mockPrisma.guild.findUnique.mockResolvedValue(null);
      const result = await getGuildPreview(guildId);

      expect(result).toBeNull();
      expect(mockPrisma.guild.findUnique).toHaveBeenCalled();
    });
  });
});
