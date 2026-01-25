/**
 * Prestige System - Stellar Rebirth
 *
 * Players can reset their colonies in exchange for Stellar Points (SP)
 * which provide permanent production bonuses.
 *
 * SP earned = floor(sqrt(totalGoldEarned / 10000))
 */

export interface PrestigeTier {
  sp: number;
  bonus: number;
  unlock: string | null;
}

export const PRESTIGE_BONUSES: PrestigeTier[] = [
  { sp: 1, bonus: 0.05, unlock: null },
  { sp: 5, bonus: 0.10, unlock: 'auto_claim' },
  { sp: 10, bonus: 0.15, unlock: 'rush_mode' },
  { sp: 25, bonus: 0.25, unlock: 'research_lab' },
  { sp: 50, bonus: 0.50, unlock: 'golden_theme' },
];

/**
 * Calculate Stellar Points earned from total lifetime gold
 */
export function calculateStellarPoints(totalGoldEarned: bigint): number {
  // SP = floor(sqrt(totalGold / 10000))
  const goldAsNumber = Number(totalGoldEarned);
  if (goldAsNumber < 10000) return 0;
  return Math.floor(Math.sqrt(goldAsNumber / 10000));
}

/**
 * Get the production bonus for a given number of Stellar Points
 */
export function getPrestigeBonus(stellarPoints: number): number {
  let bonus = 0;
  for (const tier of PRESTIGE_BONUSES) {
    if (stellarPoints >= tier.sp) {
      bonus = tier.bonus;
    }
  }
  return bonus;
}

/**
 * Get all unlocked features for a given number of Stellar Points
 */
export function getPrestigeUnlocks(stellarPoints: number): string[] {
  const unlocks: string[] = [];
  for (const tier of PRESTIGE_BONUSES) {
    if (stellarPoints >= tier.sp && tier.unlock) {
      unlocks.push(tier.unlock);
    }
  }
  return unlocks;
}

/**
 * Get the next prestige tier to reach
 */
export function getNextPrestigeTier(stellarPoints: number): PrestigeTier | null {
  for (const tier of PRESTIGE_BONUSES) {
    if (stellarPoints < tier.sp) {
      return tier;
    }
  }
  return null;
}

/**
 * Get progress to next prestige tier (0-1)
 */
export function getPrestigeProgress(stellarPoints: number): { current: number; next: number; progress: number } {
  let previous = 0;
  for (const tier of PRESTIGE_BONUSES) {
    if (stellarPoints < tier.sp) {
      return {
        current: stellarPoints,
        next: tier.sp,
        progress: (stellarPoints - previous) / (tier.sp - previous),
      };
    }
    previous = tier.sp;
  }
  // Maxed out
  const last = PRESTIGE_BONUSES[PRESTIGE_BONUSES.length - 1];
  return {
    current: stellarPoints,
    next: last.sp,
    progress: 1,
  };
}

/**
 * Minimum total gold required before prestige becomes available
 */
export const PRESTIGE_MINIMUM_GOLD = 100_000n;

/**
 * Check if a player can prestige
 */
export function canPrestige(totalGoldEarned: bigint): boolean {
  return totalGoldEarned >= PRESTIGE_MINIMUM_GOLD;
}

/**
 * Calculate bonus multiplier from prestige
 * Returns 1.0 + bonus (e.g., 1.10 for 10% bonus)
 */
export function getPrestigeMultiplier(stellarPoints: number): number {
  return 1 + getPrestigeBonus(stellarPoints);
}
