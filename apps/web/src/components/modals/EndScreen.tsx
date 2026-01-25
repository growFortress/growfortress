import { useEffect, useState } from 'preact/hooks';
import {
  showEndScreen,
  endScreenWon,
  endGameStats,
  hideEndScreen,
  isAuthenticated,
  getUserRankForCategory,
  isGuestMode,
  guestAutoTransitionCountdown,
  promptGuestRegistration,
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import { Modal } from '../shared/Modal.js';
import { fetchUserRanks } from '../../api/leaderboard.js';
import { DustIcon, GoldIcon } from '../icons/index.js';
import styles from './EndScreen.module.css';

interface EndScreenProps {
  onPlayAgain: () => Promise<void>;
  onReturnToHub: () => void;
}

export function EndScreen({ onPlayAgain, onReturnToHub }: EndScreenProps) {
  const { t } = useTranslation('game');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const won = endScreenWon.value;
  const stats = endGameStats.value;
  const xpEarned = stats?.sessionXpEarned ?? 0;

  // Fetch user rankings when screen is shown and user is authenticated
  useEffect(() => {
    if (showEndScreen.value && isAuthenticated.value) {
      setRankingLoading(true);
      setRankingError(null);
      fetchUserRanks()
        .catch((err) => {
          console.error('Failed to fetch user ranks:', err);
          setRankingError(err.message || 'Failed to load ranking');
        })
        .finally(() => {
          setRankingLoading(false);
        });
    }
  }, [showEndScreen.value, isAuthenticated.value]);

  // Auto-transition to hub for guests with countdown
  useEffect(() => {
    if (showEndScreen.value && isGuestMode.value) {
      // Start countdown from 5 seconds
      guestAutoTransitionCountdown.value = 5;

      const countdownInterval = setInterval(() => {
        if (guestAutoTransitionCountdown.value !== null && guestAutoTransitionCountdown.value > 0) {
          guestAutoTransitionCountdown.value -= 1;
        }
      }, 1000);

      const transitionTimer = setTimeout(() => {
        hideEndScreen();
        onReturnToHub();
        // Show registration prompt after short delay
        setTimeout(() => {
          promptGuestRegistration();
        }, 500);
      }, 5000);

      return () => {
        clearInterval(countdownInterval);
        clearTimeout(transitionTimer);
        guestAutoTransitionCountdown.value = null;
      };
    }
    return undefined;
  }, [showEndScreen.value, isGuestMode.value, onReturnToHub]);

  const weeklyRank = getUserRankForCategory('weeklyWaves');
  const totalRank = getUserRankForCategory('totalWaves');

  const handlePlayAgain = async () => {
    hideEndScreen();
    await onPlayAgain();
  };

  const handleReturnToHub = () => {
    hideEndScreen();
    onReturnToHub();
  };

  return (
    <Modal
      visible={showEndScreen.value}
      size="medium"
      class={styles.modal}
      ariaLabel={won ? t('endScreen.victory') : t('endScreen.defeat')}
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      {/* Result Header */}
      <div class={styles.resultHeader}>
        {won && <span class={styles.resultIcon}>🏆</span>}
        {stats && (
          <>
            <h2 class={`${styles.waveTitle} ${won ? styles.victory : styles.defeat}`}>
              {t('endScreen.waveReached', { wave: stats.wavesCleared })}
            </h2>
            {won && (
              <p class={styles.motivationText}>{t('endScreen.victoryMessage')}</p>
            )}
            {!won && (
              <p class={styles.motivationText}>{t('endScreen.defeatMessage')}</p>
            )}
          </>
        )}
      </div>

      {/* Rankings Section */}
      {isAuthenticated.value && (
        <div class={styles.rankingsSection}>
          {rankingLoading ? (
            <div class={styles.rankingLoading}>{t('endScreen.loadingRank')}</div>
          ) : rankingError ? (
            <div class={styles.rankingError}>{t('endScreen.rankingError')}</div>
          ) : (
            <div class={styles.rankingsGrid}>
              {weeklyRank && (
                <div class={`${styles.rankingCard} ${styles.weeklyRank} ${weeklyRank.rank && weeklyRank.rank <= 10 ? styles.top10 : ''}`}>
                  <span class={styles.rankingIcon}>🏅</span>
                  <span class={styles.rankingLabel}>{t('endScreen.weeklyRank')}</span>
                  <span class={styles.rankingValue}>
                    {weeklyRank.rank ? `#${weeklyRank.rank}` : t('endScreen.noRank')}
                  </span>
                  {weeklyRank.rank && weeklyRank.rank <= 10 && (
                    <span class={styles.top10Badge}>{t('endScreen.top10')}</span>
                  )}
                </div>
              )}
              {totalRank && (
                <div class={`${styles.rankingCard} ${styles.totalRank}`}>
                  <span class={styles.rankingIcon}>⭐</span>
                  <span class={styles.rankingLabel}>{t('endScreen.totalRank')}</span>
                  <span class={styles.rankingValue}>
                    {totalRank.rank ? `#${totalRank.rank}` : t('endScreen.noRank')}
                  </span>
                </div>
              )}
              {!weeklyRank && !totalRank && !rankingLoading && !rankingError && (
                <div class={styles.noRankingMessage}>{t('endScreen.noRankingYet')}</div>
              )}
            </div>
          )}
        </div>
      )}

      {stats && (
        <>
          {/* Stats Grid */}
          <div class={styles.statsGrid}>
            <div class={styles.statCard}>
              <span class={styles.statIcon}>⚔️</span>
              <span class={styles.statLabel}>{t('endScreen.enemies')}</span>
              <span class={styles.statValue}>{stats.kills}</span>
            </div>
            <div class={styles.statCard}>
              <span class={styles.statIcon}>👹</span>
              <span class={styles.statLabel}>{t('endScreen.elites')}</span>
              <span class={styles.statValue}>{stats.eliteKills}</span>
            </div>
            <div class={styles.statCard}>
              <span class={styles.statIcon}>🔮</span>
              <span class={styles.statLabel}>{t('endScreen.relics')}</span>
              <span class={styles.statValue}>{stats.relics.length}</span>
            </div>
          </div>

          {/* Rewards Summary */}
          <div class={styles.rewardsSummary}>
            <div class={`${styles.rewardItem} ${styles.gold}`}>
              <GoldIcon size={20} className={styles.rewardIcon} />
              <span>+{stats.goldEarned}</span>
            </div>
            <div class={`${styles.rewardItem} ${styles.dust}`}>
              <DustIcon size={16} className={styles.rewardIcon} />
              <span>+{stats.dustEarned}</span>
            </div>
            <div class={`${styles.rewardItem} ${styles.xp}`}>
              <span class={styles.rewardIcon}>⭐</span>
              <span>+{xpEarned} XP</span>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <div class={styles.actions}>
        {isGuestMode.value && guestAutoTransitionCountdown.value !== null && (
          <div class={styles.guestCountdown}>
            {t('endScreen.autoTransition', { seconds: guestAutoTransitionCountdown.value })}
          </div>
        )}
        <Button variant="secondary" size="lg" onClick={handleReturnToHub}>
          {t('endScreen.returnToHub')}
        </Button>
        <Button variant="primary" size="lg" onClick={handlePlayAgain}>
          {t('endScreen.playAgain')}
        </Button>
      </div>
    </Modal>
  );
}
