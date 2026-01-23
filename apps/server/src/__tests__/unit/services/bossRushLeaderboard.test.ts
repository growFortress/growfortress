/**
 * Boss Rush Leaderboard service tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockPrisma } from '../../mocks/prisma.js';
import { mockRedis, setMockRedisValue, resetRedisMock } from '../../mocks/redis.js';
import '../../helpers/setup.js';

// Mock the queue module
vi.mock('../../../lib/queue.js', () => ({
  getCurrentWeekKey: () => '2026-W03',
}));

// Import service functions after setup
import {
  upsertBossRushLeaderboardEntry,
  getBossRushLeaderboard,
  getUserBossRushRank,
  getBossRushAvailableWeeks,
} from '../../../services/bossRushLeaderboard.js';

// Helper to create mock boss rush leaderboard entry
function createMockBossRushEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brle-123',
    weekKey: '2026-W03',
    userId: 'user-123',
    sessionId: 'session-123',
    totalDamage: BigInt(1000000),
    bossesKilled: 5,
    createdAt: new Date('2026-01-15T00:00:00.000Z'),
    updatedAt: new Date('2026-01-15T00:00:00.000Z'),
    user: {
      displayName: 'TestPlayer',
    },
    ...overrides,
  };
}

describe('Boss Rush Leaderboard Service', () => {
  beforeEach(() => {
    resetRedisMock();
    vi.clearAllMocks();
  });

  describe('upsertBossRushLeaderboardEntry', () => {
    it('creates new entry if none exists', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);
      mockPrisma.bossRushLeaderboard.upsert.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(500000) })
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-123',
        BigInt(500000),
        3,
        '2026-W03'
      );

      expect(mockPrisma.bossRushLeaderboard.upsert).toHaveBeenCalledWith({
        where: {
          weekKey_userId: {
            weekKey: '2026-W03',
            userId: 'user-123',
          },
        },
        update: {
          totalDamage: BigInt(500000),
          bossesKilled: 3,
          sessionId: 'session-123',
        },
        create: {
          weekKey: '2026-W03',
          userId: 'user-123',
          totalDamage: BigInt(500000),
          bossesKilled: 3,
          sessionId: 'session-123',
        },
      });
    });

    it('updates entry if new damage is higher', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(300000) })
      );
      mockPrisma.bossRushLeaderboard.upsert.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(500000) })
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-456',
        BigInt(500000),
        5,
        '2026-W03'
      );

      expect(mockPrisma.bossRushLeaderboard.upsert).toHaveBeenCalled();
    });

    it('does not update if existing damage is higher', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(800000) })
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-456',
        BigInt(500000),
        3,
        '2026-W03'
      );

      expect(mockPrisma.bossRushLeaderboard.upsert).not.toHaveBeenCalled();
    });

    it('does not update if existing damage is equal', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(500000) })
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-456',
        BigInt(500000),
        5,
        '2026-W03'
      );

      expect(mockPrisma.bossRushLeaderboard.upsert).not.toHaveBeenCalled();
    });

    it('invalidates cache after updating entry', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);
      mockPrisma.bossRushLeaderboard.upsert.mockResolvedValue(
        createMockBossRushEntry()
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-123',
        BigInt(500000),
        3,
        '2026-W03'
      );

      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:boss_rush:2026-W03:full');
    });

    it('uses default week key if not provided', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);
      mockPrisma.bossRushLeaderboard.upsert.mockResolvedValue(
        createMockBossRushEntry()
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-123',
        BigInt(500000),
        3
      );

      expect(mockPrisma.bossRushLeaderboard.findUnique).toHaveBeenCalledWith({
        where: {
          weekKey_userId: {
            weekKey: '2026-W03',
            userId: 'user-123',
          },
        },
      });
    });
  });

  describe('getBossRushLeaderboard', () => {
    it('returns cached entries when available', async () => {
      const cachedData = {
        entries: [
          {
            rank: 1,
            userId: 'user-1',
            displayName: 'TopPlayer',
            totalDamage: 2000000,
            bossesKilled: 10,
            createdAt: '2026-01-15T00:00:00.000Z',
          },
          {
            rank: 2,
            userId: 'user-2',
            displayName: 'SecondPlayer',
            totalDamage: 1500000,
            bossesKilled: 8,
            createdAt: '2026-01-15T00:00:00.000Z',
          },
        ],
        total: 2,
      };
      setMockRedisValue('leaderboard:boss_rush:2026-W03:full', JSON.stringify(cachedData));

      const result = await getBossRushLeaderboard('2026-W03', 10, 0);

      expect(result.weekKey).toBe('2026-W03');
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].displayName).toBe('TopPlayer');
      expect(result.total).toBe(2);
      expect(mockPrisma.bossRushLeaderboard.findMany).not.toHaveBeenCalled();
    });

    it('fetches from database when cache is empty', async () => {
      const mockEntries = [
        createMockBossRushEntry({
          userId: 'user-1',
          totalDamage: BigInt(2000000),
          bossesKilled: 10,
          user: { displayName: 'TopPlayer' },
        }),
        createMockBossRushEntry({
          userId: 'user-2',
          totalDamage: BigInt(1500000),
          bossesKilled: 8,
          user: { displayName: 'SecondPlayer' },
        }),
      ];

      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue(mockEntries);
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(2);

      const result = await getBossRushLeaderboard('2026-W03', 10, 0);

      expect(result.weekKey).toBe('2026-W03');
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].totalDamage).toBe(2000000);
      expect(result.total).toBe(2);
    });

    it('caches result after fetching from database', async () => {
      const mockEntries = [
        createMockBossRushEntry({
          userId: 'user-1',
          totalDamage: BigInt(2000000),
          user: { displayName: 'TopPlayer' },
        }),
      ];

      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue(mockEntries);
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(1);

      await getBossRushLeaderboard('2026-W03', 10, 0);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:boss_rush:2026-W03:full',
        300, // 5 minutes TTL
        expect.any(String)
      );
    });

    it('handles pagination correctly', async () => {
      const cachedData = {
        entries: Array.from({ length: 50 }, (_, i) => ({
          rank: i + 1,
          userId: `user-${i}`,
          displayName: `Player${i}`,
          totalDamage: 1000000 - i * 10000,
          bossesKilled: 10 - Math.floor(i / 5),
          createdAt: '2026-01-15T00:00:00.000Z',
        })),
        total: 50,
      };
      setMockRedisValue('leaderboard:boss_rush:2026-W03:full', JSON.stringify(cachedData));

      const result = await getBossRushLeaderboard('2026-W03', 10, 20);

      expect(result.entries.length).toBe(10);
      expect(result.entries[0].rank).toBe(21); // offset + 1
      expect(result.entries[0].userId).toBe('user-20');
      expect(result.total).toBe(50);
    });

    it('calculates rank based on offset', async () => {
      const cachedData = {
        entries: Array.from({ length: 25 }, (_, i) => ({
          rank: i + 1,
          userId: `user-${i}`,
          displayName: `Player${i}`,
          totalDamage: 1000000 - i * 10000,
          bossesKilled: 10,
          createdAt: '2026-01-15T00:00:00.000Z',
        })),
        total: 25,
      };
      setMockRedisValue('leaderboard:boss_rush:2026-W03:full', JSON.stringify(cachedData));

      const result = await getBossRushLeaderboard('2026-W03', 5, 15);

      expect(result.entries[0].rank).toBe(16); // offset + 1
      expect(result.entries[4].rank).toBe(20); // offset + 5
    });

    it('uses default parameters', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([]);
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(0);

      const result = await getBossRushLeaderboard();

      expect(result.weekKey).toBe('2026-W03');
      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty array when no entries exist', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([]);
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(0);

      const result = await getBossRushLeaderboard('2026-W03', 10, 0);

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('limits database fetch to 100 entries', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([]);
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(0);

      await getBossRushLeaderboard('2026-W03', 10, 0);

      expect(mockPrisma.bossRushLeaderboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });
  });

  describe('getUserBossRushRank', () => {
    it('returns null if user has no entry', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);

      const result = await getUserBossRushRank('user-123', '2026-W03');

      expect(result).toBeNull();
    });

    it('returns rank and totalDamage for user with entry', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(500000) })
      );
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(2); // 2 players have higher damage

      const result = await getUserBossRushRank('user-123', '2026-W03');

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(3); // 2 higher + 1
      expect(result!.totalDamage).toBe(500000);
    });

    it('returns rank 1 if user has highest damage', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: BigInt(10000000) })
      );
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(0); // No one has higher damage

      const result = await getUserBossRushRank('user-123', '2026-W03');

      expect(result!.rank).toBe(1);
    });

    it('uses default week key if not provided', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);

      await getUserBossRushRank('user-123');

      expect(mockPrisma.bossRushLeaderboard.findUnique).toHaveBeenCalledWith({
        where: {
          weekKey_userId: {
            weekKey: '2026-W03',
            userId: 'user-123',
          },
        },
      });
    });

    it('counts entries with strictly greater damage', async () => {
      const userEntry = createMockBossRushEntry({ totalDamage: BigInt(500000) });
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(userEntry);
      mockPrisma.bossRushLeaderboard.count.mockResolvedValue(5);

      await getUserBossRushRank('user-123', '2026-W03');

      expect(mockPrisma.bossRushLeaderboard.count).toHaveBeenCalledWith({
        where: {
          weekKey: '2026-W03',
          totalDamage: { gt: BigInt(500000) },
        },
      });
    });
  });

  describe('getBossRushAvailableWeeks', () => {
    it('returns list of available week keys', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([
        { weekKey: '2026-W03' },
        { weekKey: '2026-W02' },
        { weekKey: '2026-W01' },
      ]);

      const result = await getBossRushAvailableWeeks();

      expect(result).toEqual(['2026-W03', '2026-W02', '2026-W01']);
    });

    it('returns empty array when no weeks exist', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([]);

      const result = await getBossRushAvailableWeeks();

      expect(result).toEqual([]);
    });

    it('respects limit parameter', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([
        { weekKey: '2026-W03' },
        { weekKey: '2026-W02' },
        { weekKey: '2026-W01' },
      ]);

      await getBossRushAvailableWeeks(3);

      expect(mockPrisma.bossRushLeaderboard.findMany).toHaveBeenCalledWith({
        distinct: ['weekKey'],
        orderBy: { weekKey: 'desc' },
        take: 3,
        select: { weekKey: true },
      });
    });

    it('uses default limit of 10', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([]);

      await getBossRushAvailableWeeks();

      expect(mockPrisma.bossRushLeaderboard.findMany).toHaveBeenCalledWith({
        distinct: ['weekKey'],
        orderBy: { weekKey: 'desc' },
        take: 10,
        select: { weekKey: true },
      });
    });

    it('orders weeks in descending order (most recent first)', async () => {
      mockPrisma.bossRushLeaderboard.findMany.mockResolvedValue([
        { weekKey: '2026-W03' },
        { weekKey: '2026-W02' },
      ]);

      await getBossRushAvailableWeeks();

      expect(mockPrisma.bossRushLeaderboard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { weekKey: 'desc' },
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('handles very large damage values correctly', async () => {
      const largeDamage = BigInt('9007199254740991'); // Max safe integer
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);
      mockPrisma.bossRushLeaderboard.upsert.mockResolvedValue(
        createMockBossRushEntry({ totalDamage: largeDamage })
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-123',
        largeDamage,
        100,
        '2026-W03'
      );

      expect(mockPrisma.bossRushLeaderboard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            totalDamage: largeDamage,
          }),
        })
      );
    });

    it('handles zero bosses killed', async () => {
      mockPrisma.bossRushLeaderboard.findUnique.mockResolvedValue(null);
      mockPrisma.bossRushLeaderboard.upsert.mockResolvedValue(
        createMockBossRushEntry({ bossesKilled: 0 })
      );

      await upsertBossRushLeaderboardEntry(
        'user-123',
        'session-123',
        BigInt(100),
        0,
        '2026-W03'
      );

      expect(mockPrisma.bossRushLeaderboard.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            bossesKilled: 0,
          }),
        })
      );
    });

    it('handles pagination beyond available entries', async () => {
      const cachedData = {
        entries: [
          {
            rank: 1,
            userId: 'user-1',
            displayName: 'OnlyPlayer',
            totalDamage: 1000000,
            bossesKilled: 5,
            createdAt: '2026-01-15T00:00:00.000Z',
          },
        ],
        total: 1,
      };
      setMockRedisValue('leaderboard:boss_rush:2026-W03:full', JSON.stringify(cachedData));

      const result = await getBossRushLeaderboard('2026-W03', 10, 100);

      expect(result.entries).toEqual([]);
      expect(result.total).toBe(1);
    });
  });
});
