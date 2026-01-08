import { Job } from 'bullmq';
import { prisma } from '../lib/prisma.js';
import { CleanupExpiredRunsJob, createWorker } from '../lib/queue.js';
import { config } from '../config.js';

/**
 * Process cleanup expired runs job
 * @param _job - BullMQ job instance (unused, job data not required for this cleanup)
 */
async function processCleanupExpiredRuns(_job: Job<CleanupExpiredRunsJob>): Promise<void> {
  console.log('[CleanupExpiredRuns] Starting cleanup job');

  try {
    const ttlMs = config.RUN_TOKEN_EXPIRY_SECONDS * 1000;
    const expiryThreshold = new Date(Date.now() - ttlMs);

    // Find and update expired runs that haven't been finished
    const result = await prisma.run.updateMany({
      where: {
        issuedAt: { lt: expiryThreshold },
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
        verified: false,
        rejectReason: 'EXPIRED',
      },
    });

    if (result.count === 0) {
      console.log('[CleanupExpiredRuns] No expired runs found');
    } else {
      console.log(`[CleanupExpiredRuns] Cleanup completed: ${result.count} expired runs marked as rejected`);
    }
  } catch (error) {
    console.error('[CleanupExpiredRuns] Job failed:', error);
    throw error; // Re-throw so BullMQ knows job failed and can retry
  }
}

/**
 * Create cleanup worker
 */
export function createCleanupWorker() {
  return createWorker<CleanupExpiredRunsJob>('cleanup', processCleanupExpiredRuns);
}
