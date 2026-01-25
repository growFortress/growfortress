import { signal } from '@preact/signals';
import type { FortressLevelReward, WaveStats } from '@arcade/sim-core';
import { audioManager } from '../game/AudioManager.js';

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
export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ErrorToastData {
  message: string;
  type: ToastType;
  id: number;
}

export const errorToasts = signal<ErrorToastData[]>([]);

let errorToastId = 0;

export function showErrorToast(message: string, type: ToastType = 'error'): void {
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

/**
 * Show a success toast notification
 */
export function showSuccessToast(message: string): void {
  showErrorToast(message, 'success');
}

/**
 * Show a warning toast notification
 */
export function showWarningToast(message: string): void {
  showErrorToast(message, 'warning');
}

/**
 * Show an info toast notification
 */
export function showInfoToast(message: string): void {
  showErrorToast(message, 'info');
}

// ============================================================================
// SYNERGY ACTIVATION TOASTS
// ============================================================================

/**
 * Synergy toast data for showing synergy activation
 */
export interface SynergyToastData {
  id: string;
  name: string;
  bonuses: string[];
  type: 'pair' | 'trio';
  timestamp: number;
}

/**
 * Track shown synergies this session to avoid duplicate toasts
 */
export const shownSynergies = signal<Set<string>>(new Set());

/**
 * Active synergy toast (currently showing)
 */
export const activeSynergyToast = signal<SynergyToastData | null>(null);

/**
 * Queue of pending synergy toasts
 */
const synergyToastQueue: SynergyToastData[] = [];
let processingQueue = false;

/**
 * Show a synergy activation toast (only once per session per synergy)
 */
export function showSynergyToast(synergyId: string, name: string, bonuses: string[], type: 'pair' | 'trio'): void {
  // Check if already shown this session
  if (shownSynergies.value.has(synergyId)) {
    return;
  }

  // Mark as shown
  shownSynergies.value = new Set([...shownSynergies.value, synergyId]);

  // Add to queue
  synergyToastQueue.push({
    id: synergyId,
    name,
    bonuses,
    type,
    timestamp: Date.now(),
  });

  // Process queue
  processToastQueue();
}

/**
 * Process the synergy toast queue
 */
function processToastQueue(): void {
  if (processingQueue || synergyToastQueue.length === 0) {
    return;
  }

  processingQueue = true;
  const toast = synergyToastQueue.shift();

  if (toast) {
    activeSynergyToast.value = toast;

    // Play synergy sound
    audioManager.playSfx(toast.type === 'trio' ? 'synergy_trio' : 'synergy_unlocked');

    // Auto-dismiss after 3 seconds and process next
    setTimeout(() => {
      activeSynergyToast.value = null;
      processingQueue = false;
      processToastQueue();
    }, 3000);
  } else {
    processingQueue = false;
  }
}

/**
 * Reset shown synergies (call when starting a new game session)
 */
export function resetShownSynergies(): void {
  shownSynergies.value = new Set();
  activeSynergyToast.value = null;
  synergyToastQueue.length = 0;
  processingQueue = false;
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
// LEVEL-UP NOTIFICATIONS
// ============================================================================

export interface LevelUpNotification {
  id: string;
  level: number;
  goldReward: number;
  dustReward: number;
}

export const levelUpNotifications = signal<LevelUpNotification[]>([]);

let levelUpNotificationId = 0;

/**
 * Queue a level-up notification.
 */
export function queueLevelUpNotification(level: number, goldReward: number, dustReward: number): void {
  levelUpNotifications.value = [
    ...levelUpNotifications.value,
    {
      id: `level-up-${++levelUpNotificationId}`,
      level,
      goldReward,
      dustReward,
    },
  ];
}

/**
 * Dismiss a specific level-up notification.
 */
export function dismissLevelUpNotification(id: string): void {
  levelUpNotifications.value = levelUpNotifications.value.filter((n) => n.id !== id);
}

/**
 * Clear all level-up notifications.
 */
export function clearLevelUpNotifications(): void {
  levelUpNotifications.value = [];
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
  levelUpNotifications.value = [];
  pillarUnlockModalVisible.value = false;
}
