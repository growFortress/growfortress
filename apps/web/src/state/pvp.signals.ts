import { signal, computed } from '@preact/signals';
import type {
  PvpChallenge,
  PvpOpponent,
  PvpResult,
  PvpChallengeStatus,
} from '@arcade/protocol';
import type { ArenaBuildConfig } from '@arcade/sim-core';

// ============================================================================
// TYPES
// ============================================================================

export interface PvpBattleData {
  seed: number;
  challengerBuild: ArenaBuildConfig;
  challengedBuild: ArenaBuildConfig;
}

// ============================================================================
// USER STATS
// ============================================================================

/** User's total PvP wins */
export const pvpWins = signal(0);

/** User's total PvP losses */
export const pvpLosses = signal(0);

/** User's win rate percentage */
export const pvpWinRate = computed(() => {
  const total = pvpWins.value + pvpLosses.value;
  if (total === 0) return 0;
  return Math.round((pvpWins.value / total) * 100 * 10) / 10;
});

/** User's total battles */
export const pvpTotalBattles = computed(() => pvpWins.value + pvpLosses.value);

/** Number of pending challenges received */
export const pvpPendingChallenges = signal(0);

/** User's current power */
export const userPower = signal(0);

// ============================================================================
// OPPONENTS STATE
// ============================================================================

/** List of available opponents */
export const pvpOpponents = signal<PvpOpponent[]>([]);

/** Total number of opponents */
export const pvpOpponentsTotal = signal(0);

/** Loading state for opponents */
export const pvpOpponentsLoading = signal(false);

/** Error state for opponents */
export const pvpOpponentsError = signal<string | null>(null);

// ============================================================================
// CHALLENGES STATE
// ============================================================================

/** Sent challenges */
export const pvpSentChallenges = signal<PvpChallenge[]>([]);

/** Received challenges */
export const pvpReceivedChallenges = signal<PvpChallenge[]>([]);

