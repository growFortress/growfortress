import type { FastifyInstance } from 'fastify';
import { createBugReport } from '../services/bugReports.js';

export async function bugReportRoutes(fastify: FastifyInstance) {
  // POST /bug-reports - Submit a bug report
  fastify.post('/bug-reports', async (request, reply) => {
    const { sessionId, tick, description } = request.body as {
      sessionId: string;
      tick: number;
      description: string;
    };

    if (!sessionId || tick === undefined || !description) {
      return reply.code(400).send({ error: 'Missing required fields' });
    }

    const userId = request.userId; // Provided by auth middleware
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const report = await createBugReport(userId, sessionId, tick, description);
    return report;
  });
}
