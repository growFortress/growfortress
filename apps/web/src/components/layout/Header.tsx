import {
  displayName,
  displayGold,
  displayDust,
  baseLevel,
  xpProgress,
  fortressHpPercent,
  fortressHp,
  fortressMaxHp,
  gamePhase,
  classSelectionVisible,
  unifiedLevel,
  unifiedXpProgress,
  openSettingsMenu,
} from '../../state/index.js';
import styles from './Header.module.css';

interface HeaderProps {
  // Logout is now handled through settings menu
}

export function Header(_props: HeaderProps) {
  const isPlaying = gamePhase.value !== 'idle';

  // Hide header during class selection for cleaner modal view
  if (classSelectionVisible.value) {
    return null;
  }

  return (
    <header class={styles.header}>
      <div class={styles.leftSection}>
        <h1 class={styles.title}>Grow Fortress: Age of Super Hero</h1>

        {/* HP bar - only show when playing */}
        {isPlaying && (
          <div class={styles.gameBars}>
            <div class={styles.barContainer}>
              <span class={styles.barLabel}>HP</span>
              <div class={styles.barTrack}>
                <div
                  class={`${styles.barFill} ${styles.hpBar}`}
                  style={{ width: `${fortressHpPercent.value}%` }}
                />
              </div>
              <span class={styles.barValue}>{fortressHp.value}/{fortressMaxHp.value}</span>
            </div>
          </div>
        )}
      </div>

      <div class={styles.statusBar}>
        <div class={`${styles.stat} ${styles.playerName}`}>
          <span>{displayName.value || 'Gracz'}</span>
        </div>

        <div class={styles.stat}>
          <span>{displayGold.value}</span> Złoto
        </div>
        <div class={styles.stat}>
          <span>{displayDust.value}</span> Pył
        </div>

        {/* Level with XP bar */}
        <div class={styles.levelStat}>
          <span class={styles.levelLabel}>Lv <span class={styles.levelValue}>{isPlaying ? unifiedLevel.value : baseLevel.value}</span></span>
          <div class={styles.xpTrack}>
            <div
              class={styles.xpFill}
              style={{ width: `${isPlaying ? unifiedXpProgress.value : xpProgress.value}%` }}
            />
          </div>
        </div>

        <button class={styles.settingsBtn} onClick={openSettingsMenu} title="Ustawienia">
          ⚙️
        </button>
      </div>
    </header>
  );
}
