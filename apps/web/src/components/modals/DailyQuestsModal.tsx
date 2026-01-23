/**
 * Daily Quests Modal
 *
 * Displays daily quest progress and allows claiming rewards.
 * Quests reset daily at midnight UTC.
 */

import { DAILY_QUEST_DEFINITIONS, type DailyQuestId } from '@arcade/protocol';
import {
  dailyQuestsState,
  dailyQuestsPanelVisible,
  hideDailyQuestsPanel,
  claimQuestReward,
  claimAllQuestRewards,
  claimingQuest,
  claimingAll,
  unclaimedCompletedCount,
  timeUntilReset,
  overallProgress,
  fetchDailyQuests,
} from '../../state/dailyQuests.signals.js';
import { Modal } from '../shared/Modal.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance.js';
import { DustIcon } from '../icons/index.js';
import styles from './DailyQuestsModal.module.css';
import { useEffect } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';

// Quest icons
const QUEST_ICONS: Record<string, string> = {
  first_blood: '🎮',
  wave_hunter: '👾',
  elite_slayer: '💀',
  boss_slayer: '🐉',
  dedicated: '🏆',
};

// Quest type themes (for color styling)
const QUEST_TYPE_THEMES: Record<string, 'completion' | 'slayer' | 'boss'> = {
  first_blood: 'completion',
  dedicated: 'completion',
  wave_hunter: 'slayer',
  elite_slayer: 'slayer',
  boss_slayer: 'boss',
};

// Bonus type icons
const BONUS_ICONS: Record<string, string> = {
  gold: '🪙',
  material: '📦',
  random_material: '🎁',
};

