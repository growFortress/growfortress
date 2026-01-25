/**
 * Achievements State Management
 *
 * Manages the achievements system state including:
 * - Achievement progress tracking
 * - Lifetime stats display
 * - Reward claiming (single and bulk)
 * - Title management
 */

import { signal, computed } from '@preact/signals';
import {
  getAchievements,
  claimReward as apiClaimReward,
  claimAllRewards as apiClaimAllRewards,
  setActiveTitle as apiSetActiveTitle,
} from '../api/achievements.js';
import { baseDust, baseGold } from './profile.signals.js';
import { playerMaterials } from './materials.signals.js';
import type {
  GetAchievementsResponse,
  AchievementId,
  AchievementCategory,
} from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

export const achievementsData = signal<GetAchievementsResponse | null>(null);
export const achievementsLoading = signal(false);
export const achievementsError = signal<string | null>(null);
export const achievementsModalVisible = signal(false);
export const claimingAchievement = signal<{ id: AchievementId; tier: number } | null>(null);
export const claimingAll = signal(false);
export const settingTitle = signal(false);
export const selectedCategory = signal<AchievementCategory | 'all'>('all');

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Total count of unclaimed rewards across all achievements
 */
export const totalUnclaimedCount = computed(() => {
  return achievementsData.value?.totalUnclaimedRewards ?? 0;
});

/**
 * Whether there are any unclaimed achievement rewards
 */
export const hasUnclaimedAchievementRewards = computed(() => totalUnclaimedCount.value > 0);

/**
 * All unlocked titles
 */
export const unlockedTitles = computed(() => {
  return achievementsData.value?.unlockedTitles ?? [];
});

/**
 * Currently active title
 */
export const activeTitle = computed(() => {
  return achievementsData.value?.activeTitle ?? null;
});

/**
 * Lifetime stats
 */
export const lifetimeStats = computed(() => {
  return achievementsData.value?.lifetimeStats ?? null;
});

/**
 * Achievements filtered by selected category
 */
export const filteredAchievements = computed(() => {
  const data = achievementsData.value;
  if (!data) return [];

  const category = selectedCategory.value;
  if (category === 'all') {
    return data.achievements;
  }

  return data.achievements.filter(a => a.definition.category === category);
});

/**
 * Achievements with unclaimed rewards
 */
export const achievementsWithUnclaimedRewards = computed(() => {
  const data = achievementsData.value;
  if (!data) return [];

  return data.achievements.filter(a => a.progress.hasUnclaimedReward);
});

/**
 * Category progress stats
 */
export const categoryProgress = computed(() => {
  return achievementsData.value?.categoryProgress ?? null;
});

/**
 * Total achievements completed (all tiers claimed)
 */
export const totalAchievementsCompleted = computed(() => {
  const data = achievementsData.value;
  if (!data) return 0;

  let count = 0;
  for (const ach of data.achievements) {
    if (ach.progress.currentTier === ach.definition.tiers.length &&
        ach.progress.claimedTiers.length === ach.definition.tiers.length) {
      count++;
    }
  }
  return count;
});

/**
 * Total achievements count
 */
