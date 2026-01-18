/**
 * Battle Pass State Management
 *
 * Manages the battle pass system state including:
 * - Season info and progress tracking
 * - Reward claiming (single and bulk)
 * - Tier purchasing with dust
 * - Premium upgrade flow
 */

import { signal, computed } from '@preact/signals';
import {
  getBattlePass,
  claimReward as apiClaimReward,
  claimAllRewards as apiClaimAllRewards,
  purchaseTiers as apiPurchaseTiers,
  upgradeToPremium as apiUpgradeToPremium,
} from '../api/battlepass.js';
import { baseGold, baseDust } from './profile.signals.js';
import {
  BATTLE_PASS_CONFIG,
  BATTLE_PASS_FREE_TRACK,
  BATTLE_PASS_PREMIUM_TRACK,
  type GetBattlePassResponse,
  type BattlePassReward,
} from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

export const battlepassData = signal<GetBattlePassResponse | null>(null);
export const battlepassLoading = signal(false);
export const battlepassError = signal<string | null>(null);
export const battlepassModalVisible = signal(false);
export const claimingTier = signal<{ tier: number; track: 'free' | 'premium' } | null>(null);
export const claimingAll = signal(false);
export const purchasingTiers = signal(false);
export const upgradingPremium = signal(false);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Current tier level
 */
export const currentTier = computed(() => {
  return battlepassData.value?.progress.currentTier ?? 0;
});

/**
 * Current points within current tier
 */
export const currentPoints = computed(() => {
  return battlepassData.value?.progress.currentPoints ?? 0;
});

/**
 * Whether user has premium battle pass
 */
export const isPremium = computed(() => {
  return battlepassData.value?.progress.isPremium ?? false;
});

/**
 * Progress percentage to next tier (0-100)
 */
export const tierProgress = computed(() => {
  const points = currentPoints.value;
  return Math.round((points / BATTLE_PASS_CONFIG.pointsPerTier) * 100);
});

/**
 * Time remaining in season (formatted string)
 */
