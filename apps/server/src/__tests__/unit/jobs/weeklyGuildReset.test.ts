/**
 * Weekly Guild Reset Job Tests
 *
 * Tests for the weekly guild reset job:
 * - Worker creation
 * - Tower Race finalization
 * - Guild Boss finalization
 * - Medal distribution
 * - Error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock queue module
vi.mock('../../../lib/queue.js', () => ({
  getPreviousWeekKey: vi.fn(() => '2026-W03'),
  createWorker: vi.fn((queueName, processor) => ({
    queueName,
    processor,
    close: vi.fn(),
  })),
}));

// Mock services
vi.mock('../../../services/guildTowerRace.js', () => ({
  finalizeRace: vi.fn(),
}));

vi.mock('../../../services/guildBoss.js', () => ({
  finalizeBoss: vi.fn(),
}));

vi.mock('../../../services/guildMedals.js', () => ({
  distributeTowerRaceMedals: vi.fn(),
  cleanupExpiredBonuses: vi.fn(),
}));

import { createWeeklyGuildResetWorker } from '../../../jobs/weeklyGuildReset.js';
import { createWorker, getPreviousWeekKey } from '../../../lib/queue.js';
import { finalizeRace } from '../../../services/guildTowerRace.js';
import { finalizeBoss } from '../../../services/guildBoss.js';
import { distributeTowerRaceMedals, cleanupExpiredBonuses } from '../../../services/guildMedals.js';

describe('weeklyGuildReset job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createWeeklyGuildResetWorker', () => {
    it('creates a worker for guild-weekly queue', () => {
      createWeeklyGuildResetWorker();

      expect(createWorker).toHaveBeenCalledWith(
        'guild-weekly',
        expect.any(Function)
      );
    });

    it('returns the worker instance', () => {
      const worker = createWeeklyGuildResetWorker();

      expect(worker).toBeDefined();
      expect((worker as unknown as { queueName: string }).queueName).toBe('guild-weekly');
    });
  });

  describe('processWeeklyGuildReset', () => {
    it('finalizes tower race for the week', async () => {
      vi.mocked(finalizeRace).mockResolvedValue({
        success: true,
        rankings: [],
      });
      vi.mocked(finalizeBoss).mockResolvedValue({ success: true });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-1',
      } as any;

      await processorFn(mockJob);

      expect(finalizeRace).toHaveBeenCalledWith('2026-W03');
    });

    it('distributes medals when race has rankings', async () => {
      const mockRankings = [
        { guildId: 'guild-1', totalWaves: 1000, rank: 1 },
        { guildId: 'guild-2', totalWaves: 900, rank: 2 },
      ];
      vi.mocked(finalizeRace).mockResolvedValue({
        success: true,
        rankings: mockRankings,
      });
      vi.mocked(distributeTowerRaceMedals).mockResolvedValue({
        medalsAwarded: 2,
        totalCoinsDistributed: 500,
        errors: [],
      });
      vi.mocked(finalizeBoss).mockResolvedValue({ success: true });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-2',
      } as any;

      await processorFn(mockJob);

      expect(distributeTowerRaceMedals).toHaveBeenCalledWith('2026-W03', mockRankings);
    });

    it('skips medal distribution when no rankings', async () => {
      vi.mocked(finalizeRace).mockResolvedValue({
        success: true,
        rankings: [],
      });
      vi.mocked(finalizeBoss).mockResolvedValue({ success: true });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-3',
      } as any;

      await processorFn(mockJob);

      expect(distributeTowerRaceMedals).not.toHaveBeenCalled();
    });

    it('cleans up expired medal bonuses', async () => {
      vi.mocked(finalizeRace).mockResolvedValue({ success: false });
      vi.mocked(finalizeBoss).mockResolvedValue({ success: true });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(5);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-4',
      } as any;

      await processorFn(mockJob);

      expect(cleanupExpiredBonuses).toHaveBeenCalled();
    });

    it('finalizes guild boss for the week', async () => {
      vi.mocked(finalizeRace).mockResolvedValue({ success: false });
      vi.mocked(finalizeBoss).mockResolvedValue({
        success: true,
        topGuilds: [{ guildId: 'guild-1', rank: 1, totalDamage: 5000 }],
      });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-5',
      } as any;

      await processorFn(mockJob);

      expect(finalizeBoss).toHaveBeenCalledWith('2026-W03');
    });

    it('uses getPreviousWeekKey when weekKey not in job data', async () => {
      vi.mocked(getPreviousWeekKey).mockReturnValue('2026-W02');
      vi.mocked(finalizeRace).mockResolvedValue({ success: false });
      vi.mocked(finalizeBoss).mockResolvedValue({ success: false });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset' }, // No weekKey
        id: 'test-job-6',
      } as any;

      await processorFn(mockJob);

      expect(finalizeRace).toHaveBeenCalledWith('2026-W02');
      expect(finalizeBoss).toHaveBeenCalledWith('2026-W02');
    });

    it('throws error when finalizeRace fails with exception', async () => {
      vi.mocked(finalizeRace).mockRejectedValue(new Error('Race finalization failed'));

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-7',
      } as any;

      await expect(processorFn(mockJob)).rejects.toThrow('Race finalization failed');
    });

    it('throws error when finalizeBoss fails with exception', async () => {
      vi.mocked(finalizeRace).mockResolvedValue({ success: true, rankings: [] });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);
      vi.mocked(finalizeBoss).mockRejectedValue(new Error('Boss finalization failed'));

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-8',
      } as any;

      await expect(processorFn(mockJob)).rejects.toThrow('Boss finalization failed');
    });

    it('continues processing when race has no success but no error', async () => {
      vi.mocked(finalizeRace).mockResolvedValue({
        success: false,
        error: 'No race to finalize',
      });
      vi.mocked(finalizeBoss).mockResolvedValue({ success: true });
      vi.mocked(cleanupExpiredBonuses).mockResolvedValue(0);

      createWeeklyGuildResetWorker();

      const processorFn = vi.mocked(createWorker).mock.calls[0][1];
      const mockJob = {
        data: { type: 'weekly_reset', weekKey: '2026-W03' },
        id: 'test-job-9',
      } as any;

      // Should not throw
      await expect(processorFn(mockJob)).resolves.not.toThrow();
      expect(finalizeBoss).toHaveBeenCalled();
    });
  });
});
