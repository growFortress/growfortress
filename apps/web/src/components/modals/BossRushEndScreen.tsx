import { Button } from '../shared/Button.js';
import { Modal } from '../shared/Modal.js';
import {
  showBossRushEndScreen,
  bossRushEndResult,
  closeBossRushEndScreen,
  totalDamageDealt,
  bossesKilled,
  currentCycle,
  damageHistory,
  achievedMilestones,
  sessionDurationFormatted,
  bossRushMaterialsEarned,
  userBestDamage,
  formatDamage,
  formatDamageCompact,
  resetBossRushState,
  BOSS_RUSH_MILESTONES,
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './BossRushEndScreen.module.css';

/** Pillar emoji lookup */
const PILLAR_EMOJIS: Record<string, string> = {
  streets: '🏙️',
  science: '🔬',
  mutants: '🧬',
  cosmos: '🌌',
  magic: '✨',
  gods: '⚡',
};

interface BossRushEndScreenProps {
  onPlayAgain: () => Promise<void>;
  onMenu: () => void;
}

export function BossRushEndScreen({ onPlayAgain, onMenu }: BossRushEndScreenProps) {
  const { t } = useTranslation('modals');
  const result = bossRushEndResult.value;
  const history = damageHistory.value;
  const milestones = BOSS_RUSH_MILESTONES;

  // Check if this is a new personal best
  const isNewBest = totalDamageDealt.value > userBestDamage.value;

  async function handlePlayAgain() {
    closeBossRushEndScreen();
    resetBossRushState();
    await onPlayAgain();
  }

  function handleMenu() {
    closeBossRushEndScreen();
    resetBossRushState();
    onMenu();
  }

  return (
    <Modal
      visible={showBossRushEndScreen.value}
      title=""
      onClose={closeBossRushEndScreen}
      class={styles.modalContent}
      ariaLabel={t('bossRushEnd.ariaLabel')}
      closeOnBackdropClick={false}
      headerClass={styles.modalHeader}
    >
      {/* Header */}
      <div class={styles.header}>
        <span class={styles.skull}>☠️</span>
        <h2>{t('bossRushEnd.gameOver')}</h2>
        <span class={styles.skull}>☠️</span>
      </div>
      <p class={styles.subtitle}>{t('bossRushEnd.fortressDestroyed')}</p>

      {/* Summary Box */}
      <div class={styles.summaryBox}>
        <div class={styles.summaryRow}>
          <span class={styles.summaryIcon}>⚔️</span>
          <span class={styles.summaryLabel}>{t('bossRushEnd.totalDamage')}</span>
          <span class={styles.summaryValue}>{formatDamage(totalDamageDealt.value)}</span>
          {isNewBest && <span class={styles.newBest}>{t('bossRushEnd.newBest')}</span>}
        </div>
        <div class={styles.summaryRow}>
          <span class={styles.summaryIcon}>🎯</span>
          <span class={styles.summaryLabel}>{t('bossRushEnd.bossesKilled')}</span>
          <span class={styles.summaryValue}>
            {t('bossRushEnd.bossesKilledValue', { count: bossesKilled.value, cycle: currentCycle.value + 1 })}
          </span>
        </div>
        <div class={styles.summaryRow}>
          <span class={styles.summaryIcon}>⏱️</span>
          <span class={styles.summaryLabel}>{t('bossRushEnd.timeSurvived')}</span>
          <span class={styles.summaryValue}>{sessionDurationFormatted.value}</span>
        </div>
      </div>

      {/* Damage Timeline */}
      {history.length > 0 && (
        <div class={styles.section}>
          <h3 class={styles.sectionTitle}>{t('bossRushEnd.damageTimeline')}</h3>
          <div class={styles.timeline}>
            <div class={styles.timelineHeader}>
              <span>{t('bossRushEnd.timeline.boss')}</span>
              <span>{t('bossRushEnd.timeline.damage')}</span>
              <span>{t('bossRushEnd.timeline.status')}</span>
            </div>
            {history.map((entry, index) => (
              <div key={`${entry.bossIndex}-${index}`} class={styles.timelineRow}>
                <span class={styles.timelineBoss}>
                  <span class={styles.bossEmoji}>
                    {PILLAR_EMOJIS[entry.pillarId] || '👹'}
                  </span>
                  {entry.bossName}
                </span>
                <span class={styles.timelineDamage}>
                  {formatDamageCompact(entry.damage)}
                </span>
                <span class={entry.killed ? styles.killed : styles.notKilled}>
                  {entry.killed ? t('bossRushEnd.timeline.killed') : t('bossRushEnd.timeline.notKilled')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievedMilestones.value.length > 0 && (
        <div class={styles.section}>
          <h3 class={styles.sectionTitle}>{t('bossRushEnd.achievements')}</h3>
          <div class={styles.achievements}>
            {milestones
              .filter((_, index) => achievedMilestones.value.includes(index))
              .map((milestone) => (
                <div key={milestone.bosses} class={styles.achievement}>
                  <span class={styles.achievementIcon}>🏆</span>
                  <span class={styles.achievementLabel}>{t('bossRushEnd.achievementLabel', { count: milestone.bosses })}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      {result?.rewards && (
        <div class={styles.section}>
          <h3 class={styles.sectionTitle}>{t('bossRushEnd.rewardsTitle')}</h3>
          <div class={styles.rewards}>
            <span class={styles.rewardItem}>{t('bossRushEnd.rewardGold', { amount: result.rewards.gold })}</span>
            <span class={styles.rewardItem}>{t('bossRushEnd.rewardDust', { amount: result.rewards.dust })}</span>
            <span class={styles.rewardItem}>{t('bossRushEnd.rewardXp', { amount: result.rewards.xp })}</span>
          </div>
          {Object.keys(bossRushMaterialsEarned.value).length > 0 && (
            <div class={styles.materials}>
              {Object.entries(bossRushMaterialsEarned.value).map(([id, count]) => (
                <span key={id} class={styles.materialItem}>
                  +{count}x {id.replace('boss_', '').replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          {result.rewards.levelUp && result.rewards.newLevel && (
            <div class={styles.levelUp}>
              {t('bossRushEnd.levelUp', { level: result.rewards.newLevel })}
            </div>
          )}
        </div>
      )}

      {/* Leaderboard Position */}
      {result?.leaderboardRank && (
        <div class={styles.leaderboardBox}>
          <span class={styles.leaderboardIcon}>🥇</span>
          <span class={styles.leaderboardText}>
            {t('bossRushEnd.leaderboardRank', { rank: result.leaderboardRank })}
          </span>
        </div>
      )}

      {/* Buttons */}
      <div class={styles.buttons}>
        <Button variant="secondary" onClick={handleMenu}>
          🏠 {t('bossRushEnd.menu')}
        </Button>
        <Button variant="skill" onClick={handlePlayAgain}>
          🔄 {t('bossRushEnd.playAgain')}
        </Button>
      </div>
    </Modal>
  );
}
