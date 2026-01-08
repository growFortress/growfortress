import { signal } from '@preact/signals';
import type { FortressLevelReward } from '@arcade/sim-core';

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
