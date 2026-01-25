import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { LeaderboardQuerySchema } from '@arcade/protocol';
import { getWeeklyLeaderboard, getUserRank, getAvailableWeeks } from '../services/leaderboard.js';
import { getCurrentWeekKey } from '../lib/queue.js';
import {
  getTotalWavesLeaderboard,
  getHonorLeaderboard,
  getLevelLeaderboard,
  getWeeklyWavesLeaderboard,
  getWeeklyHonorLeaderboard,
  getUserRanks,
  getAvailableRewards,
  claimWeeklyReward,
  getAvailablePlayerWeeks,
  getTimeUntilWeeklyReset,
  type LeaderboardCategory,
} from '../services/playerLeaderboard.js';
import { getGuildTrophyLeaderboard } from '../services/guildBattleTrophies.js';
import { ALL_EXCLUSIVE_ITEMS } from '@arcade/sim-core';
import { isUserConnected } from '../services/websocket.js';

const leaderboardRoutes: FastifyPluginAsync = async (fastify) => {
  // NOTE: Leaderboards are intentionally public (including for guests) as they contain
  // public ranking data. This allows scraping but is acceptable for leaderboard data.
  // If rate limiting is needed, consider adding it via withRateLimit middleware.

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

  // ==========================================
  // PLAYER LEADERBOARDS (NEW)
  // ==========================================

  const PlayerLeaderboardQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(25),
    offset: z.coerce.number().min(0).default(0),
    week: z.string().optional(),
    search: z.string().optional(),
  });

  // Get player leaderboard by category
  fastify.get<{
    Params: { category: string };
  }>('/v1/leaderboards/players/:category', { config: { public: true } }, async (request, reply) => {
    const { category } = request.params;
    const query = PlayerLeaderboardQuerySchema.parse(request.query);
    const weekKey = query.week || getCurrentWeekKey();

    let result;

    switch (category as LeaderboardCategory) {
      case 'totalWaves':
        result = await getTotalWavesLeaderboard(query.limit, query.offset, query.search);
        break;
      case 'honor':
        result = await getHonorLeaderboard(query.limit, query.offset, query.search);
        break;
      case 'level':
        result = await getLevelLeaderboard(query.limit, query.offset, query.search);
        break;
      case 'weeklyWaves':
        result = await getWeeklyWavesLeaderboard(weekKey, query.limit, query.offset, query.search);
        break;
      case 'weeklyHonor':
        result = await getWeeklyHonorLeaderboard(weekKey, query.limit, query.offset, query.search);
        break;
      default:
        return reply.status(400).send({ error: 'Invalid category' });
    }

    // Add time until reset for weekly categories
    const timeUntilReset = category.startsWith('weekly') ? getTimeUntilWeeklyReset() : undefined;

    // Add online status to each entry
    const entriesWithOnlineStatus = result.entries.map((entry) => ({
      ...entry,
      isOnline: isUserConnected(entry.userId),
    }));

    return reply.send({
      category,
      ...result,
      entries: entriesWithOnlineStatus,
      timeUntilReset,
    });
  });

  // Get user's ranks across all categories (requires auth)
  fastify.get('/v1/leaderboards/players/my-ranks', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const query = request.query as { week?: string };
    const weekKey = query.week || getCurrentWeekKey();

    const ranks = await getUserRanks(request.userId, weekKey);
    const timeUntilReset = getTimeUntilWeeklyReset();

    return reply.send({
      ranks,
      weekKey,
      timeUntilReset,
    });
  });

  // Get available weekly rewards (requires auth)
  fastify.get('/v1/leaderboards/players/rewards', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const rewards = await getAvailableRewards(request.userId);

    return reply.send({ rewards });
  });

  // Claim a weekly reward (requires auth)
  const ClaimRewardSchema = z.object({
    rewardId: z.string(),
  });

  fastify.post('/v1/leaderboards/players/rewards/claim', async (request, reply) => {
    if (!request.userId) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const body = ClaimRewardSchema.parse(request.body);

    try {
      const result = await claimWeeklyReward(request.userId, body.rewardId);
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to claim reward';
      return reply.status(400).send({ error: message });
    }
  });

  // Get available player leaderboard weeks
  fastify.get('/v1/leaderboards/players/weeks', { config: { public: true } }, async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || '10', 10), 52);

    const weeks = await getAvailablePlayerWeeks(limit);
    const current = getCurrentWeekKey();
    const timeUntilReset = getTimeUntilWeeklyReset();

    return reply.send({
      currentWeek: current,
      weeks,
      timeUntilReset,
    });
  });

  // Get all exclusive items info (public)
  fastify.get('/v1/leaderboards/exclusive-items', { config: { public: true } }, async (_request, reply) => {
    return reply.send({
      items: ALL_EXCLUSIVE_ITEMS,
    });
  });

  // ==========================================
  // GUILD TROPHY LEADERBOARD
  // ==========================================

  const GuildTrophyLeaderboardQuerySchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(50),
    offset: z.coerce.number().min(0).default(0),
  });

  // Get guild trophy leaderboard (public)
  fastify.get('/v1/leaderboards/guilds/trophies', { config: { public: true } }, async (request, reply) => {
    const query = GuildTrophyLeaderboardQuerySchema.parse(request.query);

    const result = await getGuildTrophyLeaderboard(query.limit, query.offset);

    return reply.send({
      category: 'guildTrophies',
      ...result,
    });
  });
};

export default leaderboardRoutes;
