/**
 * Hub Preview state management using Preact Signals
 * Handles viewing other players' hub configurations
 */
import { signal, computed } from '@preact/signals';
import type { HubPreviewResponse } from '@arcade/protocol';
import type { FortressClass } from '@arcade/sim-core';
import { fetchHubPreview } from '../api/hubPreview.js';
import { transformHubPreviewToHubState, getFortressTierFromLevel } from '../utils/hubPreviewTransform.js';
import type { HubState } from '../renderer/scenes/GameScene.js';
import { closeLeaderboardModal } from './leaderboard.signals.js';

// ============================================================================
// MODAL STATE
// ============================================================================

/** Hub preview data for the viewed user */
export const hubPreviewData = signal<HubPreviewResponse | null>(null);

/** Loading state */
export const hubPreviewLoading = signal(false);

/** Error message */
export const hubPreviewError = signal<string | null>(null);

/** Whether the hub preview modal is visible */
export const hubPreviewModalOpen = signal(false);

/** User ID currently being previewed */
export const hubPreviewUserId = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/** Whether hub preview modal should be visible */
export const isHubPreviewVisible = computed(() => hubPreviewModalOpen.value);

/** Whether preview is ready to display */
export const isHubPreviewReady = computed(
  () => !hubPreviewLoading.value && hubPreviewData.value !== null && !hubPreviewError.value
);

/** Transformed hub state for rendering */
export const hubPreviewHubState = computed<HubState | null>(() => {
  const data = hubPreviewData.value;
  if (!data) return null;
  return transformHubPreviewToHubState(data);
});

/** Fortress class for preview */
export const hubPreviewFortressClass = computed<FortressClass | null>(() => {
  const data = hubPreviewData.value;
  if (!data) return null;
  return data.fortressClass as FortressClass;
});

/** Fortress tier based on level */
export const hubPreviewFortressTier = computed<1 | 2 | 3>(() => {
  const data = hubPreviewData.value;
  if (!data) return 1;
  return getFortressTierFromLevel(data.level);
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Open hub preview modal for a specific user
 * @param userId - The user ID to preview
 */
export async function openHubPreview(userId: string): Promise<void> {
  // Close leaderboard modal if open (so profile appears on clean background)
  closeLeaderboardModal();

  // Set modal state
  hubPreviewUserId.value = userId;
  hubPreviewModalOpen.value = true;
  hubPreviewError.value = null;
  hubPreviewLoading.value = true;
  hubPreviewData.value = null;

  try {
    const data = await fetchHubPreview(userId);
    if (data) {
      hubPreviewData.value = data;
    } else {
      hubPreviewError.value = 'Nie znaleziono gracza';
    }
  } catch (error) {
    console.error('Failed to fetch hub preview:', error);
    hubPreviewError.value = 'Nie udalo sie zaladowac danych';
  } finally {
    hubPreviewLoading.value = false;
  }
}

/**
 * Close the hub preview modal and reset state
 */
export function closeHubPreview(): void {
  hubPreviewModalOpen.value = false;
  hubPreviewUserId.value = null;
  hubPreviewData.value = null;
  hubPreviewError.value = null;
  hubPreviewLoading.value = false;
}
