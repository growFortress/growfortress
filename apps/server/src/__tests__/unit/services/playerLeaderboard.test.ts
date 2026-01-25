/**
 * Player Leaderboard Service Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  mockPrisma,
  createMockUser,
  createMockWeeklyPlayerReward,
} from '../../mocks/prisma.js';
import { mockRedis, setMockRedisValue, resetRedisMock } from '../../mocks/redis.js';

// Mock the queue module before other imports
vi.mock('../../../lib/queue.js', () => ({
  getCurrentWeekKey: () => '2026-W03',
}));

import '../../helpers/setup.js';

// Import service functions after setup
import {
  getTotalWavesLeaderboard,
  getHonorLeaderboard,
  getLevelLeaderboard,
  getWeeklyWavesLeaderboard,
  getUserRanks,
  getAvailableRewards,
  claimWeeklyReward,
  incrementTotalWaves,
  recordWeeklyHonorGain,
} from '../../../services/playerLeaderboard.js';

describe('Player Leaderboard Service', () => {
  beforeEach(() => {
    resetRedisMock();
  });

  // ==========================================
  // getTotalWavesLeaderboard Tests
  // ==========================================

  describe('getTotalWavesLeaderboard', () => {
    it('should return cached data if available', async () => {
      const cachedData = {
        entries: [
          {
            rank: 1,
            userId: 'user-1',
            displayName: 'TopPlayer',
            guildId: 'guild-1',
            guildTag: 'TOP',
            level: 50,
            score: 10000,
            exclusiveItems: ['badge_champion'],
          },
        ],
        total: 100,
      };
      setMockRedisValue('player-leaderboard:totalWaves', JSON.stringify(cachedData));

      const result = await getTotalWavesLeaderboard(25, 0);

      expect(result.entries.length).toBe(1);
      expect(result.entries[0].displayName).toBe('TopPlayer');
      expect(result.entries[0].score).toBe(10000);
      expect(result.total).toBe(100);
      // Should not have called Prisma since data was cached
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });

    it('should fetch and cache data if not cached', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockUsers = [
        {
          id: 'user-1',
          displayName: 'Player1',
          totalWaves: 5000,
          exclusiveItems: ['badge_gold'],
          guildMembership: { guildId: 'guild-1', guild: { tag: 'PRO' } },
          progression: { level: 30 },
        },
        {
          id: 'user-2',
          displayName: 'Player2',
          totalWaves: 3000,
          exclusiveItems: [],
          guildMembership: null,
          progression: { level: 20 },
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(50);

      const result = await getTotalWavesLeaderboard(25, 0);

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].displayName).toBe('Player1');
      expect(result.entries[0].score).toBe(5000);
      expect(result.entries[0].guildTag).toBe('PRO');
      expect(result.entries[1].rank).toBe(2);
      expect(result.entries[1].guildTag).toBeNull();
      expect(result.total).toBe(50);

      // Should have cached the result
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'player-leaderboard:totalWaves',
        300,
        expect.any(String)
      );
    });

    it('should filter by search term', async () => {
      const cachedData = {
        entries: [
          { rank: 1, userId: 'user-1', displayName: 'Alpha', guildId: null, guildTag: null, level: 10, score: 1000, exclusiveItems: [] },
          { rank: 2, userId: 'user-2', displayName: 'Beta', guildId: null, guildTag: null, level: 10, score: 900, exclusiveItems: [] },
          { rank: 3, userId: 'user-3', displayName: 'AlphaTwo', guildId: null, guildTag: null, level: 10, score: 800, exclusiveItems: [] },
        ],
        total: 3,
      };
      setMockRedisValue('player-leaderboard:totalWaves', JSON.stringify(cachedData));

      const result = await getTotalWavesLeaderboard(25, 0, 'alpha');

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].displayName).toBe('Alpha');
      expect(result.entries[1].displayName).toBe('AlphaTwo');
      expect(result.total).toBe(2);
    });
  });

  // ==========================================
  // getHonorLeaderboard Tests
  // ==========================================

  describe('getHonorLeaderboard', () => {
    it('should return honor rankings', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockUsers = [
        {
          id: 'user-1',
          displayName: 'PvPMaster',
          honor: 2500,
          exclusiveItems: ['pvp_badge'],
          guildMembership: { guildId: 'guild-1', guild: { tag: 'PVP' } },
          progression: { level: 40 },
        },
        {
          id: 'user-2',
          displayName: 'Challenger',
          honor: 1500,
          exclusiveItems: [],
          guildMembership: null,
          progression: { level: 25 },
        },
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.user.count.mockResolvedValue(100);

      const result = await getHonorLeaderboard(25, 0);

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].displayName).toBe('PvPMaster');
      expect(result.entries[0].score).toBe(2500);
      expect(result.entries[1].score).toBe(1500);
      expect(result.total).toBe(100);
    });

    it('should handle empty results', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await getHonorLeaderboard(25, 0);

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ==========================================
  // getLevelLeaderboard Tests
  // ==========================================

  describe('getLevelLeaderboard', () => {
    it('should return level rankings from progression', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockProgressions = [
        {
          level: 100,
          user: {
            id: 'user-1',
            displayName: 'MaxLevel',
            exclusiveItems: ['level_100_badge'],
            guildMembership: { guildId: 'guild-1', guild: { tag: 'MAX' } },
          },
        },
        {
          level: 75,
          user: {
            id: 'user-2',
            displayName: 'HighLevel',
            exclusiveItems: [],
            guildMembership: null,
          },
        },
      ];

      mockPrisma.progression.findMany.mockResolvedValue(mockProgressions);
      mockPrisma.progression.count.mockResolvedValue(200);

      const result = await getLevelLeaderboard(25, 0);

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].displayName).toBe('MaxLevel');
      expect(result.entries[0].level).toBe(100);
      expect(result.entries[0].score).toBe(100);
      expect(result.entries[1].level).toBe(75);
      expect(result.total).toBe(200);
    });

    it('should handle search filter', async () => {
      const cachedData = {
        entries: [
          { rank: 1, userId: 'user-1', displayName: 'MaxPower', guildId: null, guildTag: null, level: 100, score: 100, exclusiveItems: [] },
          { rank: 2, userId: 'user-2', displayName: 'PowerUser', guildId: null, guildTag: null, level: 80, score: 80, exclusiveItems: [] },
          { rank: 3, userId: 'user-3', displayName: 'Casual', guildId: null, guildTag: null, level: 50, score: 50, exclusiveItems: [] },
        ],
        total: 3,
      };
      setMockRedisValue('player-leaderboard:level', JSON.stringify(cachedData));

      const result = await getLevelLeaderboard(25, 0, 'power');

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].displayName).toBe('MaxPower');
      expect(result.entries[1].displayName).toBe('PowerUser');
      expect(result.total).toBe(2);
    });
  });

  // ==========================================
  // getWeeklyWavesLeaderboard Tests
  // ==========================================

  describe('getWeeklyWavesLeaderboard', () => {
    it('should return weekly waves data', async () => {
      mockRedis.get.mockResolvedValue(null);

      const mockEntries = [
        {
          userId: 'user-1',
          wavesThisWeek: 500,
          user: {
            displayName: 'WeeklyChamp',
            exclusiveItems: ['weekly_badge'],
            guildMembership: { guildId: 'guild-1', guild: { tag: 'WKY' } },
            progression: { level: 35 },
          },
        },
        {
          userId: 'user-2',
          wavesThisWeek: 300,
          user: {
            displayName: 'ActivePlayer',
            exclusiveItems: [],
            guildMembership: null,
            progression: { level: 20 },
          },
        },
      ];

      mockPrisma.weeklyPlayerLeaderboard.findMany.mockResolvedValue(mockEntries);
      mockPrisma.weeklyPlayerLeaderboard.count.mockResolvedValue(50);

      const result = await getWeeklyWavesLeaderboard('2026-W03', 25, 0);

      expect(result.entries.length).toBe(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].displayName).toBe('WeeklyChamp');
      expect(result.entries[0].score).toBe(500);
      expect(result.weekKey).toBe('2026-W03');
      expect(result.total).toBe(50);
    });

    it('should use current week key by default', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.weeklyPlayerLeaderboard.findMany.mockResolvedValue([]);
      mockPrisma.weeklyPlayerLeaderboard.count.mockResolvedValue(0);

      const result = await getWeeklyWavesLeaderboard();

      expect(result.weekKey).toBe('2026-W03');
      expect(mockPrisma.weeklyPlayerLeaderboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ weekKey: '2026-W03' }),
        })
      );
    });

    it('should paginate results correctly', async () => {
      const cachedData = {
        entries: Array.from({ length: 50 }, (_, i) => ({
          rank: i + 1,
          userId: `user-${i}`,
          displayName: `Player${i}`,
          guildId: null,
          guildTag: null,
          level: 10,
          score: 1000 - i * 10,
          exclusiveItems: [],
        })),
        total: 50,
      };
      setMockRedisValue('player-leaderboard:weeklyWaves:2026-W03', JSON.stringify(cachedData));

      const result = await getWeeklyWavesLeaderboard('2026-W03', 10, 20);

      expect(result.entries.length).toBe(10);
      expect(result.entries[0].rank).toBe(21);
      expect(result.entries[0].displayName).toBe('Player20');
      expect(result.entries[9].rank).toBe(30);
      expect(result.total).toBe(50);
    });
  });

  // ==========================================
  // getUserRanks Tests
  // ==========================================

  describe('getUserRanks', () => {
    it('should return ranks for all categories', async () => {
      const mockUser = {
        totalWaves: 5000,
        honor: 1500,
        progression: { level: 40 },
        weeklyPlayerLeaderboards: [
          { wavesThisWeek: 200, honorGained: 100 },
        ],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      // Mocking rank counts (users with higher values)
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // totalWaves rank = 11
        .mockResolvedValueOnce(5);  // honor rank = 6
      mockPrisma.progression.count.mockResolvedValue(8); // level rank = 9
      mockPrisma.weeklyPlayerLeaderboard.count
        .mockResolvedValueOnce(15) // weekly waves rank = 16
        .mockResolvedValueOnce(20); // weekly honor rank = 21

      const result = await getUserRanks('user-123');

      expect(result.length).toBe(5);
      expect(result[0]).toEqual({ category: 'totalWaves', rank: 11, score: 5000 });
      expect(result[1]).toEqual({ category: 'honor', rank: 6, score: 1500 });
      expect(result[2]).toEqual({ category: 'level', rank: 9, score: 40 });
      expect(result[3]).toEqual({ category: 'weeklyWaves', rank: 16, score: 200 });
      expect(result[4]).toEqual({ category: 'weeklyHonor', rank: 21, score: 100 });
    });

    it('should handle user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getUserRanks('nonexistent-user');

      expect(result).toEqual([]);
    });

    it('should return null rank for zero scores', async () => {
      const mockUser = {
        totalWaves: 0,
        honor: 0,
        progression: null,
        weeklyPlayerLeaderboards: [],
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await getUserRanks('user-123');

      expect(result.length).toBe(5);
      expect(result[0]).toEqual({ category: 'totalWaves', rank: null, score: 0 });
      expect(result[1]).toEqual({ category: 'honor', rank: 1, score: 0 }); // Honor always returns a rank
      expect(result[2]).toEqual({ category: 'level', rank: null, score: 1 }); // Default level 1
      expect(result[3]).toEqual({ category: 'weeklyWaves', rank: null, score: 0 });
      expect(result[4]).toEqual({ category: 'weeklyHonor', rank: null, score: 0 });
    });
  });

  // ==========================================
  // getAvailableRewards Tests
  // ==========================================

  describe('getAvailableRewards', () => {
    it('should return unclaimed, non-expired rewards', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockRewards = [
        createMockWeeklyPlayerReward({
          id: 'reward-1',
          weekKey: '2026-W02',
          category: 'waves',
          rank: 1,
          goldAmount: 5000,
          dustAmount: 500,
          itemIds: ['exclusive_top1'],
          claimed: false,
          expiresAt: futureDate,
        }),
        createMockWeeklyPlayerReward({
          id: 'reward-2',
          weekKey: '2026-W02',
          category: 'honor',
          rank: 5,
          goldAmount: 2000,
          dustAmount: 200,
          itemIds: [],
          claimed: false,
          expiresAt: futureDate,
        }),
      ];

      mockPrisma.weeklyPlayerReward.findMany.mockResolvedValue(mockRewards);

      const result = await getAvailableRewards('user-123');

      expect(result.length).toBe(2);
      expect(result[0].id).toBe('reward-1');
      expect(result[0].category).toBe('waves');
      expect(result[0].rank).toBe(1);
      expect(result[0].goldAmount).toBe(5000);
      expect(result[1].category).toBe('honor');
    });

    it('should return empty array if no rewards', async () => {
      mockPrisma.weeklyPlayerReward.findMany.mockResolvedValue([]);

      const result = await getAvailableRewards('user-123');

      expect(result).toEqual([]);
    });
  });

  // ==========================================
  // claimWeeklyReward Tests
  // ==========================================

  describe('claimWeeklyReward', () => {
    it('should throw if reward not found', async () => {
      mockPrisma.weeklyPlayerReward.findUnique.mockResolvedValue(null);

      await expect(claimWeeklyReward('user-123', 'nonexistent-reward'))
        .rejects.toThrow('Reward not found');
    });

    it('should throw if reward belongs to different user', async () => {
      mockPrisma.weeklyPlayerReward.findUnique.mockResolvedValue(
        createMockWeeklyPlayerReward({ userId: 'different-user' })
      );

      await expect(claimWeeklyReward('user-123', 'reward-1'))
        .rejects.toThrow('Reward not found');
    });

    it('should throw if already claimed', async () => {
      mockPrisma.weeklyPlayerReward.findUnique.mockResolvedValue(
        createMockWeeklyPlayerReward({ userId: 'user-123', claimed: true })
      );

      await expect(claimWeeklyReward('user-123', 'reward-1'))
        .rejects.toThrow('Reward already claimed');
    });

    it('should throw if expired', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      mockPrisma.weeklyPlayerReward.findUnique.mockResolvedValue(
        createMockWeeklyPlayerReward({
          userId: 'user-123',
          claimed: false,
          expiresAt: pastDate,
        })
      );

      await expect(claimWeeklyReward('user-123', 'reward-1'))
        .rejects.toThrow('Reward expired');
    });

    it('should grant rewards and update claimed status', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockReward = createMockWeeklyPlayerReward({
        id: 'reward-1',
        userId: 'user-123',
        goldAmount: 5000,
        dustAmount: 500,
        itemIds: ['exclusive_item_1', 'exclusive_item_2'],
        claimed: false,
        expiresAt: futureDate,
      });

      mockPrisma.weeklyPlayerReward.findUnique.mockResolvedValue(mockReward);
      mockPrisma.user.findUnique.mockResolvedValue(
        createMockUser({ exclusiveItems: ['existing_item'] })
      );
      mockPrisma.$transaction.mockResolvedValue([]);

      const result = await claimWeeklyReward('user-123', 'reward-1');

      expect(result.success).toBe(true);
      expect(result.goldAmount).toBe(5000);
      expect(result.dustAmount).toBe(500);
      expect(result.itemIds).toEqual(['exclusive_item_1', 'exclusive_item_2']);
      expect(result.newExclusiveItems).toEqual(['exclusive_item_1', 'exclusive_item_2']);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================
  // incrementTotalWaves Tests
  // ==========================================

  describe('incrementTotalWaves', () => {
    it('should update user totalWaves', async () => {
      mockPrisma.$transaction.mockResolvedValue([]);

      await incrementTotalWaves('user-123', 50);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Verify cache invalidation
      expect(mockRedis.del).toHaveBeenCalledWith('player-leaderboard:totalWaves');
      expect(mockRedis.del).toHaveBeenCalledWith('player-leaderboard:weeklyWaves:2026-W03');
    });

    it('should upsert weekly leaderboard entry', async () => {
      mockPrisma.$transaction.mockImplementation(async (operations) => {
        // Verify both operations are included
        expect(operations.length).toBe(2);
        return [];
      });

      await incrementTotalWaves('user-123', 100);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ==========================================
  // recordWeeklyHonorGain Tests
  // ==========================================

  describe('recordWeeklyHonorGain', () => {
    it('should skip if honor is 0 or negative', async () => {
      await recordWeeklyHonorGain('user-123', 0);
      await recordWeeklyHonorGain('user-123', -50);

      expect(mockPrisma.weeklyPlayerLeaderboard.upsert).not.toHaveBeenCalled();
    });

    it('should upsert weekly honor', async () => {
      mockPrisma.weeklyPlayerLeaderboard.upsert.mockResolvedValue({});

      await recordWeeklyHonorGain('user-123', 50);

      expect(mockPrisma.weeklyPlayerLeaderboard.upsert).toHaveBeenCalledWith({
        where: { weekKey_userId: { weekKey: '2026-W03', userId: 'user-123' } },
        update: { honorGained: { increment: 50 } },
        create: { weekKey: '2026-W03', userId: 'user-123', honorGained: 50 },
      });
      expect(mockRedis.del).toHaveBeenCalledWith('player-leaderboard:weeklyHonor:2026-W03');
    });
  });
});
