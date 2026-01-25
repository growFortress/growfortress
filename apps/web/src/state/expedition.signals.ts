/**
 * Expedition Signals
 *
 * State management for the expedition system (offline wave progress).
 */

import { signal, computed } from '@preact/signals';
import {
  getExpeditionStatus,
  startExpedition as apiStartExpedition,
  claimExpeditionRewards as apiClaimRewards,
  cancelExpedition as apiCancelExpedition,
  type ExpeditionStatus,
  type ExpeditionRewards,
  type LoadoutSnapshot,
} from '../api/expedition.js';

// Expedition state
export const expeditionStatus = signal<ExpeditionStatus | null>(null);
export const expeditionLoading = signal(false);
export const expeditionError = signal<string | null>(null);

// Computed values
export const expeditionActive = computed(() => expeditionStatus.value?.isActive ?? false);

export const expeditionProgress = computed(() => {
  const status = expeditionStatus.value;
  if (!status || !status.isActive) return 0;
  return Math.min(status.hoursElapsed / status.maxOfflineHours, 1);
});

export const expeditionTimeRemaining = computed(() => {
  const status = expeditionStatus.value;
  if (!status || !status.isActive) return 0;
  return Math.max(0, status.maxOfflineHours - status.hoursElapsed);
});

export const expeditionPendingRewards = computed(() => {
  return expeditionStatus.value?.pendingRewards ?? {
    gold: 0,
    dust: 0,
    xp: 0,
    materials: {},
  };
});

export const canClaimExpedition = computed(() => {
  return expeditionStatus.value?.canClaim ?? false;
});

/**
 * Fetch expedition status from server
 */
export async function fetchExpeditionStatus(): Promise<void> {
  expeditionLoading.value = true;
  expeditionError.value = null;

  try {
    const status = await getExpeditionStatus();
    expeditionStatus.value = status;
  } catch (error) {
    console.error('Failed to fetch expedition status:', error);
    expeditionError.value = 'Failed to load expedition status';
  } finally {
    expeditionLoading.value = false;
  }
}

/**
 * Start a new expedition
 */
export async function startExpedition(
  loadout: LoadoutSnapshot,
  power: number,
  highestWave: number
): Promise<boolean> {
  expeditionLoading.value = true;
  expeditionError.value = null;

  try {
    const status = await apiStartExpedition(loadout, power, highestWave);
    expeditionStatus.value = status;
    return true;
  } catch (error) {
    console.error('Failed to start expedition:', error);
    expeditionError.value = 'Failed to start expedition';
    return false;
  } finally {
    expeditionLoading.value = false;
  }
}

/**
 * Claim expedition rewards
 */
export async function claimExpeditionRewards(): Promise<ExpeditionRewards | null> {
  expeditionLoading.value = true;
  expeditionError.value = null;

  try {
    const rewards = await apiClaimRewards();
    // Refresh status after claiming
    await fetchExpeditionStatus();
    return rewards;
  } catch (error) {
    console.error('Failed to claim expedition rewards:', error);
    expeditionError.value = 'Failed to claim rewards';
    return null;
  } finally {
    expeditionLoading.value = false;
  }
}

/**
 * Cancel expedition (forfeits rewards)
 */
export async function cancelExpedition(): Promise<boolean> {
  expeditionLoading.value = true;
  expeditionError.value = null;

  try {
    await apiCancelExpedition();
    // Refresh status after cancelling
    await fetchExpeditionStatus();
    return true;
  } catch (error) {
    console.error('Failed to cancel expedition:', error);
    expeditionError.value = 'Failed to cancel expedition';
    return false;
  } finally {
    expeditionLoading.value = false;
  }
}

/**
 * Format hours remaining as readable string
 */
export function formatTimeRemaining(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes}m`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.floor((hours - wholeHours) * 60);
  if (minutes > 0) {
    return `${wholeHours}h ${minutes}m`;
  }
  return `${wholeHours}h`;
}
