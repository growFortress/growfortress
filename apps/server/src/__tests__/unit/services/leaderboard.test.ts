/**
 * Leaderboard service tests
 */
import { describe, it, expect, vi } from 'vitest';
import { upsertLeaderboardEntry, getWeeklyLeaderboard, getUserRank } from '../../../services/leaderboard.js';
import { mockPrisma, createMockLeaderboardEntry } from '../../mocks/prisma.js';
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

    it('updates sorted set on update', async () => {
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.upsert.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );

      await upsertLeaderboardEntry('user-123', 'run-123', 5000, '2024-W01');

      // Should update sorted set in real-time
      expect(mockRedis.zadd).toHaveBeenCalledWith('leaderboard:zset:2024-W01', 5000, 'user-123');
      // Should invalidate metadata cache
      expect(mockRedis.del).toHaveBeenCalledWith('leaderboard:weekly:2024-W01:metadata');
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
    it('returns entries from sorted set', async () => {
      // Mock sorted set exists
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrevrange.mockResolvedValue(['user-1', '10000']); // WITHSCORES format
      
      // Mock metadata cache
      const metadata = {
        'user-1': {
          displayName: 'TestPlayer',
          wavesCleared: 15,
          createdAt: '2024-01-01T00:00:00.000Z',
        },
      };
      setMockRedisValue('leaderboard:weekly:2024-W01:metadata', JSON.stringify(metadata));

      const result = await getWeeklyLeaderboard('2024-W01', 10, 0);

      expect(result.weekKey).toBe('2024-W01');
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].userId).toBe('user-1');
      expect(result.entries[0].score).toBe(10000);
      expect(result.entries[0].displayName).toBe('TestPlayer');
      expect(result.total).toBe(1);
    });

    it('syncs from database if sorted set missing', async () => {
      // Sorted set doesn't exist, will sync from DB
      mockRedis.exists.mockResolvedValue(0);
      mockPrisma.leaderboardEntry.findMany
        .mockResolvedValueOnce([
          // First call: sync sorted set
          {
            userId: 'user-123',
            score: 5000,
          },
        ])
        .mockResolvedValueOnce([
          // Second call: get metadata
          {
            userId: 'user-123',
            createdAt: new Date('2024-01-01'),
            runId: 'run-123',
            user: { displayName: 'TestPlayer' },
          },
        ]);
      mockPrisma.run.findMany.mockResolvedValue([
        { id: 'run-123', summaryJson: { wavesCleared: 10 } },
      ]);

      // After sync, sorted set exists
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrevrange.mockResolvedValue(['user-123', '5000']);

      const result = await getWeeklyLeaderboard('2024-W01', 10, 0);

      expect(result.weekKey).toBe('2024-W01');
      expect(result.entries.length).toBe(1);
      expect(result.entries[0].rank).toBe(1);
      expect(result.entries[0].score).toBe(5000);
      expect(result.entries[0].displayName).toBe('TestPlayer');
      expect(result.entries[0].wavesCleared).toBe(10);
      expect(result.total).toBe(1);
      // Should have synced sorted set
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it('caches metadata after fetching', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrevrange.mockResolvedValue(['user-123', '5000']);
      mockRedis.get.mockResolvedValue(null); // No cached metadata

      // Mock metadata fetch from database
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        {
          userId: 'user-123',
          createdAt: new Date('2024-01-01'),
          runId: 'run-123',
          user: { displayName: 'TestPlayer' },
        },
      ]);
      mockPrisma.run.findMany.mockResolvedValue([
        { id: 'run-123', summaryJson: { wavesCleared: 10 } },
      ]);

      await getWeeklyLeaderboard('2024-W01', 10, 0);

      // Metadata should be cached
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'leaderboard:weekly:2024-W01:metadata',
        3600, // 1 hour TTL
        expect.any(String)
      );
    });

    it('handles pagination correctly', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zcard.mockResolvedValue(50);
      // Return 30 entries (offset 20 + limit 10)
      const entries = Array.from({ length: 30 }, (_, i) => [`user-${i}`, String(10000 - i * 100)]);
      const flatEntries = entries.flat();
      mockRedis.zrevrange.mockResolvedValue(flatEntries);

      // Mock metadata for all users
      const metadata: Record<string, any> = {};
      for (let i = 0; i < 30; i++) {
        metadata[`user-${i}`] = {
          displayName: `Player${i}`,
          wavesCleared: 10,
          createdAt: '2024-01-01T00:00:00.000Z',
        };
      }
      setMockRedisValue('leaderboard:weekly:2024-W01:metadata', JSON.stringify(metadata));

      const result = await getWeeklyLeaderboard('2024-W01', 10, 20);

      // Should fetch range 0-29 (offset 20 + limit 10 = 30 entries)
      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        'leaderboard:zset:2024-W01',
        0,
        29,
        'WITHSCORES'
      );
      expect(result.entries.length).toBe(10);
      expect(result.entries[0].rank).toBe(21); // offset + 1
    });

    it('calculates rank based on offset', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zcard.mockResolvedValue(25);
      const entries = Array.from({ length: 25 }, (_, i) => [`user-${i}`, String(10000 - i * 100)]);
      const flatEntries = entries.flat();
      mockRedis.zrevrange.mockResolvedValue(flatEntries);

      const metadata: Record<string, any> = {};
      for (let i = 0; i < 25; i++) {
        metadata[`user-${i}`] = {
          displayName: `Player${i}`,
          wavesCleared: 10,
          createdAt: '2024-01-01T00:00:00.000Z',
        };
      }
      setMockRedisValue('leaderboard:weekly:2024-W01:metadata', JSON.stringify(metadata));

      const result = await getWeeklyLeaderboard('2024-W01', 10, 20);

      expect(result.entries[0].rank).toBe(21); // offset + index + 1
    });

    it('defaults to 0 wavesCleared if no runs', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.zrevrange.mockResolvedValue(['user-123', '5000']);

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        {
          userId: 'user-123',
          createdAt: new Date('2024-01-01'),
          runId: 'run-123',
          user: { displayName: 'TestPlayer' },
        },
      ]);
      mockPrisma.run.findMany.mockResolvedValue([]); // No runs found

      const result = await getWeeklyLeaderboard('2024-W01');

      expect(result.entries[0].wavesCleared).toBe(0);
    });

    it('uses default parameters', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zcard.mockResolvedValue(0);
      mockRedis.zrevrange.mockResolvedValue([]);

      await getWeeklyLeaderboard();

      expect(mockRedis.zrevrange).toHaveBeenCalledWith(
        'leaderboard:zset:2024-W01',
        0,
        9, // default limit 10
        'WITHSCORES'
      );
    });
  });

  describe('getUserRank', () => {
    it('returns null if user has no entry', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zscore.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);

      const result = await getUserRank('user-123', '2024-W01');

      expect(result).toBeNull();
    });

    it('returns rank and score from sorted set', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zscore.mockResolvedValue('5000');
      mockRedis.zrevrank.mockResolvedValue(3); // 0-indexed, so rank 4

      const result = await getUserRank('user-123', '2024-W01');

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(4); // zrevrank + 1
      expect(result!.score).toBe(5000);
    });

    it('returns rank 1 if highest score', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zscore.mockResolvedValue('10000');
      mockRedis.zrevrank.mockResolvedValue(0); // Top of leaderboard

      const result = await getUserRank('user-123', '2024-W01');

      expect(result!.rank).toBe(1);
    });

    it('syncs from DB and adds to sorted set if user not in sorted set', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zscore.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(
        createMockLeaderboardEntry({ score: 5000 })
      );
      mockRedis.zrevrank.mockResolvedValue(10);

      const result = await getUserRank('user-123', '2024-W01');

      // Should add to sorted set
      expect(mockRedis.zadd).toHaveBeenCalledWith('leaderboard:zset:2024-W01', 5000, 'user-123');
      expect(result!.rank).toBe(11);
      expect(result!.score).toBe(5000);
    });

    it('syncs sorted set from DB if missing', async () => {
      mockRedis.exists.mockResolvedValue(0);
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([
        { userId: 'user-123', score: 5000 },
      ]);
      mockRedis.zscore.mockResolvedValue('5000');
      mockRedis.zrevrank.mockResolvedValue(0);

      const result = await getUserRank('user-123', '2024-W01');

      // Should sync sorted set
      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalled();
      expect(result!.rank).toBe(1);
    });

    it('uses default week key', async () => {
      mockRedis.exists.mockResolvedValue(1);
      mockRedis.zscore.mockResolvedValue(null);
      mockPrisma.leaderboardEntry.findUnique.mockResolvedValue(null);

      await getUserRank('user-123');

      expect(mockRedis.zscore).toHaveBeenCalledWith('leaderboard:zset:2024-W01', 'user-123');
    });
  });
});
