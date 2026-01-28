import { FastifyPluginAsync } from 'fastify';
import {
  getWeeklyMissions,
  claimMissionReward,
  claimAllMissionRewards,
} from '../services/missions.js';

/**
 * Weekly Missions Routes
 *
 * GET  /v1/missions/weekly     - Get current week's missions with progress
 * POST /v1/missions/:id/claim  - Claim reward for a completed mission
 * POST /v1/missions/claim-all  - Claim all completed mission rewards
 */

const missionsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /v1/missions/weekly
   * Get current week's missions with player progress
   */
  fastify.get('/v1/missions/weekly', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const missions = await getWeeklyMissions(request.userId);

    if (!missions) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(missions);
  });

  /**
   * POST /v1/missions/:id/claim
   * Claim reward for a completed mission
   */
  fastify.post<{ Params: { id: string } }>('/v1/missions/:id/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const missionId = request.params.id;
    if (!missionId) {
      return reply.status(400).send({ error: 'Mission ID is required' });
    }

    const result = await claimMissionReward(request.userId, missionId);

    if (!result.success) {
      // Map error codes to HTTP status
      switch (result.error) {
        case 'MISSION_NOT_FOUND':
          return reply.status(404).send({ error: result.error, message: 'Mission not found' });
        case 'MISSION_NOT_COMPLETED':
          return reply.status(400).send({ error: result.error, message: 'Mission is not yet completed' });
        case 'MISSION_ALREADY_CLAIMED':
          return reply.status(400).send({ error: result.error, message: 'Mission reward already claimed' });
        case 'MISSION_EXPIRED':
          return reply.status(400).send({ error: result.error, message: 'Mission has expired' });
        default:
          return reply.status(400).send({ error: result.error });
      }
    }

    return reply.send(result);
  });

  /**
   * POST /v1/missions/claim-all
   * Claim all completed but unclaimed mission rewards at once
   */
  fastify.post('/v1/missions/claim-all', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const result = await claimAllMissionRewards(request.userId);

    return reply.send(result);
  });
};

export default missionsRoutes;
