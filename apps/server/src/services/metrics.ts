import { prisma } from '../lib/prisma.js';

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

  return { ccu, activeSessions, errorCount };
}

/**
 * Zapisuje snapshot aktualnych metryk w bazie danych.
 */
export async function takeMetricSnapshot() {
  const { ccu, activeSessions, errorCount } = await getCurrentMetrics();

  return prisma.metricSnapshot.create({
    data: {
      ccu,
      activeSessions,
      errorCount,
      timestamp: new Date()
    }
  });
}
