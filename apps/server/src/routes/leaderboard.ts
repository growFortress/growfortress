import { FastifyPluginAsync } from 'fastify';
import { LeaderboardQuerySchema } from '@arcade/protocol';
import { getWeeklyLeaderboard, getUserRank, getAvailableWeeks } from '../services/leaderboard.js';
import { getCurrentWeekKey } from '../lib/queue.js';

const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  // Get weekly leaderboard (public endpoint)
  fastify.get('/v1/leaderboards/weekly', { config: { public: true } }, async (request, reply) => {
    const query = LeaderboardQuerySchema.parse(request.query);

    const weekKey = query.week || getCurrentWeekKey();
    const result = await getWeeklyLeaderboard(weekKey, query.limit, query.offset);

    // Add user's rank if authenticated
    if (request.userId) {
      const userRank = await getUserRank(request.userId, weekKey);
      if (userRank) {
        return reply.send({
          ...result,
          userRank: userRank.rank,
          userScore: userRank.score,
        });
      }
    }

    return reply.send(result);
  });

  // Get available weeks (public endpoint)
  fastify.get('/v1/leaderboards/weeks', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '10', 10), 52);

    const weeks = await getAvailableWeeks(limit);
    const current = getCurrentWeekKey();

    return reply.send({
      currentWeek: current,
      weeks,
    });
  });
};

export default leaderboardRoutes;
