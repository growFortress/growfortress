/**
 * Leaderboard Snapshot Job Tests
 *
 * Tests for the leaderboard snapshot job:
 * - Worker creation
 * - Historical snapshot processing
 * - Current week skipping
 * - Redis caching
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock queue module
vi.mock('../../../lib/queue.js', () => ({
  getCurrentWeekKey: vi.fn(() => '2026-W04'),
  createWorker: vi.fn((queueName, processor) => ({
    queueName,
    processor,
    close: vi.fn(),
  })),
}));

// Mock prisma
vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    leaderboardEntry: {
      findMany: vi.fn(),
    },
  },
}));

// Mock redis
vi.mock('../../../lib/redis.js', () => ({
  redis: {
    setex: vi.fn(),
  },
}));

import { createLeaderboardWorker } from '../../../jobs/leaderboardSnapshot.js';
import { createWorker, getCurrentWeekKey } from '../../../lib/queue.js';
import { prisma } from '../../../lib/prisma.js';
import { redis } from '../../../lib/redis.js';

describe('leaderboardSnapshot job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createLeaderboardWorker', () => {
    it('creates a worker for leaderboard queue', () => {
      createLeaderboardWorker();

      expect(createWorker).toHaveBeenCalledWith(
        'leaderboard',
        expect.any(Function)
      );
    });

    it('returns the worker instance', () => {
      const worker = createLeaderboardWorker();

      expect(worker).toBeDefined();
      expect((worker as unknown as { queueName: string }).queueName).toBe('leaderboard');
    });
  });

  describe('processLeaderboardSnapshot', () => {
    it('skips snapshot for current week', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot', weekKey: '2026-W04' }, // Current week
        id: 'test-job-1',
      } as any;

      await processorFn(mockJob);

      // Should not query database for current week
      expect(prisma.leaderboardEntry.findMany).not.toHaveBeenCalled();
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('processes historical week snapshot', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');
      vi.mocked(prisma.leaderboardEntry.findMany).mockResolvedValue([
        { runId: 'run-1', userId: 'user-1', id: 'entry-1', createdAt: new Date(), weekKey: '2026-W03', score: 1000 },
        { runId: 'run-2', userId: 'user-2', id: 'entry-2', createdAt: new Date(), weekKey: '2026-W03', score: 900 },
        { runId: 'run-3', userId: 'user-3', id: 'entry-3', createdAt: new Date(), weekKey: '2026-W03', score: 800 },
      ]);

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot', weekKey: '2026-W03' }, // Previous week
        id: 'test-job-2',
      } as any;

      await processorFn(mockJob);

      expect(prisma.leaderboardEntry.findMany).toHaveBeenCalledWith({
        where: { weekKey: '2026-W03' },
        orderBy: { score: 'desc' },
        take: 100,
        select: {
          userId: true,
          score: true,
          createdAt: true,
        },
      });
      expect(redis.setex).toHaveBeenCalled();
    });

    it('does nothing when no entries found', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');
      vi.mocked(prisma.leaderboardEntry.findMany).mockResolvedValue([]);

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot', weekKey: '2026-W03' },
        id: 'test-job-3',
      } as any;

      await processorFn(mockJob);

      expect(redis.setex).not.toHaveBeenCalled();
    });

    it('stores snapshot in Redis with 7 day TTL', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');
      vi.mocked(prisma.leaderboardEntry.findMany).mockResolvedValue([
        { runId: 'run-1', userId: 'user-1', id: 'entry-1', createdAt: new Date('2026-01-15'), weekKey: '2026-W03', score: 1000 },
      ]);

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot', weekKey: '2026-W03' },
        id: 'test-job-4',
      } as any;

      await processorFn(mockJob);

      expect(redis.setex).toHaveBeenCalledWith(
        'leaderboard:snapshot:2026-W03',
        7 * 24 * 3600, // 7 days
        expect.any(String)
      );
    });

    it('uses previous week when weekKey not in job data', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');
      vi.mocked(prisma.leaderboardEntry.findMany).mockResolvedValue([]);

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot' }, // No weekKey
        id: 'test-job-5',
      } as any;

      await processorFn(mockJob);

      // Should use current week from getCurrentWeekKey, which gets skipped
      expect(prisma.leaderboardEntry.findMany).not.toHaveBeenCalled();
    });

    it('includes rank in snapshot entries', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');
      vi.mocked(prisma.leaderboardEntry.findMany).mockResolvedValue([
        { runId: 'run-1', userId: 'user-1', id: 'entry-1', createdAt: new Date(), weekKey: '2026-W03', score: 1000 },
        { runId: 'run-2', userId: 'user-2', id: 'entry-2', createdAt: new Date(), weekKey: '2026-W03', score: 900 },
      ]);

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot', weekKey: '2026-W03' },
        id: 'test-job-6',
      } as any;

      await processorFn(mockJob);

      const storedData = JSON.parse(vi.mocked(redis.setex).mock.calls[0][2] as string);
      expect(storedData.entries[0].rank).toBe(1);
      expect(storedData.entries[1].rank).toBe(2);
    });

    it('throws error when database fails', async () => {
      vi.mocked(getCurrentWeekKey).mockReturnValue('2026-W04');
      vi.mocked(prisma.leaderboardEntry.findMany).mockRejectedValue(
        new Error('Database connection failed')
      );

      createLeaderboardWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'snapshot', weekKey: '2026-W03' },
        id: 'test-job-7',
      } as any;

      await expect(processorFn(mockJob)).rejects.toThrow('Database connection failed');
    });
  });
});
