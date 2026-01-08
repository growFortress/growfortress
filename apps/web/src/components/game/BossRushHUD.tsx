import {
  bossRushActive,
  totalDamageDealt,
  damagePerSecond,
  bossesKilled,
  currentCycle,
  damageHistory,
  achievedMilestones,
  showBossRushDetails,
  sessionDurationFormatted,
  formatDamage,
  formatDamageCompact,
  BOSS_RUSH_MILESTONES,
} from '../../state/index.js';
import styles from './BossRushHUD.module.css';

/** Pillar emoji lookup */
const PILLAR_EMOJIS: Record<string, string> = {
  streets: '🏙️',
  science: '🔬',
  mutants: '🧬',
  cosmos: '🌌',
  magic: '✨',
  gods: '⚡',
};

export function BossRushHUD() {
  if (!bossRushActive.value) {
    return null;
  }

  const isExpanded = showBossRushDetails.value;
  const history = damageHistory.value;
  const milestones = BOSS_RUSH_MILESTONES;

  return (
    <div class={`${styles.container} ${isExpanded ? styles.expanded : ''}`}>
      {/* Collapsed view */}
      <div class={styles.collapsedView}>
        <div class={styles.statRow}>
          <span class={styles.icon}>⚔️</span>
          <span class={styles.value}>{formatDamageCompact(totalDamageDealt.value)}</span>
          <span class={styles.label}>DMG</span>
        </div>
        <div class={styles.statRow}>
          <span class={styles.icon}>🎯</span>
          <span class={styles.value}>{bossesKilled.value}</span>
          <span class={styles.label}>Bossów</span>
        </div>
        <div class={styles.statRow}>
          <span class={styles.icon}>⏱️</span>
          <span class={styles.value}>{sessionDurationFormatted.value}</span>
        </div>

        <button
          class={styles.toggleButton}
          onClick={() => (showBossRushDetails.value = !showBossRushDetails.value)}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div class={styles.expandedView}>
          {/* Total Damage Section */}
          <div class={styles.section}>
            <div class={styles.sectionHeader}>⚔️ TOTAL DAMAGE</div>
            <div class={styles.bigValue}>{formatDamage(totalDamageDealt.value)}</div>
            {damagePerSecond.value > 0 && (
              <div class={styles.dps}>(+{formatDamageCompact(damagePerSecond.value)} DPS)</div>
            )}
          </div>

          {/* Bosses Killed Section */}
          <div class={styles.section}>
            <div class={styles.sectionHeader}>🎯 BOSSES KILLED</div>
            <div class={styles.bigValue}>{bossesKilled.value}</div>
            <div class={styles.cycleInfo}>Cycle {currentCycle.value + 1}</div>
          </div>

          {/* Damage Breakdown */}
          {history.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>📈 DAMAGE BREAKDOWN</div>
              <div class={styles.damageList}>
                {history.slice(-5).map((entry, index) => (
                  <div key={`${entry.bossIndex}-${index}`} class={styles.damageEntry}>
                    <span class={styles.bossNum}>{entry.bossIndex + 1}.</span>
                    <span class={styles.bossEmoji}>
                      {PILLAR_EMOJIS[entry.pillarId] || '👹'}
                    </span>
                    <span class={styles.bossName}>{entry.bossName}</span>
                    <span class={styles.dmgValue}>
                      {formatDamageCompact(entry.damage)}
                    </span>
                    <span class={entry.killed ? styles.statusKilled : styles.statusNotKilled}>
                      {entry.killed ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones Section */}
          <div class={styles.section}>
            <div class={styles.sectionHeader}>🏆 MILESTONES</div>
            <div class={styles.milestoneList}>
              {milestones.map((milestone, index) => {
                const achieved = achievedMilestones.value.includes(index);
                const progress = Math.min(bossesKilled.value / milestone.bosses, 1);

                return (
                  <div
                    key={milestone.bosses}
                    class={`${styles.milestoneItem} ${achieved ? styles.achieved : ''}`}
                  >
                    <span class={styles.milestoneCheck}>
                      {achieved ? '✅' : '⬜'}
                    </span>
                    <span class={styles.milestoneLabel}>
                      {milestone.bosses} Bossów
                    </span>
                    {!achieved && (
                      <div class={styles.progressBar}>
                        <div
                          class={styles.progressFill}
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
