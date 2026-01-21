import { useState } from 'preact/hooks';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import {
  pvpSentChallenges,
  pvpReceivedChallenges,
  pvpChallengesLoading,
  pvpChallengesError,
  pvpAcceptingChallenge,
  updateChallengeStatus,
  showBattleResult,
  openReplayViewer,
  showErrorToast,
  getStatusText,
  getStatusColor,
  formatPower,
} from '../../state/index.js';
import {
  acceptChallenge,
  declineChallenge,
  cancelChallenge,
  getChallenge,
  PvpApiError,
} from '../../api/pvp.js';
import type { PvpChallenge } from '@arcade/protocol';
import { OnlineStatusIndicator } from '../shared/OnlineStatusIndicator.js';
import styles from './PvpPanel.module.css';

interface ChallengesListProps {
  filter: 'pending' | 'resolved';
  onRefresh: () => Promise<void>;
}

export function ChallengesList({ filter, onRefresh }: ChallengesListProps) {
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Get challenges based on filter
  const allChallenges = [
    ...pvpSentChallenges.value.map(c => ({ ...c, type: 'sent' as const })),
    ...pvpReceivedChallenges.value.map(c => ({ ...c, type: 'received' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredChallenges = filter === 'pending'
    ? allChallenges.filter(c => c.status === 'PENDING')
    : allChallenges.filter(c => c.status !== 'PENDING');

  const handleAccept = async (challenge: PvpChallenge) => {
    if (processingId) return;

    setProcessingId(challenge.id);
    pvpAcceptingChallenge.value = true;

    try {
      const response = await acceptChallenge(challenge.id);
      updateChallengeStatus(challenge.id, 'RESOLVED', response.challenge.winnerId);

      // Show battle result
      showBattleResult(
        { ...challenge, status: 'RESOLVED', winnerId: response.challenge.winnerId },
        {
          id: challenge.id,
          challengeId: challenge.id,
          winnerId: response.result.winnerId,
          winReason: response.result.winReason as 'fortress_destroyed' | 'timeout' | 'draw',
          challengerStats: response.result.challengerStats,
          challengedStats: response.result.challengedStats,
          duration: response.result.duration,
          resolvedAt: new Date().toISOString(),
        }
      );

      await onRefresh();
    } catch (error) {
      if (error instanceof PvpApiError) {
        showErrorToast(error.message);
      } else {
        showErrorToast('Nie udało się zaakceptować wyzwania');
      }
    } finally {
      setProcessingId(null);
      pvpAcceptingChallenge.value = false;
    }
  };

  const handleDecline = async (challenge: PvpChallenge) => {
    if (processingId) return;

    setProcessingId(challenge.id);
    try {
      await declineChallenge(challenge.id);
      updateChallengeStatus(challenge.id, 'DECLINED');
      await onRefresh();
    } catch (error) {
      showErrorToast('Nie udało się odrzucić wyzwania');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (challenge: PvpChallenge) => {
    if (processingId) return;

    setProcessingId(challenge.id);
    try {
      await cancelChallenge(challenge.id);
      updateChallengeStatus(challenge.id, 'CANCELLED');
      await onRefresh();
    } catch (error) {
      showErrorToast('Nie udało się anulować wyzwania');
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewResult = async (challenge: PvpChallenge & { type: 'sent' | 'received' }) => {
    try {
      const fullChallenge = await getChallenge(challenge.id);
      if (fullChallenge && fullChallenge.result) {
        showBattleResult(challenge, fullChallenge.result);
      }
    } catch (error) {
      showErrorToast('Nie udało się załadować wyniku');
    }
  };

  if (pvpChallengesLoading.value) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (pvpChallengesError.value) {
    return (
      <div class={styles.error}>
        {pvpChallengesError.value}
      </div>
    );
  }

  if (filteredChallenges.length === 0) {
    return (
      <div class={styles.emptyState}>
        <div class={styles.emptyIcon}>
          {filter === 'pending' ? '📭' : '📜'}
        </div>
        <div class={styles.emptyText}>
          {filter === 'pending'
            ? 'Brak oczekujących wyzwań'
            : 'Brak historii walk'}
        </div>
      </div>
    );
  }

  return (
    <div class={styles.list}>
      {filteredChallenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          processingId={processingId}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onViewResult={handleViewResult}
        />
      ))}
    </div>
  );
}

interface ChallengeCardProps {
  challenge: PvpChallenge & { type: 'sent' | 'received' };
  processingId: string | null;
  onAccept: (c: PvpChallenge) => Promise<void>;
  onDecline: (c: PvpChallenge) => Promise<void>;
  onCancel: (c: PvpChallenge) => Promise<void>;
  onViewResult: (c: PvpChallenge & { type: 'sent' | 'received' }) => Promise<void>;
}

function ChallengeCard({
  challenge,
  processingId,
  onAccept,
  onDecline,
  onCancel,
  onViewResult,
}: ChallengeCardProps) {
  const isProcessing = processingId === challenge.id;
  const isSent = challenge.type === 'sent';
  const isPending = challenge.status === 'PENDING';
  const isResolved = challenge.status === 'RESOLVED';

  // Determine if user won/lost
  const userId = isSent ? challenge.challengerId : challenge.challengedId;
  const isWinner = challenge.winnerId === userId;
  const isDraw = isResolved && !challenge.winnerId;

  return (
    <div class={styles.challengeCard}>
      <div class={styles.challengeHeader}>
        <div class={styles.challengePlayers}>
          <span>
            {challenge.challengerName}
            <OnlineStatusIndicator isOnline={challenge.challengerIsOnline} />
          </span>
          <span class={styles.challengeVs}>vs</span>
          <span>
            {challenge.challengedName}
            <OnlineStatusIndicator isOnline={challenge.challengedIsOnline} />
          </span>
        </div>
        {isResolved ? (
          <span class={`${styles.resultBadge} ${
            isDraw ? styles.resultDraw :
            isWinner ? styles.resultWin : styles.resultLoss
          }`}>
            {isDraw ? '🤝 Remis' : isWinner ? '🏆 Wygrana' : '💀 Przegrana'}
          </span>
        ) : (
          <span class={`${styles.challengeStatus} ${getStatusColor(challenge.status)}`}>
            {getStatusText(challenge.status)}
          </span>
        )}
      </div>

      <div class={styles.listItemMeta}>
        <span class={styles.listItemPower}>
          💪 {formatPower(challenge.challengerPower)} vs {formatPower(challenge.challengedPower)}
        </span>
        <span class={styles.challengeTime}>
          {formatTimeAgo(challenge.createdAt)}
        </span>
      </div>

      {isPending && (
        <div class={styles.challengeActions}>
          {isSent ? (
            <Button
              variant="secondary"
                            onClick={() => onCancel(challenge)}
              disabled={isProcessing}
            >
              Anuluj
            </Button>
          ) : (
            <>
              <Button
                variant="skill"
                                onClick={() => onAccept(challenge)}
                disabled={isProcessing}
              >
                {isProcessing ? <Spinner size="sm" /> : '✓ Akceptuj'}
              </Button>
              <Button
                variant="secondary"
                                onClick={() => onDecline(challenge)}
                disabled={isProcessing}
              >
                ✗ Odrzuć
              </Button>
            </>
          )}
        </div>
      )}

      {isResolved && (
        <div class={styles.challengeActions}>
          <Button
            variant="secondary"
                        onClick={() => onViewResult(challenge)}
          >
            📊 Szczegóły
          </Button>
          <Button
            variant="secondary"
                        onClick={() => openReplayViewer(challenge)}
          >
            🎬 Replay
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Teraz';
  if (diffMins < 60) return `${diffMins}m temu`;
  if (diffHours < 24) return `${diffHours}h temu`;
  if (diffDays < 7) return `${diffDays}d temu`;

  return date.toLocaleDateString('pl-PL');
}
