/**
 * Weekly Missions State Management
 *
 * Manages the weekly missions system state including:
 * - Current week's missions with progress
 * - Reward claiming (single and bulk)
 * - Time until weekly reset
 */

import { signal, computed } from '@preact/signals';
import {
  getWeeklyMissions,
  claimMissionReward as apiClaimMissionReward,
  claimAllMissionRewards as apiClaimAllMissionRewards,
} from '../api/missions.js';
import { baseDust, baseGold } from './profile.signals.js';
import { playerMaterials } from './materials.signals.js';
import type { GetWeeklyMissionsResponse, MissionProgress } from '@arcade/protocol';

// ============================================================================
// SIGNALS
// ============================================================================

export const missionsData = signal<GetWeeklyMissionsResponse | null>(null);
export const missionsLoading = signal(false);
export const missionsError = signal<string | null>(null);
export const missionsModalVisible = signal(false);
export const claimingMission = signal<string | null>(null); // mission ID being claimed
export const claimingAll = signal(false);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/**
 * All missions for the current week
 */
export const missions = computed(() => {
  return missionsData.value?.missions ?? [];
});

/**
 * Number of unclaimed (but completed) missions
 */
export const unclaimedCount = computed(() => {
  return missionsData.value?.unclaimedCount ?? 0;
});

/**
 * Whether there are unclaimed rewards
 */
export const hasUnclaimedMissionRewards = computed(() => unclaimedCount.value > 0);

/**
 * Number of completed missions
 */
export const completedCount = computed(() => {
  return missionsData.value?.totalCompleted ?? 0;
});

/**
 * Number of claimed missions
 */
export const claimedCount = computed(() => {
  return missionsData.value?.totalClaimed ?? 0;
});

/**
 * Current week key (YYYY-Www format)
 */
export const weekKey = computed(() => {
  return missionsData.value?.weekKey ?? '';
});

/**
 * Time until weekly reset
 */
export const timeUntilReset = computed(() => {
  return missionsData.value?.timeUntilReset ?? { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
});

/**
 * Missions sorted by completion status (unclaimed first, then in-progress, then claimed)
 */
export const sortedMissions = computed(() => {
  const m = [...missions.value];
  return m.sort((a, b) => {
    // Completed but unclaimed first (priority)
    if (a.completed && !a.claimed && !(b.completed && !b.claimed)) return -1;
    if (b.completed && !b.claimed && !(a.completed && !a.claimed)) return 1;
    // In-progress second
    if (!a.completed && !b.completed) {
      return b.progressPercent - a.progressPercent; // Higher progress first
    }
    // Claimed last
    if (a.claimed && !b.claimed) return 1;
    if (b.claimed && !a.claimed) return -1;
    return 0;
  });
});

/**
 * Missions grouped by difficulty
 */
export const missionsByDifficulty = computed(() => {
  const result: { easy: MissionProgress[]; medium: MissionProgress[]; hard: MissionProgress[] } = {
    easy: [],
    medium: [],
    hard: [],
  };

  for (const mission of missions.value) {
    result[mission.definition.difficulty].push(mission);
  }

  return result;
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Fetch weekly missions from server
 */
export async function fetchMissions(): Promise<void> {
  missionsLoading.value = true;
  missionsError.value = null;

  try {
    const response = await getWeeklyMissions();
    missionsData.value = response;
  } catch (error) {
    missionsError.value = error instanceof Error ? error.message : 'Failed to fetch missions';
    missionsData.value = null;
  } finally {
    missionsLoading.value = false;
  }
}

/**
 * Claim a single mission reward
 */
export async function claimMissionReward(missionId: string): Promise<boolean> {
  if (claimingMission.value || claimingAll.value) return false;

  claimingMission.value = missionId;
  missionsError.value = null;

  try {
    const response = await apiClaimMissionReward(missionId);

    if (!response.success) {
      missionsError.value = response.error || 'Failed to claim reward';
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

    // Refresh missions data
    await fetchMissions();

    return true;
  } catch (error) {
    missionsError.value = error instanceof Error ? error.message : 'Failed to claim reward';
    return false;
  } finally {
    claimingMission.value = null;
  }
}

/**
 * Claim all completed but unclaimed mission rewards
 */
export async function claimAllMissions(): Promise<boolean> {
  if (claimingMission.value || claimingAll.value) return false;
  if (unclaimedCount.value === 0) return false;

  claimingAll.value = true;
  missionsError.value = null;

  try {
    const response = await apiClaimAllMissionRewards();

    if (!response.success) {
      missionsError.value = 'Failed to claim rewards';
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

    // Refresh missions data
    await fetchMissions();

    return true;
  } catch (error) {
    missionsError.value = error instanceof Error ? error.message : 'Failed to claim rewards';
    return false;
  } finally {
    claimingAll.value = false;
  }
}

/**
 * Show missions modal (and fetch data)
 */
export async function showMissionsModal(): Promise<void> {
  missionsModalVisible.value = true;
  await fetchMissions();
}

/**
 * Hide missions modal
 */
export function hideMissionsModal(): void {
  missionsModalVisible.value = false;
}

/**
 * Reset all missions state (on logout)
 */
export function resetMissionsState(): void {
  missionsData.value = null;
  missionsLoading.value = false;
  missionsError.value = null;
  missionsModalVisible.value = false;
  claimingMission.value = null;
  claimingAll.value = false;
}

/**
 * Format time until reset as a readable string
 */
export function formatTimeUntilReset(): string {
  const time = timeUntilReset.value;
  if (time.totalSeconds <= 0) return 'Resetting...';

  const parts: string[] = [];
  if (time.hours > 0) {
    parts.push(`${time.hours}h`);
  }
  if (time.minutes > 0 || time.hours > 0) {
    parts.push(`${time.minutes}m`);
  }
  if (time.hours === 0) {
    parts.push(`${time.seconds}s`);
  }

  return parts.join(' ');
}

/**
 * Check if a mission is claimable (completed but not claimed)
 */
export function isMissionClaimable(mission: MissionProgress): boolean {
  return mission.completed && !mission.claimed;
}

/**
 * Get progress display text for a mission
 */
export function getMissionProgressText(mission: MissionProgress): string {
  return `${mission.currentProgress.toLocaleString()} / ${mission.targetValue.toLocaleString()}`;
}
