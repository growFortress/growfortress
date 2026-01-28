/**
 * Daily Rewards Modal
 *
 * Displays a 7-day reward calendar with streak bonuses.
 * Players can claim one reward per day.
 */

import { useTranslation } from '../../i18n/useTranslation.js';
import { EnergyIcon } from '../icons/index.js';
import {
  dailyStatus,
  dailyModalVisible,
  hideDailyModal,
  claimDailyReward,
  claiming,
  canClaimDaily,
  streak,
  streakMultiplier,
  nextMilestone,
  daysUntilNextMilestone,
} from '../../state/daily.signals.js';
import { Modal } from '../shared/Modal.js';
import styles from './DailyRewardsModal.module.css';

export function DailyRewardsModal() {
  const { t } = useTranslation(['common']);
  const isVisible = dailyModalVisible.value;
  const status = dailyStatus.value;
  const isClaiming = claiming.value;
  const canClaim = canClaimDaily.value;
  const currentStreak = streak.value;
  const multiplier = streakMultiplier.value;
  const nextMilestoneValue = nextMilestone.value;
  const daysUntil = daysUntilNextMilestone.value;

  if (!status) return null;

  const handleClaim = async () => {
    const success = await claimDailyReward();
    if (success) {
      // Keep modal open to show updated state
    }
  };

  return (
    <Modal
      visible={isVisible}
      title={t('daily.title')}
      onClose={hideDailyModal}
      class={styles.modalContent}
      ariaLabel={t('daily.ariaLabel')}
    >
      {/* Streak Info */}
      <div class={styles.streakHeader}>
        <div class={styles.streakInfo}>
          <span class={styles.streakIcon}>🔥</span>
          <div class={styles.streakText}>
            <span class={styles.streakLabel}>{t('daily.streak')}</span>
            <span class={styles.streakValue}>{currentStreak} {t('daily.days')}</span>
          </div>
        </div>
        {multiplier > 1 && (
          <div class={styles.multiplierBadge}>
            +{Math.round((multiplier - 1) * 100)}% {t('daily.bonus')}
          </div>
        )}
      </div>

      {/* Next Milestone */}
      {nextMilestoneValue && daysUntil && (
        <div class={styles.milestoneInfo}>
          {t('daily.nextMilestone')}: {daysUntil} {t('daily.daysUntil')} ({nextMilestoneValue} {t('daily.dayStreak')})
        </div>
      )}

      {/* 7-Day Calendar */}
      <div class={styles.calendar}>
        {status.rewards.map((reward) => {
          const isCurrent = reward.isToday;
          const isClaimed = reward.claimed;

          return (
            <div
              key={reward.day}
              class={`${styles.dayCard} ${isCurrent ? styles.current : ''} ${isClaimed ? styles.claimed : ''} ${reward.isBonus ? styles.bonus : ''}`}
            >
              <div class={styles.dayNumber}>{t('daily.day')} {reward.day}</div>
              <div class={styles.rewardIcon}>
                {reward.isBonus ? '🎁' : '📦'}
              </div>
              <div class={styles.rewardList}>
                {reward.gold > 0 && (
                  <span class={styles.rewardItem}>
                    🪙 {Math.round(reward.gold * multiplier).toLocaleString()}
                  </span>
                )}
                {reward.dust > 0 && (
                  <span class={styles.rewardItem}>
                    💎 {Math.round(reward.dust * multiplier)}
                  </span>
                )}
                {reward.energy > 0 && (
                  <span class={styles.rewardItem}>
                    <EnergyIcon size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
                    {reward.energy}
                  </span>
                )}
              </div>
              {isClaimed && (
                <div class={styles.claimedBadge}>✓</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Claim Button */}
      <div class={styles.actions}>
        <button
          class={styles.claimBtn}
          onClick={handleClaim}
          disabled={!canClaim || isClaiming}
        >
          {isClaiming
            ? t('daily.claiming')
            : canClaim
              ? t('daily.claim')
              : t('daily.claimed')}
        </button>
      </div>
    </Modal>
  );
}
