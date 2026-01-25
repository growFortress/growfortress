import {
  bossRushActive,
  currentBossName,
  currentBossPillar,
  bossHp,
  bossMaxHp,
  bossHpPercent,
  currentCycleDisplay,
  bossNumberInCycle,
  bossRushIntermission,
  intermissionCountdown,
  showBossRushDetails,
  formatDamage,
  // Roguelike mode
  bossRushRelicOptions,
  bossRushRelicChosen,
  bossRushAvailableGold,
  openBossRushShop,
  showChoiceModal,
} from '../../state/index.js';
import { PILLAR_INFO } from '../../state/game.signals.js';
import { GoldIcon } from '../icons/index.js';
import styles from './BossHealthBar.module.css';

/** Pillar emoji lookup */
const PILLAR_EMOJIS: Record<string, string> = {
  streets: '🏙️',
  science: '🔬',
  mutants: '🧬',
  cosmos: '🌌',
  magic: '✨',
  gods: '⚡',
};

export function BossHealthBar() {
  if (!bossRushActive.value) {
    return null;
  }

  const pillar = currentBossPillar.value;
  const pillarInfo = pillar ? PILLAR_INFO[pillar] : null;
  const pillarEmoji = pillar ? PILLAR_EMOJIS[pillar] || '👹' : '👹';
  const hpPercent = bossHpPercent.value;
  const isLowHp = hpPercent < 30;
  const isIntermission = bossRushIntermission.value;

  // Determine health bar color class
  let hpColorClass = styles.hpGreen;
  if (hpPercent < 30) {
    hpColorClass = styles.hpRed;
  } else if (hpPercent < 60) {
    hpColorClass = styles.hpYellow;
  }

  return (
    <div class={styles.container}>
      <div class={styles.bossInfo}>
        <div class={styles.leftSection}>
          <span class={styles.bossEmoji}>{pillarEmoji}</span>
          <span class={styles.bossName}>{currentBossName.value || 'BOSS'}</span>
        </div>

        <div class={styles.rightSection}>
          <span class={styles.cycleInfo}>
            {currentCycleDisplay.value} | Boss {bossNumberInCycle.value}/7
          </span>
        </div>
      </div>

      <div class={`${styles.healthBarContainer} ${isLowHp ? styles.lowHp : ''}`}>
        {isIntermission ? (
          <div class={styles.intermissionBar}>
            <div class={styles.intermissionContent}>
              <span class={styles.intermissionText}>
                NEXT BOSS IN {intermissionCountdown.value}s
              </span>
              <div class={styles.intermissionActions}>
                {/* Relic selection button */}
                {bossRushRelicOptions.value.length > 0 && !bossRushRelicChosen.value && !showChoiceModal.value && (
                  <span class={styles.relicPrompt}>
                    Choose a relic!
                  </span>
                )}
                {bossRushRelicChosen.value && (
                  <span class={styles.relicChosen}>
                    Relic chosen
                  </span>
                )}
                {/* Shop button */}
                <button
                  type="button"
                  class={styles.shopButton}
                  onClick={openBossRushShop}
                >
                  🏪 Shop ({bossRushAvailableGold.value} <GoldIcon size={14} style={{ display: 'inline-block', verticalAlign: 'middle' }} />)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              class={`${styles.healthBarFill} ${hpColorClass}`}
              style={{ width: `${hpPercent}%` }}
            />
            <div class={styles.healthBarText}>
              {formatDamage(bossHp.value)} / {formatDamage(bossMaxHp.value)} HP
            </div>
          </>
        )}
      </div>

      <div class={styles.pillarRow}>
        <span class={styles.pillarName}>{pillarInfo?.name || pillar} Pillar</span>
        <button
          class={styles.detailsToggle}
          onClick={() => (showBossRushDetails.value = !showBossRushDetails.value)}
        >
          {showBossRushDetails.value ? '▲ Ukryj' : '▼ Szczegóły'}
        </button>
      </div>
    </div>
  );
}
