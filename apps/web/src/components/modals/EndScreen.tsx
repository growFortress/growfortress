import {
  showEndScreen,
  endScreenWon,
  endGameStats,
  hideEndScreen,
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import { Modal } from '../shared/Modal.js';
import styles from './EndScreen.module.css';

interface EndScreenProps {
  onPlayAgain: () => Promise<void>;
  onReturnToHub: () => void;
}

export function EndScreen({ onPlayAgain, onReturnToHub }: EndScreenProps) {
  const { t } = useTranslation('game');
  const handlePlayAgain = async () => {
    hideEndScreen();
    await onPlayAgain();
  };

  const won = endScreenWon.value;
  const stats = endGameStats.value;
  const xpEarned = stats?.sessionXpEarned ?? 0;

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
        <span class={styles.resultIcon}>{won ? '🏆' : '💀'}</span>
        <h2 class={`${styles.resultTitle} ${won ? styles.victory : styles.defeat}`}>
          {won ? t('endScreen.victory') : t('endScreen.defeat')}
        </h2>
        {stats && (
          <span class={styles.waveInfo}>
            {t('endScreen.waveReached', { wave: stats.wavesCleared })}
          </span>
        )}
      </div>

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
              <span class={styles.rewardIcon}>🪙</span>
              <span>+{stats.goldEarned}</span>
            </div>
            <div class={`${styles.rewardItem} ${styles.dust}`}>
              <span class={styles.rewardIcon}>✨</span>
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
