import { useEffect, useState, useMemo } from 'preact/hooks';
import {
  showEndScreen,
  endGameStats,
  hideEndScreen,
  isAuthenticated,
  getUserRankForCategory,
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { fetchUserRanks } from '../../api/leaderboard.js';
import { DustIcon, GoldIcon } from '../icons/index.js';
import styles from './EndScreen.module.css';

interface EndScreenProps {
  onPlayAgain: () => Promise<void>;
  onReturnToHub: () => void | Promise<void>;
}

// Confetti colors
const CONFETTI_COLORS = ['#4ade80', '#22c55e', '#fbbf24', '#f59e0b', '#a78bfa', '#8b5cf6'];

function Confetti() {
  const pieces = useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
    }));
  }, []);

  return (
    <div class={styles.confetti}>
      {pieces.map((piece) => (
        <div
          key={piece.id}
          class={styles.confettiPiece}
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}

export function EndScreen({ onPlayAgain, onReturnToHub }: EndScreenProps) {
  const { t } = useTranslation('game');
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState<string | null>(null);

  const stats = endGameStats.value;
  const xpEarned = stats?.sessionXpEarned ?? 0;
  const wavesCleared = stats?.wavesCleared ?? 0;

  // Show confetti for good runs (5+ waves)
  const showConfetti = wavesCleared >= 5;

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

  // Handle keyboard
  useEffect(() => {
    if (!showEndScreen.value) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlePlayAgain();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleReturnToHub();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showEndScreen.value]);

  if (!showEndScreen.value) return null;

  return (
    <>
      {showConfetti && <Confetti />}

      <div class={styles.overlay} role="dialog" aria-modal="true" aria-label={t('endScreen.sessionComplete')}>
        <div class={styles.container}>
          {/* Wave Badge - Hero Element */}
          <div class={styles.waveBadge}>
            <div class={styles.waveRing}>
              <div class={styles.waveRingOuter} />
              <div class={styles.waveRingInner} />
              <div class={styles.waveContent}>
                <span class={styles.waveLabel}>{t('endScreen.wave')}</span>
                <span class={styles.waveNumber}>{wavesCleared}</span>
              </div>
            </div>
          </div>

          {/* Result Message */}
          <div class={styles.resultMessage}>
            <h2 class={styles.resultTitle}>{t('endScreen.sessionComplete')}</h2>
            <p class={styles.resultSubtitle}>{t('endScreen.sessionMessage')}</p>
          </div>

          {/* Stats Row */}
          {stats && (
            <div class={styles.statsRow}>
              <div class={styles.statItem}>
                <span class={styles.statValue}>{stats.kills}</span>
                <span class={styles.statLabel}>{t('endScreen.kills')}</span>
              </div>
              <div class={styles.statItem}>
                <span class={styles.statValue}>{stats.eliteKills}</span>
                <span class={styles.statLabel}>{t('endScreen.elites')}</span>
              </div>
              <div class={styles.statItem}>
                <span class={styles.statValue}>{stats.relics.length}</span>
                <span class={styles.statLabel}>{t('endScreen.relics')}</span>
              </div>
            </div>
          )}

          {/* Rankings Row */}
          {isAuthenticated.value && (
            <>
              {rankingLoading ? (
                <div class={styles.rankingLoading}>{t('endScreen.loadingRank')}</div>
              ) : rankingError ? (
                <div class={styles.rankingError}>{t('endScreen.rankingError')}</div>
              ) : (weeklyRank || totalRank) && (
                <div class={styles.rankingsRow}>
                  {weeklyRank && (
                    <div class={`${styles.rankCard} ${styles.weekly} ${weeklyRank.rank && weeklyRank.rank <= 10 ? styles.top10 : ''}`}>
                      <span class={styles.rankIcon}>🏅</span>
                      <div class={styles.rankInfo}>
                        <span class={styles.rankLabel}>{t('endScreen.weeklyRank')}</span>
                        <span class={styles.rankValue}>
                          {weeklyRank.rank ? `#${weeklyRank.rank}` : '—'}
                        </span>
                      </div>
                      {weeklyRank.rank && weeklyRank.rank <= 10 && (
                        <span class={styles.top10Badge}>{t('endScreen.top10')}</span>
                      )}
                    </div>
                  )}
                  {totalRank && (
                    <div class={`${styles.rankCard} ${styles.overall}`}>
                      <span class={styles.rankIcon}>⭐</span>
                      <div class={styles.rankInfo}>
                        <span class={styles.rankLabel}>{t('endScreen.totalRank')}</span>
                        <span class={styles.rankValue}>
                          {totalRank.rank ? `#${totalRank.rank}` : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Rewards Strip */}
          {stats && (
            <div class={styles.rewardsStrip}>
              <div class={`${styles.rewardChip} ${styles.gold}`}>
                <span class={styles.rewardIcon}>
                  <GoldIcon size={18} />
                </span>
                <span class={styles.rewardValue}>+{stats.goldEarned}</span>
              </div>
              <div class={`${styles.rewardChip} ${styles.dust}`}>
                <span class={styles.rewardIcon}>
                  <DustIcon size={16} />
                </span>
                <span class={styles.rewardValue}>+{stats.dustEarned}</span>
              </div>
              <div class={`${styles.rewardChip} ${styles.xp}`}>
                <span class={styles.rewardIcon}>⭐</span>
                <span class={styles.rewardValue}>+{xpEarned} XP</span>
              </div>
              {stats.statPointsEarned > 0 && (
                <div class={`${styles.rewardChip} ${styles.statPoints}`}>
                  <span class={styles.rewardIcon}>⬆</span>
                  <span class={styles.rewardValue}>+{stats.statPointsEarned} SP</span>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div class={styles.actions}>
            <button class={styles.playAgainBtn} onClick={handlePlayAgain}>
              {t('endScreen.playAgain')}
            </button>
            <button class={styles.hubBtn} onClick={handleReturnToHub}>
              {t('endScreen.returnToHub')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
