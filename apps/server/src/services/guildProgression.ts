/**
 * Guild Progression Service
 *
 * Delegates trophy management to the new guildBattleTrophies service.
 * Kept for backwards compatibility with existing code.
 */

import { getTrophyStatBonus } from './guildBattleTrophies.js';
import { calculateCoinMultiplier } from '@arcade/protocol';
import { prisma } from '../lib/prisma.js';

// ============================================================================
// TYPES
// ============================================================================

export interface TrophyCheckResult {
  newTrophies: string[];
}

// ============================================================================
// TROPHY MANAGEMENT (DELEGATED TO NEW SYSTEM)
// ============================================================================

/**
 * Check and award trophies based on current stats
 * Note: Battle trophies are now automatically awarded via guildBattle.ts
 * This function is kept for backwards compatibility
 */
export async function checkAndAwardTrophies(_guildId: string): Promise<TrophyCheckResult> {
  // Battle trophies are now awarded automatically after each battle
  // in guildBattle.ts via the guildBattleTrophies service
  return { newTrophies: [] };
}

/**
 * Award champions trophy (called from leaderboard service)
 * Note: Tower Race medals now replace the old CHAMPIONS trophy
 */
export async function awardChampionsTrophy(_guildId: string): Promise<void> {
  // Tower Race medals are now handled by weeklyGuildReset job
  // via guildMedals.distributeTowerRaceMedals()
  return;
}

/**
 * Get trophy bonuses for a guild
 * Uses the new GuildBattleTrophy system
 */
export async function getTrophyBonuses(guildId: string): Promise<{
  statBonus: number;
  goldBonus: number;
  xpBonus: number;
  dustBonus: number;
  coinMultiplier: number;
}> {
  // Get earned trophies from new system
  const trophies = await prisma.guildBattleTrophy.findMany({
    where: { guildId, isActive: true },
    select: { trophyId: true },
  });

  const trophyIds = trophies.map(t => t.trophyId);
  const statBonus = await getTrophyStatBonus(guildId);
  const coinMultiplier = calculateCoinMultiplier(trophyIds);

  // The new system focuses on battle stats and coin multipliers
  // Gold/XP/Dust bonuses from old trophies (WEALTHY/UNITED/ANCIENT) are removed
  return {
    statBonus,
    goldBonus: 0,
    xpBonus: 0,
    dustBonus: 0,
    coinMultiplier,
  };
}

/**
 * Get full trophy data for a guild (use this for UI)
 */
export { getGuildTrophies } from './guildBattleTrophies.js';
