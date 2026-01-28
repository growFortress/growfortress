import {
  gameState,
  gamePhase,
  currentWave as profileWave,
  selectedFortressClass,
  classSelectionVisible,
  hubInitialized,
  fortressHp,
  fortressMaxHp,
  fortressHpPercent,
  unifiedLevel,
  unifiedXpProgress,
  hasAvailableStatPoints,
} from "../../state/index.js";
import { colonySceneVisible } from "../../state/idle.signals.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import { FortressInfoPanel } from "./FortressInfoPanel.js";
import {
  hasUnclaimedRewards,
  showRewardsModal,
} from "../modals/RewardsModal.js";
import { StatPointsIndicator } from "./StatPointsIndicator.js";
import { showStatPointsModal } from "../modals/StatPointsModal.js";
import styles from "./Hud.module.css";

export function Hud() {
  const { t } = useTranslation("game");
  // Wave display: show game wave during session, profile wave when idle
  const waveDisplay = gameState.value?.wave ?? profileWave.value;
  const isPlaying = gamePhase.value !== "idle";
  const isIdle = gamePhase.value === "idle";
  const hasClass = selectedFortressClass.value !== null;
  const showHubUI = isIdle && hubInitialized.value;

  const hpPercent = fortressHpPercent.value;
  const hpValue = fortressHp.value;
  const hpMax = fortressMaxHp.value;

  // HP bar color based on percentage
  const getHpClass = () => {
    if (hpPercent > 60) return styles.hpHealthy;
    if (hpPercent > 30) return styles.hpDamaged;
    return styles.hpCritical;
  };

  // Hide HUD during class selection or colony scene
  if (classSelectionVisible.value || colonySceneVisible.value) {
    return null;
  }

  return (
    <div class={styles.hud}>
      {/* ===== GAMEPLAY HUD - TOP BAR ===== */}
      {isPlaying && (
        <div class={styles.gameTopBar}>
          {/* Wave Section */}
          <div class={styles.waveSection}>
            <span class={styles.waveLabel}>{t("hud.wave")}</span>
            <span class={styles.waveNumber}>{waveDisplay}</span>
          </div>

          <div class={styles.barDivider} />

          {/* HP Section */}
          <div class={styles.hpSection} data-tutorial="fortress-health">
            <div class={styles.hpBarWrapper}>
              <div class={styles.hpBarTrack}>
                <div
                  class={`${styles.hpBarFill} ${getHpClass()}`}
                  style={{ width: `${hpPercent}%` }}
                />
              </div>
            </div>
            <span class={styles.hpText}>{hpValue}<span class={styles.hpSep}>/</span>{hpMax}</span>
          </div>

          <div class={styles.barDivider} />

          {/* Level Section */}
          <div class={styles.levelSection}>
            <div class={styles.levelBadge}>
              <span class={styles.levelNum}>{unifiedLevel.value}</span>
            </div>
            <div class={styles.levelInfo}>
              <span class={styles.levelLabel}>LEVEL</span>
              <div class={styles.xpTrack}>
                <div
                  class={styles.xpFill}
                  style={{ width: `${unifiedXpProgress.value}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Skills moved to GameSidePanel */}

      {/* ===== HUB MODE UI ===== */}
      {!isPlaying && (
        <div class={styles.leftSection}>
          <div class={styles.waveDisplay}>
            <span class={styles.waveLabel}>{t("hud.wave")}</span>
            <span class={styles.waveNumber}>{waveDisplay}</span>
          </div>

          {showHubUI && hasUnclaimedRewards.value && (
            <button
              class={styles.rewardButton}
              onClick={() => showRewardsModal()}
            >
              <span class={styles.rewardLabel}>{t("hud.rewards")}</span>
              <div class={styles.rewardBadge} />
            </button>
          )}

          {showHubUI && hasAvailableStatPoints.value && (
            <StatPointsIndicator onClick={showStatPointsModal} />
          )}
        </div>
      )}

      {/* Right panel - Fortress info (only in hub) */}
      {showHubUI && (
        <div class={styles.rightSection}>
          {hasClass && <FortressInfoPanel />}
        </div>
      )}
    </div>
  );
}
