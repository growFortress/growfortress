import { signal, computed } from '@preact/signals';
import {
  getPendingIdleRewards,
  claimIdleRewards as apiClaimIdleRewards,
} from '../api/client.js';
import { updatePlayerMaterials, addMaterialDrop } from './materials.signals.js';
import { baseDust } from './profile.signals.js';
import type { MaterialType } from '@arcade/sim-core';

// Types
export interface IdleRewardsState {
  hoursOffline: number;
  cappedHours: number;
  pendingMaterials: Record<string, number>;
  pendingDust: number;
  canClaim: boolean;
  minutesUntilNextClaim: number;
}

// Signals
export const idleRewardsState = signal<IdleRewardsState | null>(null);
export const idleRewardsLoading = signal(false);
export const idleRewardsError = signal<string | null>(null);
export const idleRewardsModalVisible = signal(false);
export const claimingRewards = signal(false);

// Computed: has pending rewards worth claiming
export const hasPendingRewards = computed(() => {
  const state = idleRewardsState.value;
  if (!state || !state.canClaim) return false;

  const hasMaterials = Object.keys(state.pendingMaterials).length > 0;
  const hasDust = state.pendingDust > 0;
  return hasMaterials || hasDust;
});

// Computed: total pending materials count
export const totalPendingMaterials = computed(() => {
  const state = idleRewardsState.value;
  if (!state) return 0;
  return Object.values(state.pendingMaterials).reduce((sum, n) => sum + n, 0);
});

/**
 * Fetch pending idle rewards from server
 */
export async function checkIdleRewards(): Promise<void> {
  idleRewardsLoading.value = true;
  idleRewardsError.value = null;

  try {
    const response = await getPendingIdleRewards();
    idleRewardsState.value = response;
  } catch (error) {
    idleRewardsError.value = error instanceof Error ? error.message : 'Failed to check idle rewards';
    idleRewardsState.value = null;
  } finally {
    idleRewardsLoading.value = false;
  }
}

/**
 * Claim pending idle rewards
 */
export async function claimIdleRewards(): Promise<boolean> {
  if (claimingRewards.value) return false;

  claimingRewards.value = true;
  idleRewardsError.value = null;

  try {
    const response = await apiClaimIdleRewards();

    if (!response.success) {
      idleRewardsError.value = response.error || 'Failed to claim rewards';
      return false;
    }

    // Update materials inventory
    if (response.newInventory?.materials) {
      updatePlayerMaterials(response.newInventory.materials);
    }

    // Update dust inventory
    if (response.newInventory?.dust !== undefined) {
      baseDust.value = response.newInventory.dust;
    }

    // Show drop notifications for claimed materials
    if (response.claimed?.materials) {
      for (const [materialId, amount] of Object.entries(response.claimed.materials)) {
        addMaterialDrop(materialId as MaterialType, amount);
      }
    }

    // Reset idle state after claiming
    idleRewardsState.value = null;

    // Fetch updated state
    await checkIdleRewards();

    return true;
  } catch (error) {
    idleRewardsError.value = error instanceof Error ? error.message : 'Failed to claim rewards';
    return false;
  } finally {
    claimingRewards.value = false;
  }
}

/**
 * Show idle rewards modal
 */
export function showIdleRewardsModal(): void {
  idleRewardsModalVisible.value = true;
}

/**
 * Hide idle rewards modal
 */
export function hideIdleRewardsModal(): void {
  idleRewardsModalVisible.value = false;
}

/**
 * Format hours as readable string
 */
export function formatIdleTime(hours: number): string {
  if (hours < 1) {
    const minutes = Math.floor(hours * 60);
    return `${minutes} min`;
  }

  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);

  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/**
 * Reset all idle rewards state (on logout)
 */
export function resetIdleState(): void {
  idleRewardsState.value = null;
  idleRewardsLoading.value = false;
  idleRewardsError.value = null;
  idleRewardsModalVisible.value = false;
  claimingRewards.value = false;
}
