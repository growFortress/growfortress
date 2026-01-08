import { Job } from 'bullmq';
import { createWorker } from '../lib/queue.js';
import { takeMetricSnapshot } from '../services/metrics.js';

export function createMetricsWorker() {
  return createWorker('metrics', async (job: Job) => {
    if (job.name === 'take_snapshot') {
      await takeMetricSnapshot();
    }
  });
}
