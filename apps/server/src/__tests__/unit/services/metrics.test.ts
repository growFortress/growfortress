/**
 * Metrics service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCurrentMetrics, takeMetricSnapshot } from '../../../services/metrics.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Mock response time plugin
vi.mock('../../../plugins/responseTime.js', () => ({
  getResponseTimeStats: vi.fn(() => ({
    count: 100,
    avg: 50,
    p50: 40,
    p95: 100,
    p99: 200,
    max: 500,
  })),
}));

// Mock queue module
vi.mock('../../../lib/queue.js', () => ({
  getQueueMetrics: vi.fn(() => Promise.resolve({
    totals: {
      waiting: 10,
      active: 5,
      delayed: 2,
      failed: 3,
    },
    queues: {
      leaderboard: { waiting: 5, active: 2, delayed: 1, failed: 1 },
      sessions: { waiting: 5, active: 3, delayed: 1, failed: 2 },
    },
  })),
}));

// Mock alerts module
vi.mock('../../../services/alerts.js', () => ({
  checkAlerts: vi.fn(() => Promise.resolve([])),
  logAlerts: vi.fn(),
  sendAlertsWebhook: vi.fn(() => Promise.resolve()),
}));

describe('Metrics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentMetrics', () => {
    it('returns current system metrics', async () => {
      mockPrisma.gameSession.count
        .mockResolvedValueOnce(50) // CCU
        .mockResolvedValueOnce(100); // Active sessions
      mockPrisma.systemError.count.mockResolvedValue(5);

      const result = await getCurrentMetrics();

      expect(result).toEqual({
        ccu: 50,
        activeSessions: 100,
        errorCount: 5,
        responseTime: {
          count: 100,
          avg: 50,
          p50: 40,
          p95: 100,
          p99: 200,
          max: 500,
        },
        queueMetrics: {
          waiting: 10,
          active: 5,
          delayed: 2,
          failed: 3,
        },
      });
    });

    it('queries CCU with 2 minute window', async () => {
      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.systemError.count.mockResolvedValue(0);

      await getCurrentMetrics();

      expect(mockPrisma.gameSession.count).toHaveBeenCalledWith({
        where: {
          endedAt: null,
          lastActivityAt: { gte: expect.any(Date) },
        },
      });
    });

    it('queries errors from last hour', async () => {
      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.systemError.count.mockResolvedValue(0);

      await getCurrentMetrics();

      expect(mockPrisma.systemError.count).toHaveBeenCalledWith({
        where: { createdAt: { gte: expect.any(Date) } },
      });
    });
  });

  describe('takeMetricSnapshot', () => {
    it('creates a metric snapshot in database', async () => {
      mockPrisma.gameSession.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(100);
      mockPrisma.systemError.count.mockResolvedValue(5);
      mockPrisma.metricSnapshot.create.mockResolvedValue({
        id: 'snapshot-1',
        ccu: 50,
        activeSessions: 100,
        errorCount: 5,
        responseTimeAvg: 50,
        responseTimeP50: 40,
        responseTimeP95: 100,
        responseTimeP99: 200,
        responseTimeMax: 500,
        queueWaitingTotal: 10,
        queueActiveTotal: 5,
        queueDelayedTotal: 2,
        queueFailedTotal: 3,
        queueMetricsJson: {},
        timestamp: new Date(),
      });

      const result = await takeMetricSnapshot();

      expect(result.id).toBe('snapshot-1');
      expect(mockPrisma.metricSnapshot.create).toHaveBeenCalledWith({
        data: {
          ccu: 50,
          activeSessions: 100,
          errorCount: 5,
          responseTimeAvg: 50,
          responseTimeP50: 40,
          responseTimeP95: 100,
          responseTimeP99: 200,
          responseTimeMax: 500,
          queueWaitingTotal: 10,
          queueActiveTotal: 5,
          queueDelayedTotal: 2,
          queueFailedTotal: 3,
          queueMetricsJson: {
            leaderboard: { waiting: 5, active: 2, delayed: 1, failed: 1 },
            sessions: { waiting: 5, active: 3, delayed: 1, failed: 2 },
          },
          timestamp: expect.any(Date),
        },
      });
    });

    it('checks for alerts during snapshot', async () => {
      const { checkAlerts, logAlerts } = await import('../../../services/alerts.js');
      vi.mocked(checkAlerts).mockResolvedValue([
        {
          type: 'error_rate',
          severity: 'warning',
          message: 'High error rate',
          value: 15,
          threshold: 10,
          timestamp: new Date(),
        },
      ]);

      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.systemError.count.mockResolvedValue(0);
      mockPrisma.metricSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });

      await takeMetricSnapshot();

      expect(checkAlerts).toHaveBeenCalled();
      expect(logAlerts).toHaveBeenCalledWith([
        expect.objectContaining({ type: 'error_rate' }),
      ]);
    });

    it('sends webhook when configured and alerts exist', async () => {
      const originalEnv = process.env.ALERTS_WEBHOOK_URL;
      process.env.ALERTS_WEBHOOK_URL = 'http://webhook.example.com';

      const { checkAlerts, sendAlertsWebhook } = await import('../../../services/alerts.js');
      vi.mocked(checkAlerts).mockResolvedValue([
        {
          type: 'error_rate',
          severity: 'warning',
          message: 'High error rate',
          value: 15,
          threshold: 10,
          timestamp: new Date(),
        },
      ]);

      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.systemError.count.mockResolvedValue(0);
      mockPrisma.metricSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });

      await takeMetricSnapshot();

      expect(sendAlertsWebhook).toHaveBeenCalledWith(
        expect.any(Array),
        'http://webhook.example.com'
      );

      process.env.ALERTS_WEBHOOK_URL = originalEnv;
    });

    it('handles null response time stats', async () => {
      const { getResponseTimeStats } = await import('../../../plugins/responseTime.js');
      vi.mocked(getResponseTimeStats).mockReturnValue({
        count: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0,
      });

      mockPrisma.gameSession.count.mockResolvedValue(0);
      mockPrisma.systemError.count.mockResolvedValue(0);
      mockPrisma.metricSnapshot.create.mockResolvedValue({ id: 'snapshot-1' });

      await takeMetricSnapshot();

      expect(mockPrisma.metricSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          responseTimeAvg: null,
          responseTimeP50: null,
          responseTimeP95: null,
          responseTimeP99: null,
          responseTimeMax: null,
        }),
      });
    });
  });
});
