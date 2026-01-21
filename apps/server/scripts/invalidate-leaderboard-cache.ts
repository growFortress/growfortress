/**
 * Invalidate all leaderboard caches
 * Run with: npx tsx scripts/invalidate-leaderboard-cache.ts
 */

import 'dotenv/config';
import { redis } from '../src/lib/redis.js';
import { getCurrentWeekKey } from '../src/lib/queue.js';

const CACHE_KEYS = {
  totalWaves: 'player-leaderboard:totalWaves',
  honor: 'player-leaderboard:honor',
  level: 'player-leaderboard:level',
  weeklyWaves: (weekKey: string) => `player-leaderboard:weeklyWaves:${weekKey}`,
  weeklyHonor: (weekKey: string) => `player-leaderboard:weeklyHonor:${weekKey}`,
} as const;

async function invalidateCaches() {
  console.log('Invalidating all leaderboard caches...');

  try {
    const weekKey = getCurrentWeekKey();
    
    await Promise.all([
      redis.del(CACHE_KEYS.totalWaves),
      redis.del(CACHE_KEYS.honor),
      redis.del(CACHE_KEYS.level),
      redis.del(CACHE_KEYS.weeklyWaves(weekKey)),
      redis.del(CACHE_KEYS.weeklyHonor(weekKey)),
    ]);

    console.log('✅ Successfully invalidated all leaderboard caches');
    console.log('   - Total Waves cache');
    console.log('   - Honor cache');
    console.log('   - Level cache');
    console.log(`   - Weekly Waves cache (${weekKey})`);
    console.log(`   - Weekly Honor cache (${weekKey})`);
    console.log('\n💡 The leaderboards will fetch fresh data on the next request');
  } catch (error) {
    console.error('❌ Error invalidating caches:', error);
    throw error;
  } finally {
    await redis.disconnect();
  }
}

invalidateCaches()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
