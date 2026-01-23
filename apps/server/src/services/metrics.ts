import { prisma } from '../lib/prisma.js';
import { getResponseTimeStats } from '../plugins/responseTime.js';
import { getQueueMetrics } from '../lib/queue.js';
import { checkAlerts, logAlerts, sendAlertsWebhook } from './alerts.js';

/**
 * Zwraca aktualne metryki systemowe.
 */
export async function getCurrentMetrics() {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // CCU - Użytkownicy z aktywną sesją w ciągu ostatnich 2 minut
  const ccu = await prisma.gameSession.count({
    where: {
      endedAt: null,
      lastActivityAt: { gte: twoMinutesAgo }
    }
  });

  // Aktywne sesje (wszystkie niezakonczone)
  const activeSessions = await prisma.gameSession.count({
    where: { endedAt: null }
  });

  // Błędy z ostatniej godziny
  const errorCount = await prisma.systemError.count({
    where: { createdAt: { gte: oneHourAgo } }
  });

  // Response time stats
  const responseTimeStats = getResponseTimeStats();

  // Queue metrics
  const queueMetrics = await getQueueMetrics();

  return {
    ccu,
    activeSessions,
    errorCount,
    responseTime: responseTimeStats,
    queueMetrics: queueMetrics.totals,
  };
}

/**
 * Zapisuje snapshot aktualnych metryk w bazie danych.
 */
export async function takeMetricSnapshot() {
  const { ccu, activeSessions, errorCount, responseTime, queueMetrics } = await getCurrentMetrics();
  const queueMetricsFull = await getQueueMetrics();

  // Check for alerts
  const alerts = await checkAlerts();
  if (alerts.length > 0) {
    logAlerts(alerts);
    // Send webhook if configured
    const webhookUrl = process.env.ALERTS_WEBHOOK_URL;
    if (webhookUrl) {
      await sendAlertsWebhook(alerts, webhookUrl);
    }
  }

  return prisma.metricSnapshot.create({
    data: {
      ccu,
      activeSessions,
      errorCount,
      responseTimeAvg: responseTime.avg || null,
      responseTimeP50: responseTime.p50 || null,
      responseTimeP95: responseTime.p95 || null,
      responseTimeP99: responseTime.p99 || null,
      responseTimeMax: responseTime.max || null,
      queueWaitingTotal: queueMetrics.waiting,
      queueActiveTotal: queueMetrics.active,
      queueDelayedTotal: queueMetrics.delayed,
      queueFailedTotal: queueMetrics.failed,
      queueMetricsJson: queueMetricsFull.queues,
      timestamp: new Date()
    }
  });
}
