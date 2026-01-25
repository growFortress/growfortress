/**
 * Unit tests for Guild Medals service
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  resetPrismaMock,
  createMockGuildTowerRace,
} from '../../mocks/prisma.js';

// Import test setup
import '../../helpers/setup.js';

// Import service functions after setup
import {
  distributeTowerRaceMedals,
  getActiveWaveBonus,
  applyWaveBonusMultiplier,
  cleanupExpiredBonuses,
  getGuildMedalCollection,
  getMedalsForWeek,
  hasGuildMedalForWeek,
  getMedalLeaderboard,
} from '../../../services/guildMedals.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMockMedal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'medal-123',
    guildId: 'guild-123',
    weekKey: '2026-W03',
    raceId: 'race-123',
    medalType: 'gold',
    rank: 1,
    totalWaves: 5000,
    coinsAwarded: 500,
    awardedAt: new Date(),
    ...overrides,
  };
}

function createMockMedalBonus(overrides: Record<string, unknown> = {}) {
  const futureExpiry = new Date();
  futureExpiry.setDate(futureExpiry.getDate() + 7);

  return {
    id: 'bonus-123',
    guildId: 'guild-123',
    wavesBonus: 0.10,
    sourceMedalType: 'gold',
    sourceWeekKey: '2026-W03',
    expiresAt: futureExpiry,
    ...overrides,
  };
}

describe('Guild Medals Service', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  // ============================================================================
  // DISTRIBUTE TOWER RACE MEDALS
  // ============================================================================

  describe('distributeTowerRaceMedals', () => {
    it('returns error if race not found', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(null);

      const result = await distributeTowerRaceMedals('2026-W99', []);

      expect(result.medalsAwarded).toBe(0);
      expect(result.errors).toContain('Race not found for week 2026-W99');
    });

    it('skips guilds ranked higher than 50', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      const rankings = [
        { guildId: 'guild-51', rank: 51, totalWaves: 100 },
        { guildId: 'guild-60', rank: 60, totalWaves: 50 },
      ];

      const result = await distributeTowerRaceMedals('2026-W03', rankings);

      expect(result.medalsAwarded).toBe(0);
      expect(result.totalCoinsDistributed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('awards gold medal to rank 1 guild', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceMedal: {
            create: vi.fn().mockResolvedValue({}),
          },
          guildMedalBonus: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          guildTreasury: {
            update: vi.fn().mockResolvedValue({ gold: 1000, dust: 100, guildCoins: 500 }),
          },
          guildMember: {
            findFirst: vi.fn().mockResolvedValue({ userId: 'leader-123' }),
          },
          guildTreasuryLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const rankings = [{ guildId: 'guild-1', rank: 1, totalWaves: 10000 }];
      const result = await distributeTowerRaceMedals('2026-W03', rankings);

      expect(result.medalsAwarded).toBe(1);
      expect(result.totalCoinsDistributed).toBe(500); // Gold medal reward
      expect(result.errors).toHaveLength(0);
    });

    it('awards correct medals to multiple guilds', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceMedal: {
            create: vi.fn().mockResolvedValue({}),
          },
          guildMedalBonus: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          guildTreasury: {
            update: vi.fn().mockResolvedValue({ gold: 1000, dust: 100, guildCoins: 500 }),
          },
          guildMember: {
            findFirst: vi.fn().mockResolvedValue({ userId: 'leader-123' }),
          },
          guildTreasuryLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return await callback(tx);
      });

      const rankings = [
        { guildId: 'guild-1', rank: 1, totalWaves: 10000 },
        { guildId: 'guild-2', rank: 2, totalWaves: 8000 },
        { guildId: 'guild-3', rank: 3, totalWaves: 6000 },
      ];

      const result = await distributeTowerRaceMedals('2026-W03', rankings);

      expect(result.medalsAwarded).toBe(3);
      // Gold: 500 + Silver: 300 + Bronze: 200 = 1000
      expect(result.totalCoinsDistributed).toBe(1000);
    });

    it('handles transaction errors gracefully', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      mockPrisma.$transaction.mockRejectedValue(new Error('Database connection failed'));

      const rankings = [{ guildId: 'guild-1', rank: 1, totalWaves: 10000 }];
      const result = await distributeTowerRaceMedals('2026-W03', rankings);

      expect(result.medalsAwarded).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to award medal');
    });

    it('uses SYSTEM as fallback when no guild leader found', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      let loggedUserId: string | undefined;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceMedal: {
            create: vi.fn().mockResolvedValue({}),
          },
          guildMedalBonus: {
            upsert: vi.fn().mockResolvedValue({}),
          },
          guildTreasury: {
            update: vi.fn().mockResolvedValue({ gold: 1000, dust: 100, guildCoins: 500 }),
          },
          guildMember: {
            findFirst: vi.fn().mockResolvedValue(null), // No leader found
          },
          guildTreasuryLog: {
            create: vi.fn().mockImplementation((args) => {
              loggedUserId = args.data.userId;
              return Promise.resolve({});
            }),
          },
        };
        return await callback(tx);
      });

      const rankings = [{ guildId: 'guild-1', rank: 1, totalWaves: 10000 }];
      await distributeTowerRaceMedals('2026-W03', rankings);

      expect(loggedUserId).toBe('SYSTEM');
    });
  });

  // ============================================================================
  // GET ACTIVE WAVE BONUS
  // ============================================================================

  describe('getActiveWaveBonus', () => {
    it('returns inactive bonus when no bonus record exists', async () => {
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null);

      const result = await getActiveWaveBonus('guild-123');

      expect(result.isActive).toBe(false);
      expect(result.wavesBonus).toBe(0);
      expect(result.sourceMedalType).toBeNull();
    });

    it('returns inactive bonus when bonus has expired', async () => {
      const expiredBonus = createMockMedalBonus({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(expiredBonus);

      const result = await getActiveWaveBonus('guild-123');

      expect(result.isActive).toBe(false);
      expect(result.wavesBonus).toBe(0);
    });

    it('returns active bonus with correct details', async () => {
      const activeBonus = createMockMedalBonus();
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(activeBonus);

      const result = await getActiveWaveBonus('guild-123');

      expect(result.isActive).toBe(true);
      expect(result.wavesBonus).toBe(0.10);
      expect(result.sourceMedalType).toBe('gold');
      expect(result.sourceWeekKey).toBe('2026-W03');
      expect(result.expiresAt).not.toBeNull();
    });
  });

  // ============================================================================
  // APPLY WAVE BONUS MULTIPLIER
  // ============================================================================

  describe('applyWaveBonusMultiplier', () => {
    it('returns base waves when no active bonus', async () => {
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null);

      const result = await applyWaveBonusMultiplier('guild-123', 100);

      expect(result).toBe(100);
    });

    it('returns base waves when bonus is expired', async () => {
      const expiredBonus = createMockMedalBonus({
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(expiredBonus);

      const result = await applyWaveBonusMultiplier('guild-123', 100);

      expect(result).toBe(100);
    });

    it('applies 10% bonus for gold medal', async () => {
      const goldBonus = createMockMedalBonus({ wavesBonus: 0.10 });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(goldBonus);

      const result = await applyWaveBonusMultiplier('guild-123', 100);

      expect(result).toBe(110); // 100 + floor(100 * 0.10) = 110
    });

    it('applies 7% bonus for silver medal', async () => {
      const silverBonus = createMockMedalBonus({ wavesBonus: 0.07 });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(silverBonus);

      const result = await applyWaveBonusMultiplier('guild-123', 100);

      expect(result).toBe(107); // 100 + floor(100 * 0.07) = 107
    });

    it('floors bonus waves correctly', async () => {
      const goldBonus = createMockMedalBonus({ wavesBonus: 0.10 });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(goldBonus);

      // 55 * 0.10 = 5.5, floor(5.5) = 5
      const result = await applyWaveBonusMultiplier('guild-123', 55);

      expect(result).toBe(60); // 55 + 5 = 60
    });

    it('handles zero base waves', async () => {
      const goldBonus = createMockMedalBonus({ wavesBonus: 0.10 });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(goldBonus);

      const result = await applyWaveBonusMultiplier('guild-123', 0);

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // CLEANUP EXPIRED BONUSES
  // ============================================================================

  describe('cleanupExpiredBonuses', () => {
    it('deletes expired bonuses and returns count', async () => {
      mockPrisma.guildMedalBonus.deleteMany.mockResolvedValue({ count: 5 });

      const result = await cleanupExpiredBonuses();

      expect(result).toBe(5);
      expect(mockPrisma.guildMedalBonus.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('returns 0 when no expired bonuses exist', async () => {
      mockPrisma.guildMedalBonus.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredBonuses();

      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // GET GUILD MEDAL COLLECTION
  // ============================================================================

  describe('getGuildMedalCollection', () => {
    it('returns empty collection for guild with no medals', async () => {
      mockPrisma.guildTowerRaceMedal.findMany.mockResolvedValue([]);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null);

      const result = await getGuildMedalCollection('guild-123');

      expect(result.medals).toHaveLength(0);
      expect(result.stats.totalMedals).toBe(0);
      expect(result.stats.goldCount).toBe(0);
      expect(result.stats.bestRank).toBeNull();
      expect(result.activeBonus.isActive).toBe(false);
    });

    it('calculates correct stats for mixed medals', async () => {
      const medals = [
        createMockMedal({ medalType: 'gold', rank: 1 }),
        createMockMedal({ medalType: 'gold', rank: 1, weekKey: '2026-W02' }),
        createMockMedal({ medalType: 'silver', rank: 2, weekKey: '2026-W01' }),
        createMockMedal({ medalType: 'bronze', rank: 3, weekKey: '2025-W52' }),
        createMockMedal({ medalType: 'top10', rank: 5, weekKey: '2025-W51' }),
        createMockMedal({ medalType: 'top25', rank: 15, weekKey: '2025-W50' }),
        createMockMedal({ medalType: 'top50', rank: 30, weekKey: '2025-W49' }),
      ];
      mockPrisma.guildTowerRaceMedal.findMany.mockResolvedValue(medals);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null);

      const result = await getGuildMedalCollection('guild-123');

      expect(result.stats.goldCount).toBe(2);
      expect(result.stats.silverCount).toBe(1);
      expect(result.stats.bronzeCount).toBe(1);
      expect(result.stats.top10Count).toBe(1);
      expect(result.stats.top25Count).toBe(1);
      expect(result.stats.top50Count).toBe(1);
      expect(result.stats.totalMedals).toBe(7);
      expect(result.stats.bestRank).toBe(1);
    });

    it('includes active bonus in response', async () => {
      mockPrisma.guildTowerRaceMedal.findMany.mockResolvedValue([]);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(createMockMedalBonus());

      const result = await getGuildMedalCollection('guild-123');

      expect(result.activeBonus.isActive).toBe(true);
      expect(result.activeBonus.wavesBonus).toBe(0.10);
    });

    it('calculates best rank correctly', async () => {
      const medals = [
        createMockMedal({ rank: 5 }),
        createMockMedal({ rank: 2 }),
        createMockMedal({ rank: 10 }),
      ];
      mockPrisma.guildTowerRaceMedal.findMany.mockResolvedValue(medals);
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(null);

      const result = await getGuildMedalCollection('guild-123');

      expect(result.stats.bestRank).toBe(2);
    });
  });

  // ============================================================================
  // GET MEDALS FOR WEEK
  // ============================================================================

  describe('getMedalsForWeek', () => {
    it('returns all medals for a specific week', async () => {
      const medals = [
        createMockMedal({ guildId: 'guild-1', rank: 1 }),
        createMockMedal({ guildId: 'guild-2', rank: 2 }),
        createMockMedal({ guildId: 'guild-3', rank: 3 }),
      ];
      mockPrisma.guildTowerRaceMedal.findMany.mockResolvedValue(medals);

      const result = await getMedalsForWeek('2026-W03');

      expect(result).toHaveLength(3);
      expect(mockPrisma.guildTowerRaceMedal.findMany).toHaveBeenCalledWith({
        where: { weekKey: '2026-W03' },
        orderBy: { rank: 'asc' },
      });
    });

    it('returns empty array when no medals for week', async () => {
      mockPrisma.guildTowerRaceMedal.findMany.mockResolvedValue([]);

      const result = await getMedalsForWeek('2026-W99');

      expect(result).toHaveLength(0);
    });
  });

  // ============================================================================
  // HAS GUILD MEDAL FOR WEEK
  // ============================================================================

  describe('hasGuildMedalForWeek', () => {
    it('returns true when guild has medal for week', async () => {
      mockPrisma.guildTowerRaceMedal.findUnique.mockResolvedValue(createMockMedal());

      const result = await hasGuildMedalForWeek('guild-123', '2026-W03');

      expect(result).toBe(true);
    });

    it('returns false when guild has no medal for week', async () => {
      mockPrisma.guildTowerRaceMedal.findUnique.mockResolvedValue(null);

      const result = await hasGuildMedalForWeek('guild-123', '2026-W03');

      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // GET MEDAL LEADERBOARD
  // ============================================================================

  describe('getMedalLeaderboard', () => {
    it('returns gold and total leaders', async () => {
      mockPrisma.guildTowerRaceMedal.groupBy
        .mockResolvedValueOnce([
          { guildId: 'guild-1', _count: { id: 5 } },
          { guildId: 'guild-2', _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { guildId: 'guild-1', _count: { id: 10 } },
          { guildId: 'guild-3', _count: { id: 8 } },
        ]);

      mockPrisma.guild.findMany.mockResolvedValue([
        { id: 'guild-1', name: 'Champions' },
        { id: 'guild-2', name: 'Silver Squad' },
        { id: 'guild-3', name: 'Bronze Brigade' },
      ]);

      const result = await getMedalLeaderboard();

      expect(result.goldLeaders).toHaveLength(2);
      expect(result.goldLeaders[0].guildName).toBe('Champions');
      expect(result.goldLeaders[0].count).toBe(5);

      expect(result.totalLeaders).toHaveLength(2);
      expect(result.totalLeaders[0].guildName).toBe('Champions');
      expect(result.totalLeaders[0].count).toBe(10);
    });

    it('handles unknown guilds in leaderboard', async () => {
      mockPrisma.guildTowerRaceMedal.groupBy
        .mockResolvedValueOnce([{ guildId: 'deleted-guild', _count: { id: 3 } }])
        .mockResolvedValueOnce([{ guildId: 'deleted-guild', _count: { id: 5 } }]);

      mockPrisma.guild.findMany.mockResolvedValue([]); // Guild not found

      const result = await getMedalLeaderboard();

      expect(result.goldLeaders[0].guildName).toBe('Unknown');
      expect(result.totalLeaders[0].guildName).toBe('Unknown');
    });

    it('returns empty leaderboard when no medals exist', async () => {
      mockPrisma.guildTowerRaceMedal.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      mockPrisma.guild.findMany.mockResolvedValue([]);

      const result = await getMedalLeaderboard();

      expect(result.goldLeaders).toHaveLength(0);
      expect(result.totalLeaders).toHaveLength(0);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles large wave counts in bonus calculation', async () => {
      const goldBonus = createMockMedalBonus({ wavesBonus: 0.10 });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(goldBonus);

      const largeWaveCount = 999999;
      const result = await applyWaveBonusMultiplier('guild-123', largeWaveCount);

      expect(result).toBe(1099998); // 999999 + floor(999999 * 0.10) = 999999 + 99999 = 1099998
    });

    it('handles multiple medal distribution in one call', async () => {
      mockPrisma.guildTowerRace.findUnique.mockResolvedValue(createMockGuildTowerRace());

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          guildTowerRaceMedal: { create: vi.fn().mockResolvedValue({}) },
          guildMedalBonus: { upsert: vi.fn().mockResolvedValue({}) },
          guildTreasury: { update: vi.fn().mockResolvedValue({ gold: 0, dust: 0, guildCoins: 0 }) },
          guildMember: { findFirst: vi.fn().mockResolvedValue({ userId: 'leader' }) },
          guildTreasuryLog: { create: vi.fn().mockResolvedValue({}) },
        };
        return await callback(tx);
      });

      const rankings = Array.from({ length: 50 }, (_, i) => ({
        guildId: `guild-${i + 1}`,
        rank: i + 1,
        totalWaves: 10000 - i * 100,
      }));

      const result = await distributeTowerRaceMedals('2026-W03', rankings);

      expect(result.medalsAwarded).toBe(50);
      expect(result.errors).toHaveLength(0);
    });

    it('handles bonus with zero wavesBonus', async () => {
      const zeroBonus = createMockMedalBonus({ wavesBonus: 0 });
      mockPrisma.guildMedalBonus.findUnique.mockResolvedValue(zeroBonus);

      const result = await applyWaveBonusMultiplier('guild-123', 100);

      // Even though bonus exists, wavesBonus is 0 so no change
      expect(result).toBe(100);
    });
  });
});
