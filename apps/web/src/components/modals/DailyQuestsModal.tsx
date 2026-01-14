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
  unclaimedDustTotal,
  timeUntilReset,
  overallProgress,
  fetchDailyQuests,
  totalPotentialDust,
} from '../../state/dailyQuests.signals.js';
import { Modal } from '../shared/Modal.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import { useStaggeredEntrance } from '../../hooks/useStaggeredEntrance.js';
import styles from './DailyQuestsModal.module.css';
import { useEffect } from 'preact/hooks';

// Quest icons
const QUEST_ICONS: Record<string, string> = {
  first_blood: '🎮',
  wave_hunter: '👾',
  elite_slayer: '💀',
  boss_rush_daily: '🐉',
  pillar_master: '🏛️',
};

// Bonus type icons
const BONUS_ICONS: Record<string, string> = {
  gold: '🪙',
  material: '📦',
  random_material: '🎁',
};

export function DailyQuestsModal() {
  const isVisible = dailyQuestsPanelVisible.value;
  const state = dailyQuestsState.value;
  const claiming = claimingQuest.value;
  const claimingAllRewards = claimingAll.value;
  const unclaimedCount = unclaimedCompletedCount.value;
  const unclaimedDust = unclaimedDustTotal.value;
  const resetTime = timeUntilReset.value;
  const progress = overallProgress.value;
  const maxDust = totalPotentialDust.value;

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
        title="Daily Quests"
        onClose={hideDailyQuestsPanel}
        class={styles.modalContent}
        ariaLabel="Daily Quests"
      >
        <div class={styles.loading}>Loading quests...</div>
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
  const dustProgress = maxDust > 0 ? (state.totalDustEarned / maxDust) * 100 : 0;

  return (
    <Modal
      visible={isVisible}
      title="Daily Quests"
      onClose={hideDailyQuestsPanel}
      class={styles.modalContent}
      ariaLabel="Daily Quests"
    >
      {/* Header Section */}
      <div class={styles.header}>
        <div class={styles.headerTop}>
          <span class={styles.resetTimerBadge}>
            <span class={styles.timerIcon}>⏰</span>
            <span>Resets: {resetTime}</span>
          </span>
        </div>

        <div class={styles.overallProgressSection}>
          <span class={styles.overallProgressLabel}>Today's Progress</span>
          <ProgressBar
            percent={progress}
            class={styles.overallProgressBar}
            variant="primary"
            glow
          />
          <div class={styles.overallProgressStats}>
            <span>
              <span class={styles.statsHighlight}>{completedCount}</span> of{' '}
              {state.quests.length} Quests
            </span>
            <span>
              <span class={styles.statsHighlight}>{state.totalDustEarned}</span> /{' '}
              {maxDust} Dust
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
              class={`${styles.questCard} ${cardStateClass}`}
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
                    <span class={styles.readyBadge}>Ready</span>
                  )}
                  {isClaimed && <span class={styles.claimedBadge}>Done</span>}
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
                    {quest.progress}/{quest.target}{' '}
                    <span class={styles.progressPercent}>
                      ({Math.round(questProgressPercent)}%)
                    </span>
                  </span>
                </div>
              </div>

              {/* Right Section: Rewards + Action */}
              <div class={styles.questRight}>
                <div class={styles.rewardsList}>
                  <div class={`${styles.rewardItem} ${styles.dustReward}`}>
                    <span class={styles.rewardIcon}>💨</span>
                    <span>{quest.dustReward}</span>
                  </div>
                  {quest.bonusType && (
                    <div class={`${styles.rewardItem} ${styles.bonusReward}`}>
                      <span class={styles.rewardIcon}>
                        {BONUS_ICONS[quest.bonusType] || '🎁'}
                      </span>
                      <span>
                        {quest.bonusType === 'gold' && `+${quest.bonusValue}`}
                        {quest.bonusType === 'material' && `+1 ${quest.bonusValue}`}
                        {quest.bonusType === 'random_material' &&
                          `+${quest.bonusValue}`}
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
                      {isClaiming ? '...' : 'Claim'}
                    </button>
                  ) : isClaimed ? (
                    <div class={styles.claimedCheckmark}>✓</div>
                  ) : (
                    <div class={styles.lockedIndicator}>In Progress</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div class={styles.footer}>
        <div class={styles.totalDustSection}>
          <span class={styles.totalDustLabel}>Total Earned Today</span>
          <span class={styles.totalDustValue}>
            {state.totalDustEarned}
            <span class={styles.totalDustMax}> / {maxDust} Dust</span>
          </span>
          <ProgressBar
            percent={dustProgress}
            class={styles.totalDustMiniBar}
            variant="primary"
          />
        </div>

        {unclaimedCount > 0 ? (
          <div class={styles.claimAllSection}>
            <button
              class={styles.claimAllButton}
              onClick={handleClaimAll}
              disabled={claimingAllRewards || claiming !== null}
            >
              {claimingAllRewards ? 'Claiming...' : `Claim All (${unclaimedCount})`}
            </button>
            <span class={styles.claimAllPreview}>Collect: {unclaimedDust} Dust</span>
          </div>
        ) : state.allClaimed ? (
          <div class={styles.allClaimedMessage}>
            ✓ All rewards claimed! See you tomorrow.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
