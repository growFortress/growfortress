/**
 * Daily Quests State Management
 *
 * Manages the daily quest system state including:
 * - Quest progress tracking
 * - Reward claiming
 * - Reset countdown timer
 */

import { signal, computed } from '@preact/signals';
import {
  getDailyQuests,
  claimQuestReward as apiClaimQuestReward,
  claimAllQuestRewards as apiClaimAllQuestRewards,
} from '../api/dailyQuests.js';
import { updatePlayerMaterials, addMaterialDrop } from './materials.signals.js';
import { DAILY_QUEST_DEFINITIONS, type DailyQuestId, type DailyQuestProgress } from '@arcade/protocol';
import type { MaterialType } from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface DailyQuestsState {
  quests: DailyQuestProgress[];
  resetAt: string; // ISO timestamp
  totalDustEarned: number;
  allCompleted: boolean;
  allClaimed: boolean;
}

// ============================================================================
// SIGNALS
// ============================================================================

export const dailyQuestsState = signal<DailyQuestsState | null>(null);
export const dailyQuestsLoading = signal(false);
export const dailyQuestsError = signal<string | null>(null);
export const dailyQuestsPanelVisible = signal(false);
export const claimingQuest = signal<DailyQuestId | null>(null);
export const claimingAll = signal(false);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Number of quests that are completed but not yet claimed
 */
export const unclaimedCompletedCount = computed(() => {
  const state = dailyQuestsState.value;
  if (!state) return 0;
  return state.quests.filter(q => q.completed && !q.claimed).length;
});

/**
 * Total dust available from unclaimed completed quests
 */
export const unclaimedDustTotal = computed(() => {
  const state = dailyQuestsState.value;
  if (!state) return 0;
  return state.quests
    .filter(q => q.completed && !q.claimed)
    .reduce((sum, q) => sum + q.dustReward, 0);
});

/**
 * Whether there are any unclaimed rewards
 */
export const hasUnclaimedRewards = computed(() => unclaimedCompletedCount.value > 0);

/**
 * Total potential dust from all quests
 */
export const totalPotentialDust = computed(() => {
  return DAILY_QUEST_DEFINITIONS.reduce((sum, q) => sum + q.dustReward, 0);
});

/**
 * Progress percentage towards completing all quests
 */
export const overallProgress = computed(() => {
  const state = dailyQuestsState.value;
  if (!state) return 0;
  const completed = state.quests.filter(q => q.completed).length;
  return Math.round((completed / state.quests.length) * 100);
});

/**
 * Time until next reset (formatted string)
 */
export const timeUntilReset = computed(() => {
  const state = dailyQuestsState.value;
  if (!state) return '';

  const resetTime = new Date(state.resetAt).getTime();
  const now = Date.now();
  const diffMs = resetTime - now;

  if (diffMs <= 0) return 'Reset pending...';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch daily quests from server
 */
export async function fetchDailyQuests(): Promise<void> {
  dailyQuestsLoading.value = true;
  dailyQuestsError.value = null;

  try {
    const response = await getDailyQuests();
    dailyQuestsState.value = response;
  } catch (error) {
    dailyQuestsError.value = error instanceof Error ? error.message : 'Failed to fetch daily quests';
    dailyQuestsState.value = null;
  } finally {
    dailyQuestsLoading.value = false;
  }
}

/**
 * Claim reward for a specific quest
 */
export async function claimQuestReward(questId: DailyQuestId): Promise<boolean> {
  if (claimingQuest.value || claimingAll.value) return false;

  claimingQuest.value = questId;
  dailyQuestsError.value = null;

  try {
    const response = await apiClaimQuestReward(questId);

    if (!response.success) {
      dailyQuestsError.value = response.error || 'Failed to claim quest reward';
      return false;
    }

    // Update materials inventory
    if (response.newInventory?.materials) {
      updatePlayerMaterials(response.newInventory.materials);
    }

    // Show drop notifications for bonus materials
    if (response.bonusAwarded?.type === 'material' || response.bonusAwarded?.type === 'random_material') {
      // For materials, we need to check if materials were updated
      // The actual material drops would be in the inventory update
    }

    // Refresh quest state
    await fetchDailyQuests();

    return true;
  } catch (error) {
    dailyQuestsError.value = error instanceof Error ? error.message : 'Failed to claim quest reward';
    return false;
  } finally {
    claimingQuest.value = null;
  }
}

/**
 * Claim all completed but unclaimed quest rewards
 */
export async function claimAllQuestRewards(): Promise<boolean> {
  if (claimingQuest.value || claimingAll.value) return false;
  if (unclaimedCompletedCount.value === 0) return false;

  claimingAll.value = true;
  dailyQuestsError.value = null;

  try {
    const response = await apiClaimAllQuestRewards();

    if (!response.success) {
      dailyQuestsError.value = response.error || 'Failed to claim quest rewards';
      return false;
    }

    // Update materials inventory
    if (response.newInventory?.materials) {
      updatePlayerMaterials(response.newInventory.materials);
    }

    // Show drop notifications for materials
    if (response.materialsAwarded) {
      for (const [materialId, amount] of Object.entries(response.materialsAwarded)) {
        if (amount > 0) {
          addMaterialDrop(materialId as MaterialType, amount);
        }
      }
    }

    // Refresh quest state
    await fetchDailyQuests();

    return true;
  } catch (error) {
    dailyQuestsError.value = error instanceof Error ? error.message : 'Failed to claim quest rewards';
    return false;
  } finally {
    claimingAll.value = false;
  }
}

/**
 * Show daily quests panel
 */
export function showDailyQuestsPanel(): void {
  dailyQuestsPanelVisible.value = true;
}

/**
 * Hide daily quests panel
 */
export function hideDailyQuestsPanel(): void {
  dailyQuestsPanelVisible.value = false;
}

/**
 * Get quest definition by ID
 */
export function getQuestDefinition(questId: string) {
  return DAILY_QUEST_DEFINITIONS.find(q => q.id === questId);
}

/**
 * Reset all daily quests state (on logout)
 */
export function resetDailyQuestsState(): void {
  dailyQuestsState.value = null;
  dailyQuestsLoading.value = false;
  dailyQuestsError.value = null;
  dailyQuestsPanelVisible.value = false;
  claimingQuest.value = null;
  claimingAll.value = false;
}
