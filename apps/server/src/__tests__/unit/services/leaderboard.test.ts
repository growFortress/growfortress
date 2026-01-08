/**
 * Leaderboard service tests
 */
import { describe, it, expect, vi } from 'vitest';
import { upsertLeaderboardEntry, getWeeklyLeaderboard, getUserRank } from '../../../services/leaderboard.js';
import { mockPrisma, createMockLeaderboardEntry, createMockUser } from '../../mocks/prisma.js';
import { mockRedis, setMockRedisValue } from '../../mocks/redis.js';

// Mock the queue module
vi.mock('../../../lib/queue.js', () => ({
  getCurrentWeekKey: () => '2024-W01',
}));

describe('Leaderboard Service', () => {
  describe('upsertLeaderboardEntry', () => {
    it('creates new entry if none exists', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );

      await upsertLeaderboardEntry('user-123', 'run-123', 5000, '2024-W01');

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalledWith({
        where: {
          weekKey_userId: {
            weekKey: '2024-W01',
            userId: 'user-123',
          },
        },
        update: {
          score: 5000,
          runId: 'run-123',
        },
        create: {
          weekKey: '2024-W01',
          userId: 'user-123',
          score: 5000,
          runId: 'run-123',
        },
      });
    });

    it('updates entry if new score is higher', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 3000 })
      );
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );

      await upsertLeaderboardEntry('user-123', 'run-456', 5000, '2024-W01');

      expect(mockPrisma.leaderboardEntry.upsert).toHaveBeenCalled();
    });

    it('does not update if existing score is higher', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 8000 })
      );

      await upsertLeaderboardEntry('user-123', 'run-456', 5000, '2024-W01');

      expect(mockPrisma.leaderboardEntry.upsert).not.toHaveBeenCalled();
    });

    it('does not update if existing score is equal', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );

      await upsertLeaderboardEntry('user-123', 'run-456', 5000, '2024-W01');

      expect(mockPrisma.leaderboardEntry.upsert).not.toHaveBeenCalled();
    });

    it('invalidates cache on update', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );

      await upsertLeaderboardEntry('user-123', 'run-123', 5000, '2024-W01');

      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:weekly:2024-W01');
    });

    it('uses default week key if not provided', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(
        createMockLeaderboardEntry()
      );

      await upsertLeaderboardEntry('user-123', 'run-123', 5000);

      expect(mockPrisma.leaderboardEntry.findUnique).toHaveBeenCalledWith({
        where: {
          weekKey_userId: {
            weekKey: '2024-W01',
            userId: 'user-123',
          },
        },
      });
    });
  });

  describe('getWeeklyLeaderboard', () => {
    it('returns cached result if available', async () => {
      const cached = {
        weekKey: '2024-W01',
        entries: [
          { rank: 1, userId: 'user-1', score: 10000, wavesCleared: 15, createdAt: '2024-01-01' },
        ],
        total: 1,
      };
      setMockRedisValue('leaderboard:weekly:2024-W01:10:0', JSON.stringify(cached));

      const result = await getWeeklyLeaderboard('2024-W01', 10, 0);

      expect(result).toEqual(cached);
      expect(mockPrisma.leaderboardEntry.findMany).not.toHaveBeenCalled();
    });

    it('fetches from database if not cached', async () => {
      const mockEntry = createMockLeaderboardEntry({ score: 5000 });
      const mockUser = createMockUser();

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        {
          ...mockEntry,
          user: {
            ...mockUser,
            runs: [{ summaryJson: { wavesCleared: 10 } }],
          },
        },
      ]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(1);

      const result = await getWeeklyLeaderboard('2024-W01', 10, 0);

      expect(result.weekKey).toBe('2024-W01');
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].score).toBe(5000);
      expect(result.entries[0].wavesCleared).toBe(10);
      expect(result.total).toBe(1);
    });

    it('caches result after fetching', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

      await getWeeklyLeaderboard('2024-W01', 10, 0);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:weekly:2024-W01:10:0',
        300, // 5 minutes TTL
        expect.any(String)
      );
    });

    it('handles pagination correctly', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(50);

      await getWeeklyLeaderboard('2024-W01', 10, 20);

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });

    it('calculates rank based on offset', async () => {
      const mockEntry = createMockLeaderboardEntry({ score: 3000 });
      const mockUser = createMockUser();

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        {
          ...mockEntry,
          user: { ...mockUser, runs: [] },
        },
      ]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(25);

      const result = await getWeeklyLeaderboard('2024-W01', 10, 20);

      expect(result.entries[0].rank).toBe(21); // offset + index + 1
    });

    it('defaults to 0 wavesCleared if no runs', async () => {
      const mockEntry = createMockLeaderboardEntry({ score: 5000 });
      const mockUser = createMockUser();

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        {
          ...mockEntry,
          user: { ...mockUser, runs: [] },
        },
      ]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(1);

      const result = await getWeeklyLeaderboard('2024-W01');

      expect(result.entries[0].wavesCleared).toBe(0);
    });

    it('uses default parameters', async () => {
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([]);
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

      await getWeeklyLeaderboard();

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { weekKey: '2024-W01' },
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe('getUserRank', () => {
    it('returns null if user has no entry', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);

      const result = await getUserRank('user-123', '2024-W01');

      expect(result).toBeNull();
    });

    it('returns rank and score for existing entry', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );
      mockPrisma.leaderboardEntry.count.mockResolvedValue(3);

      const result = await getUserRank('user-123', '2024-W01');

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(4); // 3 higher scores + 1
      expect(result!.score).toBe(5000);
    });

    it('returns rank 1 if highest score', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 10000 })
      );
      mockPrisma.leaderboardEntry.count.mockResolvedValue(0);

      const result = await getUserRank('user-123', '2024-W01');

      expect(result!.rank).toBe(1);
    });

    it('counts only higher scores correctly', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );
      mockPrisma.leaderboardEntry.count.mockResolvedValue(10);

      const result = await getUserRank('user-123', '2024-W01');

      expect(mockPrisma.leaderboardEntry.count).toHaveBeenCalledWith({
        where: {
          weekKey: '2024-W01',
          score: { gt: 5000 },
        },
      });
      expect(result!.rank).toBe(11);
    });

    it('uses default week key', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);

      await getUserRank('user-123');

      expect(mockPrisma.leaderboardEntry.findUnique).toHaveBeenCalledWith({
        where: {
          weekKey_userId: {
            weekKey: '2024-W01',
            userId: 'user-123',
          },
        },
      });
    });
  });
});
