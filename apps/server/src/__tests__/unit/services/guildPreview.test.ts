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
      mockPrisma.guild.findFirst.mockResolvedValue(null);

      const result = await getGuildPreview(guildId);

      expect(result).toBeNull();
      expect(mockPrisma.guild.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: guildId, disbanded: false },
        })
      );
    });

    it('should return null for disbanded guild', async () => {
      // The query has `disbanded: false` filter, so disbanded guilds won't be found
      mockPrisma.guild.findFirst.mockResolvedValue(null);

      const result = await getGuildPreview(guildId);

      expect(result).toBeNull();
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        guildId,
        name: 'Test Guild',
        tag: 'TEST',
        description: 'A test guild',
        honor: 1500,
        memberCount: 10,
        maxMembers: 15,
        trophies: ['FIRST_BLOOD'],
        structures: {
          kwatera: 5,
          skarbiec: 10,
          akademia: 8,
          zbrojownia: 12,
        },
        bonuses: {
          goldBoost: 0.10,
          xpBoost: 0.08,
          statBoost: 0.12,
        },
        topMembers: [],
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      setMockRedisValue(`guild:preview:${guildId}`, JSON.stringify(cachedData));

      const result = await getGuildPreview(guildId);

      expect(result).toEqual(cachedData);
      expect(mockPrisma.guild.findFirst).not.toHaveBeenCalled();
    });

    it('should fetch and return guild data from database', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Epic Guild',
        tag: 'EPIC',
        description: 'An epic guild',
        honor: 2000,
        structureKwatera: 5,
        structureSkarbiec: 10,
        structureAkademia: 8,
        structureZbrojownia: 12,
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

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result).not.toBeNull();
      expect(result?.guildId).toBe(guildId);
      expect(result?.name).toBe('Epic Guild');
      expect(result?.tag).toBe('EPIC');
      expect(result?.description).toBe('An epic guild');
      expect(result?.honor).toBe(2000);
      expect(result?.memberCount).toBe(2);
      expect(result?.maxMembers).toBe(15); // 10 base + 5 kwatera levels
      expect(result?.topMembers).toHaveLength(2);

      // Check top members are ordered by role
      expect(result?.topMembers[0].role).toBe('LEADER');
      expect(result?.topMembers[0].displayName).toBe('LeaderPlayer');
      expect(result?.topMembers[1].role).toBe('OFFICER');
    });

    it('should calculate bonuses from structure levels', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Tech Guild',
        tag: 'TECH',
        description: null,
        honor: 1000,
        structureKwatera: 5,
        structureSkarbiec: 10,
        structureAkademia: 8,
        structureZbrojownia: 12,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result).not.toBeNull();
      // Structure bonuses = level * 0.01 (1% per level)
      expect(result?.bonuses.goldBoost).toBe(0.10); // skarbiec 10 * 0.01
      expect(result?.bonuses.xpBoost).toBe(0.08);   // akademia 8 * 0.01
      expect(result?.bonuses.statBoost).toBe(0.12); // zbrojownia 12 * 0.01
    });

    it('should include structures in response', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Structure Guild',
        tag: 'STRCT',
        description: null,
        honor: 1000,
        structureKwatera: 15,
        structureSkarbiec: 18,
        structureAkademia: 12,
        structureZbrojownia: 20,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.structures).toEqual({
        kwatera: 15,
        skarbiec: 18,
        akademia: 12,
        zbrojownia: 20,
      });
      expect(result?.maxMembers).toBe(25); // 10 base + 15 kwatera levels
    });

    it('should limit top members to 5', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Big Guild',
        tag: 'BIG',
        description: null,
        honor: 5000,
        structureKwatera: 20,
        structureSkarbiec: 20,
        structureAkademia: 20,
        structureZbrojownia: 20,
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

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.topMembers).toHaveLength(5);
    });

    it('should use default values when optional data is missing', async () => {
      const mockGuild = {
        id: guildId,
        name: 'New Guild',
        tag: 'NEW',
        description: null,
        honor: 0,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: null,
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result).not.toBeNull();
      expect(result?.structures.kwatera).toBe(0);
      expect(result?.structures.skarbiec).toBe(0);
      expect(result?.bonuses.goldBoost).toBe(0);
      expect(result?.bonuses.xpBoost).toBe(0);
      expect(result?.bonuses.statBoost).toBe(0);
      expect(result?.trophies).toEqual([]);
      expect(result?.topMembers).toEqual([]);
      expect(result?.maxMembers).toBe(10); // Base capacity
    });

    it('should cache result after fetching from database', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Cache Test Guild',
        tag: 'CACH',
        description: null,
        honor: 500,
        structureKwatera: 2,
        structureSkarbiec: 3,
        structureAkademia: 1,
        structureZbrojownia: 4,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      await getGuildPreview(guildId);

      // Verify cache was set
      const cacheKeys = getMockRedisKeys();
      expect(cacheKeys).toContain(`guild:preview:${guildId}`);
    });
  });

  describe('invalidateGuildPreviewCache', () => {
    it('should delete cached preview', async () => {
      const guildId = 'guild-456';
      const cacheKey = `guild:preview:${guildId}`;

      // Set some cached data first
      setMockRedisValue(cacheKey, JSON.stringify({ name: 'Test' }));

      await invalidateGuildPreviewCache(guildId);

      // Check cache was deleted
      const cacheKeys = getMockRedisKeys();
      expect(cacheKeys).not.toContain(cacheKey);
    });

    it('should handle non-existent cache gracefully', async () => {
      const guildId = 'guild-never-cached';

      // Should not throw
      await invalidateGuildPreviewCache(guildId);
    });
  });

  // ============================================================================
  // ACCESS MODE TESTS
  // ============================================================================

  describe('getGuildPreview - access mode', () => {
    const guildId = 'guild-access-mode';

    it('should return INVITE_ONLY for guilds with no settings', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Invite Only Guild',
        tag: 'INV',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 1000,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 0 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.accessMode).toBe('INVITE_ONLY');
    });

    it('should return APPLY access mode when configured', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Open Guild',
        tag: 'OPEN',
        description: 'Anyone can apply',
        emblemUrl: null,
        settings: { accessMode: 'APPLY', minLevel: 10 },
        honor: 2000,
        structureKwatera: 5,
        structureSkarbiec: 5,
        structureAkademia: 5,
        structureZbrojownia: 5,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 5 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.accessMode).toBe('APPLY');
    });

    it('should return CLOSED access mode when configured', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Closed Guild',
        tag: 'CLSD',
        description: 'Not accepting new members',
        emblemUrl: null,
        settings: { accessMode: 'CLOSED', minLevel: 100 },
        honor: 5000,
        structureKwatera: 10,
        structureSkarbiec: 10,
        structureAkademia: 10,
        structureZbrojownia: 10,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 30 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.accessMode).toBe('CLOSED');
    });
  });

  // ============================================================================
  // EMBLEM URL TESTS
  // ============================================================================

  describe('getGuildPreview - emblem', () => {
    const guildId = 'guild-emblem';

    it('should include emblemUrl when present', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Emblem Guild',
        tag: 'EMB',
        description: null,
        emblemUrl: 'https://example.com/emblem.png',
        settings: null,
        honor: 1000,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 5 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.emblemUrl).toBe('https://example.com/emblem.png');
    });

    it('should return null emblemUrl when not set', async () => {
      const mockGuild = {
        id: guildId,
        name: 'No Emblem Guild',
        tag: 'NEM',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 1000,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 5 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.emblemUrl).toBeNull();
    });
  });

  // ============================================================================
  // MEMBER SORTING TESTS
  // ============================================================================

  describe('getGuildPreview - member sorting', () => {
    const guildId = 'guild-sorting';

    it('should sort members by role then power', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Sorted Guild',
        tag: 'SRT',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 3000,
        structureKwatera: 10,
        structureSkarbiec: 5,
        structureAkademia: 5,
        structureZbrojownia: 5,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [
          {
            userId: 'member-high-power',
            role: 'MEMBER',
            user: {
              displayName: 'HighPowerMember',
              progression: { level: 30 },
              powerUpgrades: { cachedTotalPower: 50000 },
            },
          },
          {
            userId: 'leader',
            role: 'LEADER',
            user: {
              displayName: 'TheLeader',
              progression: { level: 25 },
              powerUpgrades: { cachedTotalPower: 30000 },
            },
          },
          {
            userId: 'officer-low',
            role: 'OFFICER',
            user: {
              displayName: 'LowOfficer',
              progression: { level: 20 },
              powerUpgrades: { cachedTotalPower: 10000 },
            },
          },
          {
            userId: 'officer-high',
            role: 'OFFICER',
            user: {
              displayName: 'HighOfficer',
              progression: { level: 22 },
              powerUpgrades: { cachedTotalPower: 25000 },
            },
          },
        ],
        _count: { members: 4 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.topMembers).toHaveLength(4);
      // Leader should be first
      expect(result?.topMembers[0].role).toBe('LEADER');
      expect(result?.topMembers[0].displayName).toBe('TheLeader');
      // Then officers sorted by power
      expect(result?.topMembers[1].role).toBe('OFFICER');
      expect(result?.topMembers[1].displayName).toBe('HighOfficer');
      expect(result?.topMembers[2].role).toBe('OFFICER');
      expect(result?.topMembers[2].displayName).toBe('LowOfficer');
      // Then members
      expect(result?.topMembers[3].role).toBe('MEMBER');
    });

    it('should handle members with null progression', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Null Progression Guild',
        tag: 'NPG',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 1000,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [
          {
            userId: 'member-no-progression',
            role: 'MEMBER',
            user: {
              displayName: 'NewPlayer',
              progression: null,
              powerUpgrades: null,
            },
          },
        ],
        _count: { members: 1 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.topMembers[0].level).toBe(1); // Default level
      expect(result?.topMembers[0].power).toBe(0); // Default power
    });
  });

  // ============================================================================
  // TROPHY HANDLING TESTS
  // ============================================================================

  describe('getGuildPreview - trophies', () => {
    const guildId = 'guild-trophies';

    it('should include trophies array', async () => {
      const mockGuild = {
        id: guildId,
        name: 'Trophy Guild',
        tag: 'TRO',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 5000,
        structureKwatera: 10,
        structureSkarbiec: 10,
        structureAkademia: 10,
        structureZbrojownia: 10,
        trophies: ['FIRST_BLOOD', 'BATTLE_HARDENED', 'WAR_MACHINE'],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 20 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.trophies).toEqual(['FIRST_BLOOD', 'BATTLE_HARDENED', 'WAR_MACHINE']);
    });

    it('should handle empty trophies array', async () => {
      const mockGuild = {
        id: guildId,
        name: 'No Trophy Guild',
        tag: 'NTG',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 1000,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: new Date('2024-01-01'),
        members: [],
        _count: { members: 5 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.trophies).toEqual([]);
    });
  });

  // ============================================================================
  // CREATION DATE TESTS
  // ============================================================================

  describe('getGuildPreview - createdAt', () => {
    const guildId = 'guild-date';

    it('should format createdAt as ISO string', async () => {
      const createdDate = new Date('2023-06-15T10:30:00Z');
      const mockGuild = {
        id: guildId,
        name: 'Date Test Guild',
        tag: 'DATE',
        description: null,
        emblemUrl: null,
        settings: null,
        honor: 1000,
        structureKwatera: 0,
        structureSkarbiec: 0,
        structureAkademia: 0,
        structureZbrojownia: 0,
        trophies: [],
        createdAt: createdDate,
        members: [],
        _count: { members: 5 },
      };

      mockPrisma.guild.findFirst.mockResolvedValue(mockGuild);

      const result = await getGuildPreview(guildId);

      expect(result?.createdAt).toBe('2023-06-15T10:30:00.000Z');
    });
  });
});
