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
import { DamageIcon, RangeIcon } from '../icons/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
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
  const { t } = useTranslation('game');

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
          <DamageIcon size={18} className={styles.icon} />
          <span class={styles.value}>{formatDamageCompact(totalDamageDealt.value)}</span>
          <span class={styles.label}>{t('bossRush.hud.dmg')}</span>
        </div>
        <div class={styles.statRow}>
          <RangeIcon size={18} className={styles.icon} />
          <span class={styles.value}>{bossesKilled.value}</span>
          <span class={styles.label}>{t('bossRush.hud.bossesLabel')}</span>
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
            <div class={styles.sectionHeader}>
              <DamageIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
              {t('bossRush.hud.totalDamage')}
            </div>
            <div class={styles.bigValue}>{formatDamage(totalDamageDealt.value)}</div>
            {damagePerSecond.value > 0 && (
              <div class={styles.dps}>(+{formatDamageCompact(damagePerSecond.value)} DPS)</div>
            )}
          </div>

          {/* Bosses Killed Section */}
          <div class={styles.section}>
            <div class={styles.sectionHeader}>
              <RangeIcon size={18} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} />
              {t('bossRush.hud.bossesKilled')}
            </div>
            <div class={styles.bigValue}>{bossesKilled.value}</div>
            <div class={styles.cycleInfo}>{t('bossRush.hud.cycle', { cycle: currentCycle.value + 1 })}</div>
          </div>

          {/* Damage Breakdown */}
          {history.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionHeader}>📈 {t('bossRush.hud.damageBreakdown')}</div>
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
            <div class={styles.sectionHeader}>🏆 {t('bossRush.hud.milestones')}</div>
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
                      {t('bossRush.hud.bossesCount', { count: milestone.bosses })}
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
