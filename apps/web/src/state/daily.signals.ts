/**
 * Daily Login State Management
 *
 * Manages the daily login rewards system state including:
 * - Current day in the 7-day cycle
 * - Streak tracking and bonuses
 * - Reward claiming
 */

import { signal, computed } from '@preact/signals';
import {
  getDailyStatus,
  claimDailyReward as apiClaimDailyReward,
} from '../api/daily.js';
import { baseDust, baseGold } from './profile.signals.js';
import { playerMaterials } from './materials.signals.js';
import type { DailyLoginStatusResponse } from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

export const dailyStatus = signal<DailyLoginStatusResponse | null>(null);
export const dailyLoading = signal(false);
export const dailyError = signal<string | null>(null);
export const dailyModalVisible = signal(false);
export const claiming = signal(false);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Whether the player can claim today's reward
 */
export const canClaimDaily = computed(() => {
  return dailyStatus.value?.canClaim ?? false;
});

/**
 * Current day in the 7-day cycle (1-7)
 */
export const currentDay = computed(() => {
  return dailyStatus.value?.currentDay ?? 1;
});

/**
 * Current login streak (consecutive days)
 */
export const streak = computed(() => {
  return dailyStatus.value?.streak ?? 0;
});

/**
 * Current streak multiplier for rewards
 */
export const streakMultiplier = computed(() => {
  return dailyStatus.value?.streakMultiplier ?? 1;
});

/**
 * Days until next streak milestone
 */
export const daysUntilNextMilestone = computed(() => {
  return dailyStatus.value?.daysUntilNextMilestone ?? null;
});

/**
 * Next streak milestone value
 */
export const nextMilestone = computed(() => {
  return dailyStatus.value?.nextMilestone ?? null;
});

/**
 * Daily rewards with claimed status
 */
export const rewards = computed(() => {
  return dailyStatus.value?.rewards ?? [];
});

/**
 * Total days claimed
 */
export const totalDaysClaimed = computed(() => {
  return dailyStatus.value?.totalDaysClaimed ?? 0;
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch daily login status from server
 */
export async function fetchDailyStatus(): Promise<void> {
  dailyLoading.value = true;
  dailyError.value = null;

  try {
    const response = await getDailyStatus();
    dailyStatus.value = response;
  } catch (error) {
    dailyError.value = error instanceof Error ? error.message : 'Failed to fetch daily status';
    dailyStatus.value = null;
  } finally {
    dailyLoading.value = false;
  }
}

/**
 * Claim today's daily reward
 */
export async function claimDailyReward(): Promise<boolean> {
  if (claiming.value || !canClaimDaily.value) return false;

  claiming.value = true;
  dailyError.value = null;

  try {
    const response = await apiClaimDailyReward();

    if (!response.success) {
      dailyError.value = response.error || 'Failed to claim reward';
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

    // Refresh daily status to update UI
    await fetchDailyStatus();

    return true;
  } catch (error) {
    dailyError.value = error instanceof Error ? error.message : 'Failed to claim reward';
    return false;
  } finally {
    claiming.value = false;
  }
}

/**
 * Show daily rewards modal (and fetch data)
 */
export async function showDailyModal(): Promise<void> {
  dailyModalVisible.value = true;
  await fetchDailyStatus();
}

/**
 * Hide daily rewards modal
 */
export function hideDailyModal(): void {
  dailyModalVisible.value = false;
}

/**
 * Reset all daily state (on logout)
 */
export function resetDailyState(): void {
  dailyStatus.value = null;
  dailyLoading.value = false;
  dailyError.value = null;
  dailyModalVisible.value = false;
  claiming.value = false;
}
