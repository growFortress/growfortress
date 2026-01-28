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
  openReplayViewer,
  showErrorToast,
  getStatusText,
  getStatusColor,
  formatPower,
  showBattleResult,
  addSentChallenge,
  addReceivedChallenge,
} from '../../state/index.js';
import {
  declineChallenge,
  cancelChallenge,
  getChallenge,
  resolveChallenge,
  PvpApiError,
} from '../../api/pvp.js';
import { getUserId } from '../../api/auth.js';
import type { PvpChallenge, PvpChallengeWithResult, PvpResolveRequest } from '@arcade/protocol';
import { ArenaSimulation, type ArenaBuildConfig } from '@arcade/sim-core';
import { OnlineStatusIndicator } from '../shared/OnlineStatusIndicator.js';
import { getArtifactById } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './PvpPanel.module.css';

interface ChallengesListProps {
  filter: 'pending' | 'resolved';
  onRefresh: () => Promise<void>;
}

export function ChallengesList({ filter, onRefresh }: ChallengesListProps) {
  const { t, language } = useTranslation('game');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, PvpChallengeWithResult>>({});
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);

  // Get challenges based on filter
  const allChallenges = [
    ...pvpSentChallenges.value.map(c => ({ ...c, type: 'sent' as const })),
    ...pvpReceivedChallenges.value.map(c => ({ ...c, type: 'received' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filteredChallenges = filter === 'pending'
    ? allChallenges.filter(c => c.status === 'PENDING')
    : allChallenges.filter(c => c.status !== 'PENDING');

  const handlePlay = async (challenge: PvpChallenge) => {
    if (processingId) return;

    setProcessingId(challenge.id);
    pvpAcceptingChallenge.value = true;

    try {
      const fullChallenge = await getChallenge(challenge.id);
      if (!fullChallenge?.battleData) {
        showErrorToast(t('pvp.errors.prepareFailed'));
        return;
      }

      const { seed, challengerBuild, challengedBuild } = fullChallenge.battleData;

      // Run simulation instantly without animation
      const sim = new ArenaSimulation(
        seed as number,
        challengerBuild as ArenaBuildConfig,
        challengedBuild as ArenaBuildConfig
      );
      const simResult = sim.run();

      // Build client result for server verification
      const winnerId =
        simResult.winner === 'left'
          ? fullChallenge.challengerId
          : simResult.winner === 'right'
            ? fullChallenge.challengedId
            : null;

      const clientResult: PvpResolveRequest['result'] = {
        winnerId,
        winReason: simResult.winReason,
        challengerStats: {
          finalHp: simResult.leftStats.finalHp,
          damageDealt: simResult.leftStats.damageDealt,
          heroesAlive: simResult.leftStats.heroesAlive,
        },
        challengedStats: {
          finalHp: simResult.rightStats.finalHp,
          damageDealt: simResult.rightStats.damageDealt,
          heroesAlive: simResult.rightStats.heroesAlive,
        },
        duration: simResult.duration,
      };

      // Send result to server
      const response = await resolveChallenge(fullChallenge.id, clientResult);

      // Update challenge in state
      const resolvedChallenge = {
        ...fullChallenge,
        status: 'RESOLVED' as const,
        winnerId: response.result.winnerId ?? undefined,
        resolvedAt: response.result.resolvedAt,
      };

      const currentUserId = getUserId();
      if (currentUserId && currentUserId === fullChallenge.challengedId) {
        addReceivedChallenge(resolvedChallenge);
      } else {
        addSentChallenge(resolvedChallenge);
      }

      // Show result modal directly using the server response
      showBattleResult(resolvedChallenge, response.result, response.rewards);

      await onRefresh();
    } catch (error) {
      if (error instanceof PvpApiError) {
        showErrorToast(error.message);
      } else {
        showErrorToast(t('pvp.errors.startFailed'));
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
      showErrorToast(t('pvp.errors.declineFailed'));
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
      showErrorToast(t('pvp.errors.cancelFailed'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewResult = async (challenge: PvpChallenge & { type: 'sent' | 'received' }) => {
    if (expandedId === challenge.id) {
      setExpandedId(null);
      return;
    }

    const existing = detailsById[challenge.id];
    if (existing?.result) {
      setExpandedId(challenge.id);
      return;
    }

    setDetailsLoadingId(challenge.id);
    try {
      const fullChallenge = await getChallenge(challenge.id);
      if (fullChallenge?.result) {
        setDetailsById((prev) => ({ ...prev, [challenge.id]: fullChallenge }));
        setExpandedId(challenge.id);
      } else {
        showErrorToast(t('pvp.errors.loadResultFailed'));
      }
    } catch (error) {
      showErrorToast(t('pvp.errors.loadResultFailed'));
    } finally {
      setDetailsLoadingId(null);
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
          {filter === 'pending' ? '⚔️' : '📜'}
        </div>
        <div class={styles.emptyText}>
          {filter === 'pending'
            ? t('pvp.challenges.emptyPending')
            : t('pvp.challenges.emptyHistory')}
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
          details={detailsById[challenge.id]}
          isExpanded={expandedId === challenge.id}
          detailsLoading={detailsLoadingId === challenge.id}
          onPlay={handlePlay}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onViewResult={handleViewResult}
          t={t}
          language={language}
        />
      ))}
    </div>
  );
}

interface ChallengeCardProps {
  challenge: PvpChallenge & { type: 'sent' | 'received' };
  processingId: string | null;
  details?: PvpChallengeWithResult;
  isExpanded: boolean;
  detailsLoading: boolean;
  onPlay: (c: PvpChallenge) => Promise<void>;
  onDecline: (c: PvpChallenge) => Promise<void>;
  onCancel: (c: PvpChallenge) => Promise<void>;
  onViewResult: (c: PvpChallenge & { type: 'sent' | 'received' }) => Promise<void>;
  t: (key: string, params?: Record<string, unknown>) => string;
  language: string;
}

function ChallengeCard({
  challenge,
  processingId,
  details,
  isExpanded,
  detailsLoading,
  onPlay,
  onDecline,
  onCancel,
  onViewResult,
  t,
  language,
}: ChallengeCardProps) {
  const isProcessing = processingId === challenge.id;
  const isSent = challenge.type === 'sent';
  const isPending = challenge.status === 'PENDING';
  const isResolved = challenge.status === 'RESOLVED';

  // Determine if user won/lost
  const userId = isSent ? challenge.challengerId : challenge.challengedId;
  const isWinner = challenge.winnerId === userId;
  const isDraw = isResolved && !challenge.winnerId;
  const detailResult = details?.result;
  const rewardData = details?.rewards;
  const rewardArtifact = rewardData?.artifactId
    ? getArtifactById(rewardData.artifactId)
    : null;
  const rewardArtifactName =
    rewardArtifact?.polishName ?? rewardArtifact?.name ?? rewardData?.artifactId;
  const actionText = isSent
    ? t('pvp.challenges.youAttacked', { name: challenge.challengedName })
    : t('pvp.challenges.youWereAttacked', { name: challenge.challengerName });
  const winReasonText = detailResult ? getWinReasonText(detailResult.winReason, t) : '';
  const durationText = detailResult ? formatDuration(detailResult.duration) : '';
  const rewardsText = rewardData
    ? [
        rewardData.gold ? `Gold +${rewardData.gold}` : null,
        rewardData.dust ? `Dust +${rewardData.dust}` : null,
        `Honor ${rewardData.honorChange >= 0 ? '+' : ''}${rewardData.honorChange}`,
        rewardArtifactName ? `Artifact ${rewardArtifactName}` : null,
      ].filter(Boolean).join(', ')
    : t('pvp.challenges.noData');

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
            {isDraw ? `🤝 ${t('pvp.result.drawBadge')}` : isWinner ? `🏆 ${t('pvp.result.winBadge')}` : `💀 ${t('pvp.result.lossBadge')}`}
          </span>
        ) : (
          <span class={`${styles.challengeStatus} ${getStatusColor(challenge.status)}`}>
            {getStatusText(challenge.status)}
          </span>
        )}
      </div>

      <div class={styles.listItemMeta}>
        <span class={styles.listItemPower}>
          ⚡ {formatPower(challenge.challengerPower)} vs {formatPower(challenge.challengedPower)}
        </span>
        <span class={styles.challengeTime}>
          {formatTimeAgo(challenge.createdAt, t, language)}
        </span>
      </div>

      {isPending && (
        <div class={styles.challengeActions}>
          {isSent ? (
            <>
              <Button
                variant="skill"
                onClick={() => onPlay(challenge)}
                disabled={isProcessing}
                loading={isProcessing}
              >
                {t('pvp.challenges.play')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onCancel(challenge)}
                disabled={isProcessing}
              >
                {t('pvp.challenges.cancel')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="skill"
                onClick={() => onPlay(challenge)}
                disabled={isProcessing}
                loading={isProcessing}
              >
                {t('pvp.challenges.play')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => onDecline(challenge)}
                disabled={isProcessing}
              >
                {t('pvp.challenges.decline')}
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
            disabled={detailsLoading}
            loading={detailsLoading}
          >
            {isExpanded ? t('pvp.challenges.hideDetails') : t('pvp.challenges.showDetails')}
          </Button>
          <Button
            variant="skill"
            onClick={() => openReplayViewer(challenge)}
          >
            {t('pvp.challenges.replay')}
          </Button>
        </div>
      )}

      {isResolved && isExpanded && (
        <div class={styles.listItemInfo}>
          <div class={styles.listItemName}>{actionText}</div>
          <div class={styles.listItemMeta}>
            {winReasonText && <span>{winReasonText}</span>}
            {durationText && <span>{durationText}</span>}
          </div>
          {detailResult ? (
            <div class={styles.listItemMeta}>
              <span>
                {challenge.challengerName}: HP {detailResult.challengerStats.finalHp} | DMG {detailResult.challengerStats.damageDealt.toLocaleString()} | Heroes {detailResult.challengerStats.heroesAlive}
              </span>
              <span>
                {challenge.challengedName}: HP {detailResult.challengedStats.finalHp} | DMG {detailResult.challengedStats.damageDealt.toLocaleString()} | Heroes {detailResult.challengedStats.heroesAlive}
              </span>
            </div>
          ) : (
            <div class={styles.listItemMeta}>
              <span>{t('pvp.challenges.noBattleDetails')}</span>
            </div>
          )}
          <div class={styles.listItemMeta}>
            <span>{t('pvp.challenges.rewards')}: {rewardsText}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function getWinReasonText(reason: string, t: (key: string) => string): string {
  switch (reason) {
    case 'fortress_destroyed':
      return t('pvp.winReason.fortressDestroyed');
    case 'timeout':
      return t('pvp.winReason.timeout');
    case 'draw':
      return t('pvp.winReason.draw');
    default:
      return reason;
  }
}

function formatDuration(durationTicks: number): string {
  const totalSeconds = Math.floor(durationTicks / 30);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimeAgo(isoDate: string, t: (key: string, params?: Record<string, unknown>) => string, locale: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return t('pvp.time.now');
  if (diffMins < 60) return t('pvp.time.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('pvp.time.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('pvp.time.daysAgo', { count: diffDays });

  return date.toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-US');
}