export function DailyQuestsModal() {
  const { t } = useTranslation(['modals', 'common']);
  const isVisible = dailyQuestsPanelVisible.value;
  const state = dailyQuestsState.value;
  const claiming = claimingQuest.value;
  const claimingAllRewards = claimingAll.value;
  const unclaimedCount = unclaimedCompletedCount.value;
  const resetTime = timeUntilReset.value;
  const progress = overallProgress.value;

  // Staggered entrance animation for quest cards
  const { getItemStyle } = useStaggeredEntrance(state?.quests.length ?? 0, {
    delayPerItem: 50,
    duration: 400,
    initialDelay: 100,
  });

  // Fetch quests when modal opens
  useEffect(() => {
    if (isVisible && !state) {
      fetchDailyQuests();
    }
  }, [isVisible, state]);

  if (!state) {
    return (
      <Modal
        visible={isVisible}
        title={t('dailyQuests.title')}
        onClose={hideDailyQuestsPanel}
        class={styles.modalContent}
        ariaLabel={t('dailyQuests.ariaLabel')}
      >
        <div class={styles.loading}>{t('dailyQuests.loading')}</div>
      </Modal>
    );
  }

  const handleClaimQuest = async (questId: DailyQuestId) => {
    await claimQuestReward(questId);
  };

  const handleClaimAll = async () => {
    await claimAllQuestRewards();
  };

  const completedCount = state.quests.filter((q) => q.completed).length;

  return (
    <Modal
      visible={isVisible}
      title={t('dailyQuests.title')}
      onClose={hideDailyQuestsPanel}
      class={styles.modalContent}
      ariaLabel={t('dailyQuests.ariaLabel')}
    >
      {/* Header Section */}
      <div class={styles.header}>
        <div class={styles.headerTop}>
          <span class={styles.resetTimerBadge}>
            <span class={styles.timerIcon}>⏰</span>
            <span>{t('dailyQuests.resetsIn', { time: resetTime })}</span>
          </span>
        </div>

        <div class={styles.overallProgressSection}>
          <span class={styles.overallProgressLabel}>{t('dailyQuests.todayProgress')}</span>
          <ProgressBar
            percent={progress}
            class={styles.overallProgressBar}
            variant="primary"
            glow
          />
          <div class={styles.overallProgressStats}>
            <span>
              <span class={styles.statsHighlight}>{completedCount}</span>{' '}
              {t('dailyQuests.ofQuests', { total: state.quests.length })}
            </span>
          </div>
        </div>
      </div>

      {/* Quest List */}
      <div class={styles.questList}>
        {state.quests.map((quest, index) => {
          const def = DAILY_QUEST_DEFINITIONS.find((d) => d.id === quest.questId);
          if (!def) return null;

          const icon = QUEST_ICONS[quest.questId] || '📋';
          const questProgressPercent = Math.min(
            (quest.progress / quest.target) * 100,
            100
          );
          const isCompleted = quest.completed;
          const isClaimed = quest.claimed;
          const isClaiming = claiming === quest.questId;

          // Determine quest type theme
          const questType = QUEST_TYPE_THEMES[quest.questId] || 'completion';
          const questTypeClass = `questType${questType.charAt(0).toUpperCase() + questType.slice(1)}`;

          // Determine card state class
          let cardStateClass = styles.inProgress;
          if (isClaimed) {
            cardStateClass = styles.claimed;
          } else if (isCompleted) {
            cardStateClass = styles.completed;
          }

          return (
            <div
              key={quest.questId}
              class={`${styles.questCard} ${styles[questTypeClass]} ${cardStateClass}`}
              style={getItemStyle(index)}
            >
              {/* Icon Section */}
              <div class={styles.questIconContainer}>
                <span class={styles.questIcon}>{icon}</span>
                {(isCompleted || isClaimed) && (
                  <span class={styles.stateIndicator}>✓</span>
                )}
              </div>

              {/* Content Section */}
              <div class={styles.questContent}>
                <div class={styles.questHeader}>
                  <span class={styles.questName}>{def.name}</span>
                  {isCompleted && !isClaimed && (
                    <span class={styles.readyBadge}>{t('dailyQuests.ready')}</span>
                  )}
                  {isClaimed && <span class={styles.claimedBadge}>{t('dailyQuests.done')}</span>}
                </div>
                <p class={styles.questDesc}>{def.description}</p>

                <div class={styles.questProgressSection}>
                  <ProgressBar
                    percent={questProgressPercent}
                    class={styles.questProgressBar}
                    variant={isCompleted ? 'success' : 'primary'}
                    glow={isCompleted && !isClaimed}
                  />
                  <span class={styles.questProgressText}>
                    {quest.progress}/{quest.target}
                  </span>
                </div>
              </div>

              {/* Right Section: Rewards + Action */}
              <div class={styles.questRight}>
                <div class={styles.rewardsList}>
                  <div class={`${styles.rewardItem} ${styles.dustReward}`}>
                    <DustIcon size={14} className={styles.rewardIcon} />
                    <span>{quest.dustReward}</span>
                  </div>
                  {quest.bonusType && (
                    <div class={`${styles.rewardItem} ${styles.bonusReward}`}>
                      <span class={styles.rewardIcon}>
                        {BONUS_ICONS[quest.bonusType] || '🎁'}
                      </span>
                      <span>
                        {quest.bonusType === 'gold' && t('dailyQuests.rewardGold', { amount: quest.bonusValue })}
                        {quest.bonusType === 'material' && t('dailyQuests.rewardMaterial', { name: quest.bonusValue })}
                        {quest.bonusType === 'random_material' && t('dailyQuests.rewardRandomMaterial', { amount: quest.bonusValue })}
                      </span>
                    </div>
                  )}
                </div>

                <div class={styles.actionSection}>
                  {isCompleted && !isClaimed ? (
                    <button
                      class={styles.claimButton}
                      onClick={() => handleClaimQuest(quest.questId as DailyQuestId)}
                      disabled={isClaiming || claimingAllRewards}
                    >
                      {isClaiming ? t('dailyQuests.claiming') : t('dailyQuests.claim')}
                    </button>
                  ) : isClaimed ? (
                    <div class={styles.claimedCheckmark}>✓</div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {(unclaimedCount > 0 || state.allClaimed) && (
        <div class={styles.footer}>
          {unclaimedCount > 0 ? (
            <div class={styles.claimAllSection}>
              <button
                class={styles.claimAllButton}
                onClick={handleClaimAll}
                disabled={claimingAllRewards || claiming !== null}
              >
                {claimingAllRewards
                  ? t('dailyQuests.claimingAll')
                  : t('dailyQuests.claimAll', { count: unclaimedCount })}
              </button>
            </div>
          ) : (
            <div class={styles.allClaimedMessage}>
              {t('dailyQuests.allClaimed')}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