export const totalAchievementsCount = computed(() => {
  return achievementsData.value?.achievements.length ?? 0;
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch achievements data from server
 */
export async function fetchAchievements(): Promise<void> {
  achievementsLoading.value = true;
  achievementsError.value = null;

  try {
    const response = await getAchievements();
    achievementsData.value = response;
  } catch (error) {
    achievementsError.value = error instanceof Error ? error.message : 'Failed to fetch achievements';
    achievementsData.value = null;
  } finally {
    achievementsLoading.value = false;
  }
}

/**
 * Claim a single achievement tier reward
 */
export async function claimReward(achievementId: AchievementId, tier: number): Promise<boolean> {
  if (claimingAchievement.value || claimingAll.value) return false;

  claimingAchievement.value = { id: achievementId, tier };
  achievementsError.value = null;

  try {
    const response = await apiClaimReward(achievementId, tier);

    if (!response.success) {
      achievementsError.value = response.error || 'Failed to claim reward';
      return false;
    }

    // Update inventory
    if (response.newInventory) {
      baseDust.value = response.newInventory.dust;
      baseGold.value = response.newInventory.gold;
      if (response.newInventory.materials) {
        playerMaterials.value = response.newInventory.materials;
      }
    }

    // Refresh achievements data
    await fetchAchievements();

    return true;
  } catch (error) {
    achievementsError.value = error instanceof Error ? error.message : 'Failed to claim reward';
    return false;
  } finally {
    claimingAchievement.value = null;
  }
}

/**
 * Claim all unclaimed achievement rewards
 */
export async function claimAllRewards(): Promise<boolean> {
  if (claimingAchievement.value || claimingAll.value) return false;
  if (totalUnclaimedCount.value === 0) return false;

  claimingAll.value = true;
  achievementsError.value = null;

  try {
    const response = await apiClaimAllRewards();

    if (!response.success) {
      achievementsError.value = response.error || 'Failed to claim rewards';
      return false;
    }

    // Update inventory
    if (response.newInventory) {
      baseDust.value = response.newInventory.dust;
      baseGold.value = response.newInventory.gold;
      if (response.newInventory.materials) {
        playerMaterials.value = response.newInventory.materials;
      }
    }

    // Refresh achievements data
    await fetchAchievements();

    return true;
  } catch (error) {
    achievementsError.value = error instanceof Error ? error.message : 'Failed to claim rewards';
    return false;
  } finally {
    claimingAll.value = false;
  }
}

/**
 * Set active title
 */
export async function setActiveTitle(title: string | null): Promise<boolean> {
  if (settingTitle.value) return false;

  settingTitle.value = true;
  achievementsError.value = null;

  try {
    const response = await apiSetActiveTitle(title);

    if (!response.success) {
      achievementsError.value = response.error || 'Failed to set title';
      return false;
    }

    // Refresh achievements data
    await fetchAchievements();

    return true;
  } catch (error) {
    achievementsError.value = error instanceof Error ? error.message : 'Failed to set title';
    return false;
  } finally {
    settingTitle.value = false;
  }
}

/**
 * Show achievements modal (and fetch data)
 */
export async function showAchievementsModal(): Promise<void> {
  achievementsModalVisible.value = true;
  await fetchAchievements();
}

/**
 * Hide achievements modal
 */
export function hideAchievementsModal(): void {
  achievementsModalVisible.value = false;
}

/**
 * Set the selected category filter
 */
export function setSelectedCategory(category: AchievementCategory | 'all'): void {
  selectedCategory.value = category;
}

/**
 * Reset all achievements state (on logout)
 */
export function resetAchievementsState(): void {
  achievementsData.value = null;
  achievementsLoading.value = false;
  achievementsError.value = null;
  achievementsModalVisible.value = false;
  claimingAchievement.value = null;
  claimingAll.value = false;
  settingTitle.value = false;
  selectedCategory.value = 'all';
}

/**
 * Check if a specific achievement tier has been claimed
 */
export function isTierClaimed(achievementId: AchievementId, tier: number): boolean {
  const data = achievementsData.value;
  if (!data) return false;

  const achievement = data.achievements.find(a => a.definition.id === achievementId);
  if (!achievement) return false;

  return achievement.progress.claimedTiers.includes(tier);
}

/**
 * Check if a tier is available to claim
 */
export function isTierClaimable(achievementId: AchievementId, tier: number): boolean {
  const data = achievementsData.value;
  if (!data) return false;

  const achievement = data.achievements.find(a => a.definition.id === achievementId);
  if (!achievement) return false;

  const tierDef = achievement.definition.tiers.find(t => t.tier === tier);
  if (!tierDef) return false;

  // Must have reached the target
  if (achievement.progress.currentProgress < tierDef.target) return false;

  // Must not be already claimed
  return !achievement.progress.claimedTiers.includes(tier);
}

/**
 * Get the Roman numeral representation of a tier
 */
export function getTierRomanNumeral(tier: number): string {
  const romanNumerals: Record<number, string> = {
    1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
    6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  };
  return romanNumerals[tier] || tier.toString();
}

/**
 * Format large numbers for display (e.g., 1000 -> 1K, 1000000 -> 1M)
 */
export function formatStatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return '0';

  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}
