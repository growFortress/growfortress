import { Job } from 'bullmq';
import {
  getPreviousWeekKey,
  GuildWeeklyResetJob,
  createWorker,
} from '../lib/queue.js';
import { finalizeRace } from '../services/guildTowerRace.js';
import { finalizeBoss } from '../services/guildBoss.js';
import { distributeTowerRaceMedals, cleanupExpiredBonuses } from '../services/guildMedals.js';

/**
 * Process weekly guild reset job
 *
 * This job runs every Monday at 00:00 UTC and:
 * 1. Finalizes Tower Race for the previous week and distributes rewards
 * 2. Finalizes Guild Boss for the previous week and distributes rewards
 */
async function processWeeklyGuildReset(job: Job<GuildWeeklyResetJob>): Promise<void> {
  // Get the week that just ended (the job runs at the start of a new week)
  const weekKey = job.data.weekKey || getPreviousWeekKey();

  console.log(`[WeeklyGuildReset] Starting weekly guild reset for week ${weekKey}`);
  const startTime = Date.now();

  try {
    // Step 1: Finalize Tower Race and distribute rewards
    console.log(`[WeeklyGuildReset] Finalizing Tower Race for week ${weekKey}...`);
    const raceResult = await finalizeRace(weekKey);
    if (raceResult.success) {
      console.log(
        `[WeeklyGuildReset] Tower Race finalized: ${raceResult.rankings?.length ?? 0} guilds ranked`
      );

      // Step 1b: Distribute medals to top 50 guilds
      if (raceResult.rankings && raceResult.rankings.length > 0) {
        console.log(`[WeeklyGuildReset] Distributing Tower Race medals...`);
        const medalResult = await distributeTowerRaceMedals(weekKey, raceResult.rankings);
        console.log(
          `[WeeklyGuildReset] Medals distributed: ${medalResult.medalsAwarded} medals, ` +
          `${medalResult.totalCoinsDistributed} Guild Coins`
        );
        if (medalResult.errors.length > 0) {
          console.warn(`[WeeklyGuildReset] Medal distribution errors:`, medalResult.errors);
        }
      }
    } else {
      console.log(`[WeeklyGuildReset] Tower Race: ${raceResult.error ?? 'No race to finalize'}`);
    }

    // Step 1c: Cleanup expired medal bonuses
    const expiredBonuses = await cleanupExpiredBonuses();
    if (expiredBonuses > 0) {
      console.log(`[WeeklyGuildReset] Cleaned up ${expiredBonuses} expired medal bonuses`);
    }

    // Step 2: Finalize Guild Boss and distribute rewards
    console.log(`[WeeklyGuildReset] Finalizing Guild Boss for week ${weekKey}...`);
    const bossResult = await finalizeBoss(weekKey);
    if (bossResult.success) {
      console.log(
        `[WeeklyGuildReset] Guild Boss finalized: ${bossResult.topGuilds?.length ?? 0} guilds rewarded`
      );
    } else {
      console.log(`[WeeklyGuildReset] Guild Boss: ${bossResult.error ?? 'No boss to finalize'}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[WeeklyGuildReset] Weekly guild reset completed in ${duration}ms`);
  } catch (error) {
    console.error(`[WeeklyGuildReset] Job failed for week ${weekKey}:`, error);
    throw error; // Re-throw so BullMQ knows job failed and can retry
  }
}

/**
 * Create weekly guild reset worker
 */
export function createWeeklyGuildResetWorker() {
  return createWorker<GuildWeeklyResetJob>('guild-weekly', processWeeklyGuildReset);
}
