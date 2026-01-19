import {
  displayGold,
  displayDust,
  gamePhase,
  gameSpeed,
  selectedFortressClass,
  type GameSpeed,
} from "../../state/index.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import { EnergyBar } from "./EnergyBar.js";
import { PillarDisplay } from "./PillarDisplay.js";
import { HeroSkillBar } from "./HeroSkillBar.js";
import { TurretSkillBar } from "./TurretSkillBar.js";
import { FortressSkillBar } from "./FortressSkillBar.js";
import styles from "./GameSidePanel.module.css";

interface GameSidePanelProps {
  onSpeedChange: (speed: GameSpeed) => void;
  onMenuClick: () => void;
}

/**
 * GameSidePanel - Right-side panel shown during gameplay.
 * Contains resources, skills, and pillar display.
 * This panel creates a fixed-width game area for competitive fairness.
 */
export function GameSidePanel({ onSpeedChange, onMenuClick }: GameSidePanelProps) {
  const { t } = useTranslation(["game", "common"]);
  const isPlaying = gamePhase.value !== "idle";
  const hasClass = selectedFortressClass.value !== null;
  const currentSpeed = gameSpeed.value;

  // Only show during gameplay
  if (!isPlaying || !hasClass) {
    return null;
  }

  return (
    <aside class={styles.sidePanel} aria-label="Panel gry">
      {/* Speed Controls */}
      <div class={styles.speedControls}>
        <span class={styles.speedLabel}>Prędkość</span>
        <div class={styles.speedButtons}>
          {([1, 2, 3] as GameSpeed[]).map((speed) => (
            <button
              key={speed}
              class={`${styles.speedButton} ${currentSpeed === speed ? styles.speedActive : ''}`}
              onClick={() => onSpeedChange(speed)}
              aria-label={`Prędkość ${speed}x`}
              aria-pressed={currentSpeed === speed}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Resources Section */}
      <section class={styles.resourcesSection}>
        <h3 class={styles.sectionTitle}>Zasoby</h3>
        <div class={styles.resourcesList}>
          <div class={styles.resourceItem}>
            <span class={styles.resourceIcon} aria-hidden="true">🪙</span>
            <span class={styles.resourceValue}>{displayGold.value}</span>
            <span class={styles.resourceLabel}>{t("common:resources.gold")}</span>
          </div>
          <div class={styles.resourceItem}>
            <span class={styles.resourceIcon} aria-hidden="true">✨</span>
            <span class={styles.resourceValue}>{displayDust.value}</span>
            <span class={styles.resourceLabel}>{t("common:resources.dust")}</span>
          </div>
          <EnergyBar compact />
        </div>
      </section>

      {/* Pillar Display Section */}
      <section class={styles.pillarSection}>
        <h3 class={styles.sectionTitle}>Filary</h3>
        <PillarDisplay />
      </section>

      {/* Skills Section */}
      <section class={styles.skillsSection}>
        <h3 class={styles.sectionTitle}>Umiejętności</h3>
        <div class={styles.skillsContainer}>
          <HeroSkillBar />
          <TurretSkillBar />
          <FortressSkillBar />
        </div>
      </section>

      {/* Menu Button - at bottom */}
      <button
        class={styles.menuButton}
        onClick={onMenuClick}
        aria-label="Menu gry"
      >
        <span class={styles.menuIcon}>☰</span>
        <span class={styles.menuLabel}>Menu</span>
      </button>
    </aside>
  );
}
