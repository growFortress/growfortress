/**
 * Alerts service tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkAlerts,
  logAlerts,
  sendAlertsWebhook,
  DEFAULT_THRESHOLDS,
  type Alert,
} from '../../../services/alerts.js';
import { mockPrisma } from '../../mocks/prisma.js';

// Mock the response time plugin
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

// Mock the queue module
vi.mock('../../../lib/queue.js', () => ({
  getQueueMetrics: vi.fn(() => Promise.resolve({
    totals: {
      waiting: 10,
      active: 5,
      delayed: 2,
      failed: 3,
    },
    queues: {},
  })),
}));

// Mock fetch for webhook tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Alerts Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('DEFAULT_THRESHOLDS', () => {
    it('has expected default values', () => {
      expect(DEFAULT_THRESHOLDS).toEqual({
        errorRatePerMinute: 10,
        responseTimeP95: 2000,
        responseTimeP99: 5000,
        queueBacklog: 1000,
        queueFailedRate: 50,
      });
    });
  });

  describe('checkAlerts', () => {
    it('returns empty array when all metrics are normal', async () => {
      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts).toEqual([]);
    });

    it('detects high error rate warning', async () => {
      mockPrisma.systemError.count.mockResolvedValue(15);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'error_rate',
          severity: 'warning',
          value: 15,
          threshold: 10,
        })
      );
    });

    it('detects critical error rate', async () => {
      mockPrisma.systemError.count.mockResolvedValue(25);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'error_rate',
          severity: 'critical',
          value: 25,
        })
      );
    });

    it('detects high P95 response time', async () => {
      const { getResponseTimeStats } = await import('../../../plugins/responseTime.js');
      vi.mocked(getResponseTimeStats).mockReturnValue({
        count: 100,
        avg: 500,
        p50: 400,
        p95: 2500, // Above threshold
        p99: 3000,
        max: 5000,
      });

      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'response_time',
          severity: 'warning',
          value: 2500,
          threshold: 2000,
        })
      );
    });

    it('detects critical P99 response time', async () => {
      const { getResponseTimeStats } = await import('../../../plugins/responseTime.js');
      vi.mocked(getResponseTimeStats).mockReturnValue({
        count: 100,
        avg: 500,
        p50: 400,
        p95: 4000,
        p99: 6000, // Above threshold
        max: 10000,
      });

      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'response_time',
          severity: 'critical',
          value: 6000,
          threshold: 5000,
        })
      );
    });

    it('detects queue backlog warning', async () => {
      const { getQueueMetrics } = await import('../../../lib/queue.js');
      vi.mocked(getQueueMetrics).mockResolvedValue({
        totals: {
          waiting: 1500, // Above threshold
          active: 5,
          delayed: 2,
          failed: 3,
        },
        queues: {},
      });

      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'queue_backlog',
          severity: 'warning',
          value: 1500,
          threshold: 1000,
        })
      );
    });

    it('detects critical queue backlog', async () => {
      const { getQueueMetrics } = await import('../../../lib/queue.js');
      vi.mocked(getQueueMetrics).mockResolvedValue({
        totals: {
          waiting: 2500, // Double the threshold
          active: 5,
          delayed: 2,
          failed: 3,
        },
        queues: {},
      });

      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'queue_backlog',
          severity: 'critical',
          value: 2500,
        })
      );
    });

    it('detects queue failed rate warning', async () => {
      const { getQueueMetrics } = await import('../../../lib/queue.js');
      vi.mocked(getQueueMetrics).mockResolvedValue({
        totals: {
          waiting: 10,
          active: 5,
          delayed: 2,
          failed: 60, // Above threshold
        },
        queues: {},
      });

      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'queue_failed',
          severity: 'warning',
          value: 60,
          threshold: 50,
        })
      );
    });

    it('uses custom thresholds when provided', async () => {
      mockPrisma.systemError.count.mockResolvedValue(5);

      const alerts = await checkAlerts({
        errorRatePerMinute: 3, // Lower threshold
        responseTimeP95: 2000,
        responseTimeP99: 5000,
        queueBacklog: 1000,
        queueFailedRate: 50,
      });

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: 'error_rate',
          value: 5,
          threshold: 3,
        })
      );
    });

    it('skips response time alerts when no requests', async () => {
      const { getResponseTimeStats } = await import('../../../plugins/responseTime.js');
      vi.mocked(getResponseTimeStats).mockReturnValue({
        count: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        max: 0,
      });

      mockPrisma.systemError.count.mockResolvedValue(0);

      const alerts = await checkAlerts();

      expect(alerts.filter(a => a.type === 'response_time')).toHaveLength(0);
    });
  });

  describe('logAlerts', () => {
    it('does nothing for empty alerts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logAlerts([]);

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('logs warning alerts', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const alerts: Alert[] = [
        {
          type: 'error_rate',
          severity: 'warning',
          message: 'High error rate',
          value: 15,
          threshold: 10,
          timestamp: new Date(),
        },
      ];

      logAlerts(alerts);

      expect(consoleSpy).toHaveBeenCalledWith('[ALERTS] 1 alert(s) detected:');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARNING]')
      );
      consoleSpy.mockRestore();
    });

    it('logs critical alerts with different emoji', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const alerts: Alert[] = [
        {
          type: 'error_rate',
          severity: 'critical',
          message: 'Critical error rate',
          value: 25,
          threshold: 10,
          timestamp: new Date(),
        },
      ];

      logAlerts(alerts);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[CRITICAL]')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('sendAlertsWebhook', () => {
    it('does nothing when no webhook URL', async () => {
      const alerts: Alert[] = [
        {
          type: 'error_rate',
          severity: 'warning',
          message: 'High error rate',
          value: 15,
          threshold: 10,
          timestamp: new Date(),
        },
      ];

      await sendAlertsWebhook(alerts);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does nothing when no alerts', async () => {
      await sendAlertsWebhook([], 'http://webhook.example.com');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends alerts to webhook', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      const alerts: Alert[] = [
        {
          type: 'error_rate',
          severity: 'warning',
          message: 'High error rate',
          value: 15,
          threshold: 10,
          timestamp: new Date(),
        },
      ];

      await sendAlertsWebhook(alerts, 'http://webhook.example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://webhook.example.com',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"alerts"'),
        }
      );
    });

    it('handles webhook errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const alerts: Alert[] = [
        {
          type: 'error_rate',
          severity: 'warning',
          message: 'High error rate',
          value: 15,
          threshold: 10,
          timestamp: new Date(),
        },
      ];

      // Should not throw
      await sendAlertsWebhook(alerts, 'http://webhook.example.com');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ALERTS] Failed to send webhook:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
