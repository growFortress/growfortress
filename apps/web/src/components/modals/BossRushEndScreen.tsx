import { useEffect, useState } from 'preact/hooks';
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
  // Roguelike stats
  bossRushCollectedRelics,
  bossRushRerollsUsed,
  bossRushSynergiesActivated,
  bossRushBestSingleHit,
  bossRushGoldSpent,
  bossRushTotalHealing,
  hasEnergy,
} from '../../state/index.js';
import { speedSettings, toggleAutoRestart } from '../../state/settings.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { getRelicById } from '@arcade/sim-core';
import { DamageIcon, RangeIcon, CritChanceIcon } from '../icons/index.js';
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

  // Auto-restart countdown state
  const [countdown, setCountdown] = useState<number | null>(null);
  const autoRestartEnabled = speedSettings.value.autoRestart;
  const autoRestartDelay = speedSettings.value.autoRestartDelay;
  const canAutoRestart = autoRestartEnabled && hasEnergy.value;

  // Auto-restart timer
  useEffect(() => {
    if (!showBossRushEndScreen.value || !canAutoRestart) {
      setCountdown(null);
      return;
    }

    // Start countdown
    setCountdown(Math.ceil(autoRestartDelay / 1000));
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((autoRestartDelay - elapsed) / 1000);

      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
        handlePlayAgain();
      } else {
        setCountdown(remaining);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [showBossRushEndScreen.value, canAutoRestart, autoRestartDelay]);

  // Cancel auto-restart on manual interaction
  function cancelAutoRestart() {
    setCountdown(null);
  }

  async function handlePlayAgain() {
    closeBossRushEndScreen();
    resetBossRushState();
    await onPlayAgain();
  }

  function handleMenu() {
    cancelAutoRestart();
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
          <DamageIcon size={20} className={styles.summaryIcon} />
          <span class={styles.summaryLabel}>{t('bossRushEnd.totalDamage')}</span>
          <span class={styles.summaryValue}>{formatDamage(totalDamageDealt.value)}</span>
          {isNewBest && <span class={styles.newBest}>{t('bossRushEnd.newBest')}</span>}
        </div>
        <div class={styles.summaryRow}>
          <RangeIcon size={20} className={styles.summaryIcon} />
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

      {/* Roguelike Run Stats */}
      {(bossRushCollectedRelics.value.length > 0 || bossRushSynergiesActivated.value > 0) && (
        <div class={styles.section}>
          <h3 class={styles.sectionTitle}>{t('bossRushEnd.runStats.title')}</h3>
          <div class={styles.runStats}>
            {/* Relics Collected */}
            {bossRushCollectedRelics.value.length > 0 && (
              <div class={styles.runStatRow}>
                <span class={styles.runStatIcon}>🔮</span>
                <span class={styles.runStatLabel}>{t('bossRushEnd.runStats.relicsCollected')}</span>
                <span class={styles.runStatValue}>{bossRushCollectedRelics.value.length}</span>
              </div>
            )}
            {/* Synergies Activated */}
            {bossRushSynergiesActivated.value > 0 && (
              <div class={styles.runStatRow}>
                <span class={styles.runStatIcon}>🔗</span>
                <span class={styles.runStatLabel}>{t('bossRushEnd.runStats.synergiesActivated')}</span>
                <span class={styles.runStatValue}>{bossRushSynergiesActivated.value}</span>
              </div>
            )}
            {/* Best Single Hit */}
            {bossRushBestSingleHit.value > 0 && (
              <div class={styles.runStatRow}>
                <CritChanceIcon size={18} className={styles.runStatIcon} />
                <span class={styles.runStatLabel}>{t('bossRushEnd.runStats.bestSingleHit')}</span>
                <span class={styles.runStatValue}>{formatDamageCompact(bossRushBestSingleHit.value)}</span>
              </div>
            )}
            {/* Gold Spent */}
            {bossRushGoldSpent.value > 0 && (
              <div class={styles.runStatRow}>
                <span class={styles.runStatIcon}>🪙</span>
                <span class={styles.runStatLabel}>{t('bossRushEnd.runStats.goldSpent')}</span>
                <span class={styles.runStatValue}>{formatDamage(bossRushGoldSpent.value)}</span>
              </div>
            )}
            {/* Total Healing */}
            {bossRushTotalHealing.value > 0 && (
              <div class={styles.runStatRow}>
                <span class={styles.runStatIcon}>💚</span>
                <span class={styles.runStatLabel}>{t('bossRushEnd.runStats.hpHealed')}</span>
                <span class={styles.runStatValue}>{formatDamage(bossRushTotalHealing.value)}</span>
              </div>
            )}
            {/* Rerolls Used */}
            {bossRushRerollsUsed.value > 0 && (
              <div class={styles.runStatRow}>
                <span class={styles.runStatIcon}>🎲</span>
                <span class={styles.runStatLabel}>{t('bossRushEnd.runStats.relicRerolls')}</span>
                <span class={styles.runStatValue}>{bossRushRerollsUsed.value}</span>
              </div>
            )}
          </div>

          {/* Collected Relics List */}
          {bossRushCollectedRelics.value.length > 0 && (
            <div class={styles.relicsList}>
              <h4 class={styles.relicsListTitle}>{t('bossRushEnd.runStats.collectedRelics')}</h4>
              <div class={styles.relicsGrid}>
                {bossRushCollectedRelics.value.map(relicId => {
                  const relic = getRelicById(relicId);
                  return (
                    <div key={relicId} class={styles.relicItem} title={relic?.description}>
                      <span class={styles.relicName}>{relic?.name || relicId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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

      {/* Auto-Restart Indicator */}
      {countdown !== null && countdown > 0 && (
        <div class={styles.autoRestartIndicator}>
          <span class={styles.autoRestartText}>
            🔄 {t('bossRushEnd.autoRestart.countdown', { seconds: countdown })}
          </span>
          <button
            type="button"
            class={styles.cancelAutoRestart}
            onClick={cancelAutoRestart}
          >
            ✕ {t('bossRushEnd.autoRestart.cancel')}
          </button>
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

      {/* Auto-Restart Toggle */}
      <div class={styles.autoRestartToggle}>
        <label class={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={autoRestartEnabled}
            onChange={toggleAutoRestart}
            class={styles.toggleCheckbox}
          />
          <span class={styles.toggleText}>
            🤖 {t('bossRushEnd.autoRestart.toggle')} {autoRestartEnabled ? t('bossRushEnd.autoRestart.on') : t('bossRushEnd.autoRestart.off')}
            {autoRestartEnabled && !hasEnergy.value && (
              <span class={styles.noEnergy}> {t('bossRushEnd.autoRestart.noEnergy')}</span>
            )}
          </span>
        </label>
      </div>
    </Modal>
  );
}
