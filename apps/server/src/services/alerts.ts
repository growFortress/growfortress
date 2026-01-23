import { prisma } from '../lib/prisma.js';
import { getResponseTimeStats } from '../plugins/responseTime.js';
import { getQueueMetrics } from '../lib/queue.js';

export interface AlertThresholds {
  errorRatePerMinute: number; // Max errors per minute
  responseTimeP95: number; // P95 response time in ms
  responseTimeP99: number; // P99 response time in ms
  queueBacklog: number; // Max total waiting jobs across all queues
  queueFailedRate: number; // Max failed jobs in last hour
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRatePerMinute: 10, // 10 errors per minute
  responseTimeP95: 2000, // 2 seconds
  responseTimeP99: 5000, // 5 seconds
  queueBacklog: 1000, // 1000 waiting jobs
  queueFailedRate: 50, // 50 failed jobs in last hour
};

export interface Alert {
  type: 'error_rate' | 'response_time' | 'queue_backlog' | 'queue_failed';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

/**
 * Check for alerts based on current metrics
 */
export async function checkAlerts(
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS
): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

  // Check error rate
  const errorCountLastMinute = await prisma.systemError.count({
    where: { createdAt: { gte: oneMinuteAgo } },
  });

  if (errorCountLastMinute >= thresholds.errorRatePerMinute) {
    alerts.push({
      type: 'error_rate',
      severity: errorCountLastMinute >= thresholds.errorRatePerMinute * 2 ? 'critical' : 'warning',
      message: `High error rate: ${errorCountLastMinute} errors in the last minute`,
      value: errorCountLastMinute,
      threshold: thresholds.errorRatePerMinute,
      timestamp: now,
    });
  }

  // Check response time
  const responseTimeStats = getResponseTimeStats();
  if (responseTimeStats.count > 0) {
    if (responseTimeStats.p95 >= thresholds.responseTimeP95) {
      alerts.push({
        type: 'response_time',
        severity: responseTimeStats.p95 >= thresholds.responseTimeP99 ? 'critical' : 'warning',
        message: `High P95 response time: ${Math.round(responseTimeStats.p95)}ms`,
        value: responseTimeStats.p95,
        threshold: thresholds.responseTimeP95,
        timestamp: now,
      });
    }

    if (responseTimeStats.p99 >= thresholds.responseTimeP99) {
      alerts.push({
        type: 'response_time',
        severity: 'critical',
        message: `High P99 response time: ${Math.round(responseTimeStats.p99)}ms`,
        value: responseTimeStats.p99,
        threshold: thresholds.responseTimeP99,
        timestamp: now,
      });
    }
  }

  // Check queue backlog
  const queueMetrics = await getQueueMetrics();
  if (queueMetrics.totals.waiting >= thresholds.queueBacklog) {
    alerts.push({
      type: 'queue_backlog',
      severity: queueMetrics.totals.waiting >= thresholds.queueBacklog * 2 ? 'critical' : 'warning',
      message: `High queue backlog: ${queueMetrics.totals.waiting} waiting jobs`,
      value: queueMetrics.totals.waiting,
      threshold: thresholds.queueBacklog,
      timestamp: now,
    });
  }

  // Check queue failed rate
  if (queueMetrics.totals.failed >= thresholds.queueFailedRate) {
    alerts.push({
      type: 'queue_failed',
      severity: queueMetrics.totals.failed >= thresholds.queueFailedRate * 2 ? 'critical' : 'warning',
      message: `High queue failure rate: ${queueMetrics.totals.failed} failed jobs`,
      value: queueMetrics.totals.failed,
      threshold: thresholds.queueFailedRate,
      timestamp: now,
    });
  }

  return alerts;
}

/**
 * Log alerts to console (can be extended to send emails/webhooks)
 */
export function logAlerts(alerts: Alert[]): void {
  if (alerts.length === 0) return;

  console.warn(`[ALERTS] ${alerts.length} alert(s) detected:`);
  alerts.forEach((alert) => {
    const emoji = alert.severity === 'critical' ? '🚨' : '⚠️';
    console.warn(
      `${emoji} [${alert.severity.toUpperCase()}] ${alert.type}: ${alert.message} (value: ${alert.value}, threshold: ${alert.threshold})`
    );
  });
}

/**
 * Send alerts via webhook (if configured)
 */
export async function sendAlertsWebhook(alerts: Alert[], webhookUrl?: string): Promise<void> {
  if (!webhookUrl || alerts.length === 0) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alerts,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('[ALERTS] Failed to send webhook:', error);
  }
}
