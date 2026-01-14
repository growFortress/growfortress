import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock queue module
vi.mock('../../../lib/queue.js', () => ({
  getPreviousWeekKey: vi.fn(() => '2026-W01'),
  createWorker: vi.fn((queueName, processor) => ({
    queueName,
    processor,
    close: vi.fn(),
  })),
}));

// Mock playerLeaderboard service
vi.mock('../../../services/playerLeaderboard.js', () => ({
  distributeWeeklyRewards: vi.fn(),
  resetWeeklyHonor: vi.fn(),
}));

import { createWeeklyPlayerResetWorker } from '../../../jobs/weeklyPlayerReset.js';
import { createWorker, getPreviousWeekKey } from '../../../lib/queue.js';
import {
  distributeWeeklyRewards,
  resetWeeklyHonor,
} from '../../../services/playerLeaderboard.js';

describe('weeklyPlayerReset job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createWeeklyPlayerResetWorker', () => {
    it('creates a worker for player-leaderboard queue', () => {
      createWeeklyPlayerResetWorker();

      expect(createWorker).toHaveBeenCalledWith(
        'player-leaderboard',
        expect.any(Function)
      );
    });

    it('returns the worker instance', () => {
      const worker = createWeeklyPlayerResetWorker();

      expect(worker).toBeDefined();
      // Worker is returned from createWorker mock, which is called with 'player-leaderboard'
      expect((worker as unknown as { queueName: string }).queueName).toBe('player-leaderboard');
    });
  });

  describe('processWeeklyPlayerReset', () => {
    it('distributes rewards and resets weekly honor', async () => {
      vi.mocked(distributeWeeklyRewards).mockResolvedValue({
        wavesRewardsCreated: 50,
        honorRewardsCreated: 30,
      });
      vi.mocked(resetWeeklyHonor).mockResolvedValue(100);

      createWeeklyPlayerResetWorker();

      // Get the processor function that was passed to createWorker
      const processorFn = vi.mocked(createWorker).mock.calls[0][1];

      // Create a mock job
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W01' },
        id: 'test-job-1',
      } as any;

      await processorFn(mockJob);

      expect(distributeWeeklyRewards).toHaveBeenCalledWith('2026-W01');
      expect(resetWeeklyHonor).toHaveBeenCalled();
    });

    it('uses getPreviousWeekKey when weekKey not in job data', async () => {
      vi.mocked(distributeWeeklyRewards).mockResolvedValue({
        wavesRewardsCreated: 0,
        honorRewardsCreated: 0,
      });
      vi.mocked(resetWeeklyHonor).mockResolvedValue(0);
      vi.mocked(getPreviousWeekKey).mockReturnValue('2025-W52');

      createWeeklyPlayerResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset' }, // No weekKey
        id: 'test-job-2',
      } as any;

      await processorFn(mockJob);

      expect(distributeWeeklyRewards).toHaveBeenCalledWith('2025-W52');
    });

    it('throws error when distributeWeeklyRewards fails', async () => {
      const error = new Error('Database connection failed');
      vi.mocked(distributeWeeklyRewards).mockRejectedValue(error);

      createWeeklyPlayerResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W01' },
        id: 'test-job-3',
      } as any;

      await expect(processorFn(mockJob)).rejects.toThrow('Database connection failed');
    });

    it('throws error when resetWeeklyHonor fails', async () => {
      vi.mocked(distributeWeeklyRewards).mockResolvedValue({
        wavesRewardsCreated: 10,
        honorRewardsCreated: 5,
      });
      const error = new Error('Reset failed');
      vi.mocked(resetWeeklyHonor).mockRejectedValue(error);

      createWeeklyPlayerResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W01' },
        id: 'test-job-4',
      } as any;

      await expect(processorFn(mockJob)).rejects.toThrow('Reset failed');
    });
  });
});
