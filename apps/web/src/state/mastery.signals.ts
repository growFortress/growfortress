/**
 * Mastery System State
 *
 * Client-side state management for the Class Mastery Tree system.
 */

import { signal, computed, Signal, ReadonlySignal } from '@preact/signals';
import type {
  PlayerMasteryProgress,
  ClassMasteryProgress,
  ClassProgressSummary,
} from '@arcade/protocol';
import type { FortressClass, MasteryTreeDefinition } from '@arcade/sim-core';

// ============================================================================
// STATE TYPES
// ============================================================================

export interface MasteryState {
  // Player's mastery progress
  progress: PlayerMasteryProgress | null;

  // Tree definitions (cached)
  trees: Record<FortressClass, MasteryTreeDefinition> | null;

  // Class progress summaries
  summaries: ClassProgressSummary[];

  // UI state
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// SIGNALS
// ============================================================================

/**
 * Main mastery state
 */
export const masteryState: Signal<MasteryState> = signal<MasteryState>({
  progress: null,
  trees: null,
  summaries: [],
  isLoading: false,
  error: null,
});

/**
 * Mastery modal visibility
 */
export const masteryModalVisible: Signal<boolean> = signal(false);

/**
 * Currently selected class in the mastery modal
 */
export const selectedMasteryClass: Signal<FortressClass> = signal<FortressClass>('natural');

/**
 * Currently hovered node (for tooltip)
 */
export const hoveredMasteryNode: Signal<string | null> = signal(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * Available mastery points
 */
export const availableMasteryPoints: ReadonlySignal<number> = computed(() => {
  return masteryState.value.progress?.availablePoints ?? 0;
});

/**
 * Total points ever earned
 */
export const totalMasteryPointsEarned: ReadonlySignal<number> = computed(() => {
  return masteryState.value.progress?.totalPointsEarned ?? 0;
});

/**
 * Current class progress
 */
export const currentClassProgress: ReadonlySignal<ClassMasteryProgress | null> = computed(() => {
  const progress = masteryState.value.progress;
  if (!progress) return null;
  return progress.classProgress[selectedMasteryClass.value] ?? null;
});

/**
 * Current class tree definition
 */
export const currentTreeDefinition: ReadonlySignal<MasteryTreeDefinition | null> = computed(() => {
  const trees = masteryState.value.trees;
  if (!trees) return null;
  return trees[selectedMasteryClass.value] ?? null;
});

/**
 * Check if a node is unlocked
 */
export function isNodeUnlocked(nodeId: string): boolean {
  const progress = currentClassProgress.value;
  if (!progress) return false;
  return progress.unlockedNodes.includes(nodeId);
}

/**
 * Get total points spent across all classes
 */
export const totalPointsSpent: ReadonlySignal<number> = computed(() => {
  const progress = masteryState.value.progress;
  if (!progress) return 0;

  let total = 0;
  for (const classProgress of Object.values(progress.classProgress)) {
    total += classProgress.pointsSpent;
  }
  return total;
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Open the mastery modal
 */
export function openMasteryModal(classId?: FortressClass): void {
  if (classId) {
    selectedMasteryClass.value = classId;
  }
  masteryModalVisible.value = true;
}

/**
 * Close the mastery modal
 */
export function closeMasteryModal(): void {
  masteryModalVisible.value = false;
  hoveredMasteryNode.value = null;
}

/**
 * Select a class to view
 */
export function selectMasteryClass(classId: FortressClass): void {
  selectedMasteryClass.value = classId;
}

/**
 * Set loading state
 */
export function setMasteryLoading(loading: boolean): void {
  masteryState.value = {
    ...masteryState.value,
    isLoading: loading,
    error: loading ? null : masteryState.value.error,
  };
}

/**
 * Set error state
 */
export function setMasteryError(error: string | null): void {
  masteryState.value = {
    ...masteryState.value,
    isLoading: false,
    error,
  };
}

/**
 * Update progress after successful API call
 */
export function updateMasteryProgress(progress: PlayerMasteryProgress): void {
  masteryState.value = {
    ...masteryState.value,
    progress,
    isLoading: false,
    error: null,
  };
}

/**
 * Update trees (cached)
 */
export function updateMasteryTrees(trees: Record<FortressClass, MasteryTreeDefinition>): void {
  masteryState.value = {
    ...masteryState.value,
    trees,
  };
}

/**
 * Update summaries
 */
export function updateMasterySummaries(summaries: ClassProgressSummary[]): void {
  masteryState.value = {
    ...masteryState.value,
    summaries,
  };
}

/**
 * Reset mastery state (e.g., on logout)
 */
export function resetMasteryState(): void {
  masteryState.value = {
    progress: null,
    trees: null,
    summaries: [],
    isLoading: false,
    error: null,
  };
  masteryModalVisible.value = false;
  selectedMasteryClass.value = 'natural';
  hoveredMasteryNode.value = null;
}