export const timeRemainingFormatted = computed(() => {
  const data = battlepassData.value;
  if (!data) return '';

  const { days, hours, minutes } = data.timeRemaining;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

/**
 * Unclaimed free track rewards (tier reached but not claimed)
 */
export const unclaimedFreeRewards = computed<BattlePassReward[]>(() => {
  const data = battlepassData.value;
  if (!data) return [];

  const tier = data.progress.currentTier;
  const claimed = new Set(data.progress.claimedFreeTiers);

  return BATTLE_PASS_FREE_TRACK.filter(
    r => r.tier <= tier && !claimed.has(r.tier)
  );
});

/**
 * Unclaimed premium track rewards (for premium users only)
 */
export const unclaimedPremiumRewards = computed<BattlePassReward[]>(() => {
  const data = battlepassData.value;
  if (!data || !data.progress.isPremium) return [];

  const tier = data.progress.currentTier;
  const claimed = new Set(data.progress.claimedPremiumTiers);

  return BATTLE_PASS_PREMIUM_TRACK.filter(
    r => r.tier <= tier && !claimed.has(r.tier)
  );
});

/**
 * Total count of unclaimed rewards
 */
export const totalUnclaimedCount = computed(() => {
  return unclaimedFreeRewards.value.length + unclaimedPremiumRewards.value.length;
});

/**
 * Whether there are any unclaimed rewards
 */
export const hasUnclaimedRewards = computed(() => totalUnclaimedCount.value > 0);

/**
 * Maximum tier (from config)
 */
export const maxTier = computed(() => BATTLE_PASS_CONFIG.maxTier);

/**
 * Cost to buy one tier in dust
 */
export const tierPurchaseCost = computed(() => BATTLE_PASS_CONFIG.tierPurchaseDustCost);

/**
 * Whether user is at max tier
 */
export const isMaxTier = computed(() => currentTier.value >= maxTier.value);

/**
 * Season name
 */
export const seasonName = computed(() => {
  return battlepassData.value?.season.name ?? 'Battle Pass';
});

/**
 * Season description
 */
export const seasonDescription = computed(() => {
  return battlepassData.value?.season.description ?? '';
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch battle pass data from server
 */
export async function fetchBattlePass(): Promise<void> {
  battlepassLoading.value = true;
  battlepassError.value = null;

  try {
    const response = await getBattlePass();
    battlepassData.value = response;
  } catch (error) {
    battlepassError.value = error instanceof Error ? error.message : 'Failed to fetch battle pass';
    battlepassData.value = null;
  } finally {
    battlepassLoading.value = false;
  }
}

/**
 * Claim a single tier reward
 */
export async function claimReward(tier: number, track: 'free' | 'premium'): Promise<boolean> {
  if (claimingTier.value || claimingAll.value) return false;

  claimingTier.value = { tier, track };
  battlepassError.value = null;

  try {
    const response = await apiClaimReward({ tier, track });

    if (!response.success) {
      battlepassError.value = (response as unknown as { error?: string }).error || 'Failed to claim reward';
      return false;
    }

    // Update inventory
    if (response.newDustBalance !== undefined) {
      baseDust.value = response.newDustBalance;
    }
    if (response.newGoldBalance !== undefined) {
      baseGold.value = response.newGoldBalance;
    }

    // Refresh battle pass data
    await fetchBattlePass();

    return true;
  } catch (error) {
    battlepassError.value = error instanceof Error ? error.message : 'Failed to claim reward';
    return false;
  } finally {
    claimingTier.value = null;
  }
}

/**
 * Claim all available rewards
 */
export async function claimAllRewards(): Promise<boolean> {
  if (claimingTier.value || claimingAll.value) return false;
  if (totalUnclaimedCount.value === 0) return false;

  claimingAll.value = true;
  battlepassError.value = null;

  try {
    const response = await apiClaimAllRewards();

    // Update inventory
    baseDust.value = response.newDustBalance;
    baseGold.value = response.newGoldBalance;

    // Refresh battle pass data
    await fetchBattlePass();

    return true;
  } catch (error) {
    battlepassError.value = error instanceof Error ? error.message : 'Failed to claim rewards';
    return false;
  } finally {
    claimingAll.value = false;
  }
}

/**
 * Purchase tiers with dust
 */
export async function purchaseTier(tierCount: number = 1): Promise<boolean> {
  if (purchasingTiers.value) return false;
  if (isMaxTier.value) return false;

  purchasingTiers.value = true;
  battlepassError.value = null;

  try {
    const response = await apiPurchaseTiers({ tierCount });

    if (!response.success) {
      battlepassError.value = (response as unknown as { error?: string }).error || 'Failed to purchase tier';
      return false;
    }

    // Update dust balance
    baseDust.value = response.newDustBalance;

    // Refresh battle pass data
    await fetchBattlePass();

    return true;
  } catch (error) {
    battlepassError.value = error instanceof Error ? error.message : 'Failed to purchase tier';
    return false;
  } finally {
    purchasingTiers.value = false;
  }
}

/**
 * Start premium upgrade flow (redirect to Stripe checkout)
 */
export async function startPremiumUpgrade(): Promise<void> {
  if (upgradingPremium.value) return;
  if (isPremium.value) return;

  upgradingPremium.value = true;
  battlepassError.value = null;

  try {
    const successUrl = `${window.location.origin}/battlepass?upgraded=true`;
    const cancelUrl = `${window.location.origin}/battlepass?cancelled=true`;

    const response = await apiUpgradeToPremium(successUrl, cancelUrl);

    if (!response.success || !response.checkoutUrl) {
      battlepassError.value = (response as unknown as { error?: string }).error || 'Failed to start upgrade';
      return;
    }

    // Redirect to Stripe checkout
    window.location.href = response.checkoutUrl;
  } catch (error) {
    battlepassError.value = error instanceof Error ? error.message : 'Failed to start upgrade';
  } finally {
    upgradingPremium.value = false;
  }
}

/**
 * Show battle pass modal (and fetch data)
 */
export async function showBattlePassModal(): Promise<void> {
  battlepassModalVisible.value = true;
  await fetchBattlePass();
}

/**
 * Hide battle pass modal
 */
export function hideBattlePassModal(): void {
  battlepassModalVisible.value = false;
}

/**
 * Reset all battle pass state (on logout)
 */
export function resetBattlePassState(): void {
  battlepassData.value = null;
  battlepassLoading.value = false;
  battlepassError.value = null;
  battlepassModalVisible.value = false;
  claimingTier.value = null;
  claimingAll.value = false;
  purchasingTiers.value = false;
  upgradingPremium.value = false;
}

/**
 * Check if a specific free tier reward has been claimed
 */
export function isFreeTierClaimed(tier: number): boolean {
  const data = battlepassData.value;
  if (!data) return false;
  return data.progress.claimedFreeTiers.includes(tier);
}

/**
 * Check if a specific premium tier reward has been claimed
 */
export function isPremiumTierClaimed(tier: number): boolean {
  const data = battlepassData.value;
  if (!data) return false;
  return data.progress.claimedPremiumTiers.includes(tier);
}

/**
 * Check if a tier reward is available to claim
 */
export function isTierClaimable(tier: number, track: 'free' | 'premium'): boolean {
  const data = battlepassData.value;
  if (!data) return false;

  // Must have reached the tier
  if (data.progress.currentTier < tier) return false;

  // Check if already claimed
  if (track === 'free') {
    return !data.progress.claimedFreeTiers.includes(tier);
  } else {
    // Must have premium for premium track
    if (!data.progress.isPremium) return false;
    return !data.progress.claimedPremiumTiers.includes(tier);
  }
}
