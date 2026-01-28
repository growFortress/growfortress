import { signal, computed } from '@preact/signals';
import {
  getPendingIdleRewards,
  claimIdleRewards as apiClaimIdleRewards,
  upgradeColony as apiUpgradeColony,
  getPrestigeStatus as apiGetPrestigeStatus,
  performPrestige as apiPerformPrestige,
  getMilestones as apiGetMilestones,
  claimColonyMilestone as apiClaimColonyMilestone,
} from '../api/client.js';
import { updatePlayerMaterials, addMaterialDrop } from './materials.signals.js';
import { baseDust, baseGold } from './profile.signals.js';
import type { MaterialType } from '@arcade/sim-core';
import type { ColonyStatus } from '@arcade/protocol';

// Types
export interface IdleRewardsState {
  hoursOffline: number;
  cappedHours: number;
  pendingMaterials: Record<string, number>;
  pendingDust: number;
  pendingGold: number;
  canClaim: boolean;
  minutesUntilNextClaim: number;
  // Colony data
  colonies: ColonyStatus[];
  totalGoldPerHour: number;
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
  const hasGold = state.pendingGold > 0;
  return hasMaterials || hasDust || hasGold;
});

// Computed: total pending gold from colonies
export const totalPendingGold = computed(() => {
  const state = idleRewardsState.value;
  if (!state) return 0;
  return state.pendingGold;
});

// Computed: total gold per hour from all colonies
export const totalColonyGoldPerHour = computed(() => {
  const state = idleRewardsState.value;
  if (!state) return 0;
  return state.totalGoldPerHour;
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
    console.error('[idle.signals] Error fetching idle rewards:', error);
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

    // Update gold inventory (from colonies)
    if (response.newInventory?.gold !== undefined) {
      baseGold.value = response.newInventory.gold;
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
  upgradingColony.value = null;
  colonySceneVisible.value = false;
}

// Colony upgrade state
export const upgradingColony = signal<string | null>(null);

// ============================================================================
// COLONY SCENE NAVIGATION
// ============================================================================

/**
 * Whether the full-screen colony scene is visible.
 * This replaces the game view when true.
 */
export const colonySceneVisible = signal(false);

/**
 * Show the full-screen colony scene
 */
export function showColonyScene(): void {
  colonySceneVisible.value = true;
  // Fetch latest colony data when opening
  checkIdleRewards();
}

/**
 * Hide the colony scene and return to game/hub
 */
export function hideColonyScene(): void {
  colonySceneVisible.value = false;
}

/**
 * Upgrade a colony building
 */
export async function upgradeColony(colonyId: string): Promise<boolean> {
  if (upgradingColony.value) return false;

  upgradingColony.value = colonyId;
  idleRewardsError.value = null;

  try {
    const response = await apiUpgradeColony({ colonyId });

    if (!response.success) {
      idleRewardsError.value = response.error || 'Failed to upgrade colony';
      return false;
    }

    // Update gold inventory
    if (response.newInventoryGold !== undefined) {
      baseGold.value = response.newInventoryGold;
    }

    // Refresh idle rewards state to get updated colony data
    await checkIdleRewards();

    return true;
  } catch (error) {
    idleRewardsError.value = error instanceof Error ? error.message : 'Failed to upgrade colony';
    return false;
  } finally {
    upgradingColony.value = null;
  }
}

// ============================================================================
// PRESTIGE SYSTEM
// ============================================================================

export interface PrestigeState {
  stellarPoints: number;
  totalGoldEarned: string;
  prestigeCount: number;
  canPrestige: boolean;
  pendingStellarPoints: number;
  currentBonus: number;
  unlocks: string[];
}

export const prestigeState = signal<PrestigeState | null>(null);
export const prestigeLoading = signal(false);
export const prestigeModalVisible = signal(false);
export const performingPrestige = signal(false);

/**
 * Fetch prestige status from server
 */
export async function checkPrestigeStatus(): Promise<void> {
  prestigeLoading.value = true;

  try {
    const response = await apiGetPrestigeStatus();
    prestigeState.value = response;
  } catch (error) {
    console.error('Failed to fetch prestige status:', error);
    prestigeState.value = null;
  } finally {
    prestigeLoading.value = false;
  }
}

/**
 * Show the prestige modal
 */
export function showPrestigeModal(): void {
  prestigeModalVisible.value = true;
}

/**
 * Hide the prestige modal
 */
export function hidePrestigeModal(): void {
  prestigeModalVisible.value = false;
}

/**
 * Perform prestige (stellar rebirth)
 */
export async function performPrestige(): Promise<boolean> {
  if (performingPrestige.value) return false;

  performingPrestige.value = true;

  try {
    const response = await apiPerformPrestige();

    if (!response.success) {
      idleRewardsError.value = response.error || 'Failed to perform prestige';
      return false;
    }

    // Refresh prestige status and idle rewards
    await Promise.all([
      checkPrestigeStatus(),
      checkIdleRewards(),
    ]);

    hidePrestigeModal();
    return true;
  } catch (error) {
    idleRewardsError.value = error instanceof Error ? error.message : 'Failed to perform prestige';
    return false;
  } finally {
    performingPrestige.value = false;
  }
}

// ============================================================================
// MILESTONES
// ============================================================================

export interface MilestoneState {
  id: string;
  name: string;
  description: string;
  requirement: number;
  claimed: boolean;
  canClaim: boolean;
  reward: {
    gold?: number;
    dust?: number;
    material?: string;
    unlock?: string;
  };
}

export interface MilestonesState {
  milestones: MilestoneState[];
  currentGoldPerHour: number;
  nextMilestone: MilestoneState | null;
  progress: number | null;
}

export const milestonesState = signal<MilestonesState | null>(null);
export const milestonesLoading = signal(false);
export const claimingMilestone = signal<string | null>(null);
export const milestoneNotification = signal<MilestoneState | null>(null);

/**
 * Fetch milestones status from server
 */
export async function checkMilestones(): Promise<void> {
  milestonesLoading.value = true;

  try {
    const response = await apiGetMilestones();
    milestonesState.value = response;

    // Check for claimable milestones to show notification
    const claimable = response.milestones.find(m => m.canClaim);
    if (claimable && !milestoneNotification.value) {
      milestoneNotification.value = claimable;
    }
  } catch (error) {
    console.error('Failed to fetch milestones:', error);
    milestonesState.value = null;
  } finally {
    milestonesLoading.value = false;
  }
}

/**
 * Claim a milestone reward
 */
export async function claimMilestone(milestoneId: string): Promise<boolean> {
  if (claimingMilestone.value) return false;

  claimingMilestone.value = milestoneId;

  try {
    const response = await apiClaimColonyMilestone({ milestoneId });

    if (!response.success) {
      idleRewardsError.value = response.error || 'Failed to claim milestone';
      return false;
    }

    // Update inventory
    if (response.newInventory) {
      baseGold.value = response.newInventory.gold;
      baseDust.value = response.newInventory.dust;
      updatePlayerMaterials(response.newInventory.materials);
    }

    // Clear notification if this was the notified milestone
    if (milestoneNotification.value?.id === milestoneId) {
      milestoneNotification.value = null;
    }

    // Refresh milestones
    await checkMilestones();

    return true;
  } catch (error) {
    idleRewardsError.value = error instanceof Error ? error.message : 'Failed to claim milestone';
    return false;
  } finally {
    claimingMilestone.value = null;
  }
}

/**
 * Dismiss milestone notification
 */
export function dismissMilestoneNotification(): void {
  milestoneNotification.value = null;
}