/** All challenges */
export const pvpAllChallenges = computed(() => [
  ...pvpSentChallenges.value,
  ...pvpReceivedChallenges.value,
].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

/** Pending received challenges */
export const pvpPendingReceivedChallenges = computed(() =>
  pvpReceivedChallenges.value.filter(c => c.status === 'PENDING')
);

/** Loading state for challenges */
export const pvpChallengesLoading = signal(false);

/** Error state for challenges */
export const pvpChallengesError = signal<string | null>(null);

// ============================================================================
// CURRENT CHALLENGE/BATTLE STATE
// ============================================================================

/** Currently selected challenge */
export const pvpSelectedChallenge = signal<PvpChallenge | null>(null);

/** Current battle data (for visualization) */
export const pvpBattleData = signal<PvpBattleData | null>(null);

/** Current battle result */
export const pvpBattleResult = signal<PvpResult | null>(null);

/** Battle is in progress (showing animation) */
export const pvpBattleInProgress = signal(false);

/** Loading state for accepting challenge */
export const pvpAcceptingChallenge = signal(false);

// ============================================================================
// UI STATE
// ============================================================================

/** Show PvP main panel */
export const showPvpPanel = signal(false);

/** Current PvP tab ('opponents' | 'challenges' | 'history') */
export const pvpActiveTab = signal<'opponents' | 'challenges' | 'history'>('opponents');

/** Show challenge confirmation modal */
export const showChallengeConfirm = signal(false);

/** Opponent to challenge (for confirmation) */
export const pvpChallengeTarget = signal<PvpOpponent | null>(null);

/** Show battle result modal */
export const showPvpResultModal = signal(false);

/** Show replay viewer */
export const showPvpReplay = signal(false);

/** General PvP loading state */
export const pvpLoading = signal(false);

/** General PvP error state */
export const pvpError = signal<string | null>(null);

// ============================================================================
// ACTIONS
// ============================================================================

/** Reset all PvP state */
export function resetPvpState(): void {
  pvpWins.value = 0;
  pvpLosses.value = 0;
  pvpPendingChallenges.value = 0;
  userPower.value = 0;

  pvpOpponents.value = [];
  pvpOpponentsTotal.value = 0;
  pvpOpponentsLoading.value = false;
  pvpOpponentsError.value = null;

  pvpSentChallenges.value = [];
  pvpReceivedChallenges.value = [];
  pvpChallengesLoading.value = false;
  pvpChallengesError.value = null;

  pvpSelectedChallenge.value = null;
  pvpBattleData.value = null;
  pvpBattleResult.value = null;
  pvpBattleInProgress.value = false;
  pvpAcceptingChallenge.value = false;

  showPvpPanel.value = false;
  pvpActiveTab.value = 'opponents';
  showChallengeConfirm.value = false;
  pvpChallengeTarget.value = null;
  showPvpResultModal.value = false;
  showPvpReplay.value = false;
  pvpLoading.value = false;
  pvpError.value = null;
}

/** Update user stats */
export function updatePvpStats(
  wins: number,
  losses: number,
  pendingChallenges: number,
  power: number
): void {
  pvpWins.value = wins;
  pvpLosses.value = losses;
  pvpPendingChallenges.value = pendingChallenges;
  userPower.value = power;
}

/** Set opponents list */
export function setPvpOpponents(opponents: PvpOpponent[], total: number): void {
  pvpOpponents.value = opponents;
  pvpOpponentsTotal.value = total;
  pvpOpponentsError.value = null;
}

/** Set challenges */
export function setPvpChallenges(
  sent: PvpChallenge[],
  received: PvpChallenge[]
): void {
  pvpSentChallenges.value = sent;
  pvpReceivedChallenges.value = received;
  pvpChallengesError.value = null;
}

/** Add a new sent challenge */
export function addSentChallenge(challenge: PvpChallenge): void {
  pvpSentChallenges.value = [challenge, ...pvpSentChallenges.value];
}

/** Update challenge status */
export function updateChallengeStatus(
  challengeId: string,
  status: PvpChallengeStatus,
  winnerId?: string
): void {
  // Update in sent challenges
  pvpSentChallenges.value = pvpSentChallenges.value.map(c =>
    c.id === challengeId ? { ...c, status, winnerId } : c
  );

  // Update in received challenges
  pvpReceivedChallenges.value = pvpReceivedChallenges.value.map(c =>
    c.id === challengeId ? { ...c, status, winnerId } : c
  );
}

/** Set battle data for visualization */
export function setPvpBattleData(
  seed: number,
  challengerBuild: ArenaBuildConfig,
  challengedBuild: ArenaBuildConfig
): void {
  pvpBattleData.value = { seed, challengerBuild, challengedBuild };
}

/** Set battle result */
export function setPvpBattleResult(result: PvpResult): void {
  pvpBattleResult.value = result;
}

/** Start challenge confirmation flow */
export function confirmChallenge(opponent: PvpOpponent): void {
  pvpChallengeTarget.value = opponent;
  showChallengeConfirm.value = true;
}

/** Cancel challenge confirmation */
export function cancelChallengeConfirm(): void {
  pvpChallengeTarget.value = null;
  showChallengeConfirm.value = false;
}

/** Open PvP panel */
export function openPvpPanel(): void {
  showPvpPanel.value = true;
}

/** Close PvP panel */
export function closePvpPanel(): void {
  showPvpPanel.value = false;
}

/** Set active tab */
export function setActivePvpTab(tab: 'opponents' | 'challenges' | 'history'): void {
  pvpActiveTab.value = tab;
}

/** Show battle result */
export function showBattleResult(challenge: PvpChallenge, result: PvpResult): void {
  pvpSelectedChallenge.value = challenge;
  pvpBattleResult.value = result;
  showPvpResultModal.value = true;
}

/** Hide battle result */
export function hideBattleResult(): void {
  showPvpResultModal.value = false;
  pvpBattleResult.value = null;
  pvpSelectedChallenge.value = null;
}

/** Show replay viewer */
export function openReplayViewer(challenge: PvpChallenge): void {
  pvpSelectedChallenge.value = challenge;
  showPvpReplay.value = true;
}

/** Hide replay viewer */
export function closeReplayViewer(): void {
  showPvpReplay.value = false;
  pvpBattleData.value = null;
}

/** Format power number for display */
export function formatPower(power: number): string {
  if (power >= 1_000_000) {
    return `${(power / 1_000_000).toFixed(1)}M`;
  }
  if (power >= 1_000) {
    return `${(power / 1_000).toFixed(1)}K`;
  }
  return power.toString();
}

/** Get status display text */
export function getStatusText(status: PvpChallengeStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'ACCEPTED':
      return 'Accepted';
    case 'RESOLVED':
      return 'Resolved';
    case 'DECLINED':
      return 'Declined';
    case 'EXPIRED':
      return 'Expired';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return status;
  }
}

/** Get status color class */
export function getStatusColor(status: PvpChallengeStatus): string {
  switch (status) {
    case 'PENDING':
      return 'text-yellow-400';
    case 'ACCEPTED':
      return 'text-blue-400';
    case 'RESOLVED':
      return 'text-green-400';
    case 'DECLINED':
      return 'text-red-400';
    case 'EXPIRED':
      return 'text-gray-400';
    case 'CANCELLED':
      return 'text-gray-400';
    default:
      return 'text-gray-400';
  }
}
