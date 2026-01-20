import { signal } from '@preact/signals';
import type { FortressLevelReward, WaveStats } from '@arcade/sim-core';

/**
 * Leaderboard entry type.
 */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  score: number;
}

/**
 * Game state for end screen display.
 */
export interface GameEndState {
  wavesCleared: number;
  kills: number;
  eliteKills: number;
  goldEarned: number;
  dustEarned: number;
  relics: string[];
  sessionXpEarned: number;
}

export interface AnalyticsSnapshot {
  endedAt: number;
  tickHz: number;
  waves: WaveStats[];
}

// Toast state
export interface ToastData {
  gold: number;
  dust: number;
  xp: number;
}

export const toastMessage = signal<ToastData | null>(null);

// Sync status
export type SyncStatus = 'online' | 'offline' | 'syncing';
export const syncStatus = signal<SyncStatus>('online');

// Choice modal
export const showChoiceModal = signal(false);
export const choiceOptions = signal<string[]>([]);

// End screen
export const showEndScreen = signal(false);
export const endScreenWon = signal(false);
export const endGameStats = signal<GameEndState | null>(null);

// Statistics dashboard
export const showStatisticsDashboard = signal(false);
export const lastSessionAnalytics = signal<AnalyticsSnapshot | null>(null);

export function openStatisticsDashboard(): void {
  showStatisticsDashboard.value = true;
}

export function closeStatisticsDashboard(): void {
  showStatisticsDashboard.value = false;
}

// Leaderboard
export const leaderboardEntries = signal<LeaderboardEntry[]>([]);
export const leaderboardLoading = signal(false);
export const leaderboardError = signal(false);

// Session recovery modal
export const showSessionRecoveryModal = signal(false);
export const pendingSessionSnapshot = signal<{
  sessionId: string;
  savedAt: number;
  fortressClass: string;
} | null>(null);

// End session confirmation modal
export const showEndSessionConfirm = signal(false);

// Settings menu
export const settingsMenuVisible = signal(false);

export function openSettingsMenu(): void {
  settingsMenuVisible.value = true;
}

export function closeSettingsMenu(): void {
  settingsMenuVisible.value = false;
}

// Build presets modal
export const buildPresetsModalVisible = signal(false);

export function openBuildPresetsModal(): void {
  buildPresetsModalVisible.value = true;
}

export function closeBuildPresetsModal(): void {
  buildPresetsModalVisible.value = false;
}

// Error toast
export interface ErrorToastData {
  message: string;
  type: 'error' | 'warning' | 'info';
  id: number;
}

export const errorToasts = signal<ErrorToastData[]>([]);

let errorToastId = 0;

export function showErrorToast(message: string, type: 'error' | 'warning' | 'info' = 'error'): void {
  const id = ++errorToastId;
  errorToasts.value = [...errorToasts.value, { message, type, id }];

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    dismissErrorToast(id);
  }, 5000);
}

export function dismissErrorToast(id: number): void {
  errorToasts.value = errorToasts.value.filter((t) => t.id !== id);
}

// ============================================================================
// TARGETED FORTRESS SKILL
// ============================================================================

/**
 * Currently selected fortress skill for targeted activation.
 * When set, the next field click will activate this skill at that location.
 */
export const selectedTargetedSkill = signal<string | null>(null);

/**
 * Select a fortress skill for targeted activation
 */
export function selectSkillForTargeting(skillId: string): void {
  selectedTargetedSkill.value = skillId;
}

/**
 * Clear the selected targeted skill
 */
export function clearSelectedSkill(): void {
  selectedTargetedSkill.value = null;
}

// ============================================================================
// UNLOCK NOTIFICATIONS
// ============================================================================

export interface UnlockNotification {
  id: string;
  level: number;
  reward: FortressLevelReward;
}

export const unlockNotifications = signal<UnlockNotification[]>([]);

let unlockNotificationId = 0;

/**
 * Queue unlock notifications for display
 * @param level The level that was reached
 * @param rewards The rewards/unlocks from that level
 */
export function queueUnlockNotifications(level: number, rewards: FortressLevelReward[]): void {
  const newNotifications = rewards.map((reward) => ({
    id: `unlock-${++unlockNotificationId}`,
    level,
    reward,
  }));

  unlockNotifications.value = [...unlockNotifications.value, ...newNotifications];
}

/**
 * Dismiss a specific unlock notification
 */
export function dismissUnlockNotification(id: string): void {
  unlockNotifications.value = unlockNotifications.value.filter((n) => n.id !== id);
}

/**
 * Clear all unlock notifications
 */
export function clearUnlockNotifications(): void {
  unlockNotifications.value = [];
}

// ============================================================================
// PILLAR UNLOCK MODAL
// ============================================================================

export const pillarUnlockModalVisible = signal(false);

export function showPillarUnlockModal(): void {
  pillarUnlockModalVisible.value = true;
}

export function closePillarUnlockModal(): void {
  pillarUnlockModalVisible.value = false;
}

/**
 * Reset all UI state (on logout)
 */
export function resetUIState(): void {
  toastMessage.value = null;
  syncStatus.value = 'online';
  showChoiceModal.value = false;
  choiceOptions.value = [];
  showEndScreen.value = false;
  endScreenWon.value = false;
  endGameStats.value = null;
  showStatisticsDashboard.value = false;
  lastSessionAnalytics.value = null;
  leaderboardEntries.value = [];
  leaderboardLoading.value = false;
  leaderboardError.value = false;
  showSessionRecoveryModal.value = false;
  pendingSessionSnapshot.value = null;
  showEndSessionConfirm.value = false;
  settingsMenuVisible.value = false;
  buildPresetsModalVisible.value = false;
  errorToasts.value = [];
  unlockNotifications.value = [];
  pillarUnlockModalVisible.value = false;
}
