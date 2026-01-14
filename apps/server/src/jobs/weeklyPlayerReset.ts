import { Job } from 'bullmq';
import {
  getPreviousWeekKey,
  PlayerLeaderboardResetJob,
  createWorker,
} from '../lib/queue.js';
import {
  distributeWeeklyRewards,
  resetWeeklyHonor,
} from '../services/playerLeaderboard.js';

/**
 * Process weekly player leaderboard reset job
 *
 * This job runs every Monday at 00:00 UTC and:
 * 1. Distributes rewards for the previous week's rankings
 * 2. Resets weekly honor for all players
 */
async function processWeeklyPlayerReset(job: Job<PlayerLeaderboardResetJob>): Promise<void> {
  // Get the week that just ended (the job runs at the start of a new week)
  const weekKey = job.data.weekKey || getPreviousWeekKey();

  console.log(`[WeeklyPlayerReset] Starting weekly reset for week ${weekKey}`);
  const startTime = Date.now();

  try {
    // Step 1: Distribute rewards for the completed week
    console.log(`[WeeklyPlayerReset] Distributing rewards for week ${weekKey}...`);
    const rewardStats = await distributeWeeklyRewards(weekKey);
    console.log(
      `[WeeklyPlayerReset] Rewards distributed: ${rewardStats.wavesRewardsCreated} waves rewards, ${rewardStats.honorRewardsCreated} honor rewards`
    );

    // Step 2: Reset weekly honor for all players
    console.log(`[WeeklyPlayerReset] Resetting weekly honor...`);
    const resetCount = await resetWeeklyHonor();
    console.log(`[WeeklyPlayerReset] Reset weekly honor for ${resetCount} players`);

    const duration = Date.now() - startTime;
    console.log(`[WeeklyPlayerReset] Weekly reset completed in ${duration}ms`);
  } catch (error) {
    console.error(`[WeeklyPlayerReset] Job failed for week ${weekKey}:`, error);
    throw error; // Re-throw so BullMQ knows job failed and can retry
  }
}

/**
 * Create weekly player reset worker
 */
export function createWeeklyPlayerResetWorker() {
  return createWorker<PlayerLeaderboardResetJob>('player-leaderboard', processWeeklyPlayerReset);
}
