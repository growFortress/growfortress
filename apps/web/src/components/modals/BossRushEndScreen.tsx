import { Button } from '../shared/Button.js';
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
  if (!showBossRushEndScreen.value) {
    return null;
  }

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
    <div class={styles.overlay}>
      <div class={styles.modal}>
        {/* Header */}
        <div class={styles.header}>
          <span class={styles.skull}>☠️</span>
          <h2>GAME OVER</h2>
          <span class={styles.skull}>☠️</span>
        </div>
        <p class={styles.subtitle}>Twoja twierdza została zniszczona</p>

        {/* Summary Box */}
        <div class={styles.summaryBox}>
          <div class={styles.summaryRow}>
            <span class={styles.summaryIcon}>⚔️</span>
            <span class={styles.summaryLabel}>TOTAL DAMAGE:</span>
            <span class={styles.summaryValue}>{formatDamage(totalDamageDealt.value)}</span>
            {isNewBest && <span class={styles.newBest}>NEW BEST!</span>}
          </div>
          <div class={styles.summaryRow}>
            <span class={styles.summaryIcon}>🎯</span>
            <span class={styles.summaryLabel}>Bosses Killed:</span>
            <span class={styles.summaryValue}>
              {bossesKilled.value} (Cycle {currentCycle.value + 1})
            </span>
          </div>
          <div class={styles.summaryRow}>
            <span class={styles.summaryIcon}>⏱️</span>
            <span class={styles.summaryLabel}>Time Survived:</span>
            <span class={styles.summaryValue}>{sessionDurationFormatted.value}</span>
          </div>
        </div>

        {/* Damage Timeline */}
        {history.length > 0 && (
          <div class={styles.section}>
            <h3 class={styles.sectionTitle}>📊 DAMAGE TIMELINE</h3>
            <div class={styles.timeline}>
              <div class={styles.timelineHeader}>
                <span>Boss</span>
                <span>Damage</span>
                <span>Status</span>
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
                    {entry.killed ? '✅ Killed' : '❌ Not killed'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {achievedMilestones.value.length > 0 && (
          <div class={styles.section}>
            <h3 class={styles.sectionTitle}>🏆 ACHIEVEMENTS UNLOCKED</h3>
            <div class={styles.achievements}>
              {milestones
                .filter((_, index) => achievedMilestones.value.includes(index))
                .map((milestone) => (
                  <div key={milestone.bosses} class={styles.achievement}>
                    <span class={styles.achievementIcon}>🏆</span>
                    <span class={styles.achievementLabel}>{milestone.bosses} Bosses</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Rewards */}
        {result?.rewards && (
          <div class={styles.section}>
            <h3 class={styles.sectionTitle}>💰 REWARDS</h3>
            <div class={styles.rewards}>
              <span class={styles.rewardItem}>+{result.rewards.gold} Gold</span>
              <span class={styles.rewardItem}>+{result.rewards.dust} Dust</span>
              <span class={styles.rewardItem}>+{result.rewards.xp} XP</span>
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
                🎉 LEVEL UP! You are now level {result.rewards.newLevel}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Position */}
        {result?.leaderboardRank && (
          <div class={styles.leaderboardBox}>
            <span class={styles.leaderboardIcon}>🥇</span>
            <span class={styles.leaderboardText}>
              Rank #{result.leaderboardRank} this week
            </span>
          </div>
        )}

        {/* Buttons */}
        <div class={styles.buttons}>
          <Button variant="secondary" onClick={handleMenu}>
            🏠 Menu
          </Button>
          <Button variant="skill" onClick={handlePlayAgain}>
            🔄 Zagraj ponownie
          </Button>
        </div>
      </div>
    </div>
  );
}
