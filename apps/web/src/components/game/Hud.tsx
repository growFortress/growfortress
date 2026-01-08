import { useState } from 'preact/hooks';
import {
  gameState,
  gamePhase,
  currentScore,
  currentWave as profileWave,
  selectedFortressClass,
  classSelectionVisible,
  hubInitialized,
  openPowerUpgradeModal,
} from '../../state/index.js';
import { WaveProgress } from './WaveProgress.js';
import { HeroPanel } from './HeroPanel.js';
import { TurretPanel } from './TurretPanel.js';
import { SynergyPanel } from './SynergyPanel.js';
import { PillarDisplay } from './PillarDisplay.js';
import { InfinityStones } from './InfinityStones.js';
import { HeroSkillBar } from './HeroSkillBar.js';
import { TurretSkillBar } from './TurretSkillBar.js';
import { FortressSkillBar } from './FortressSkillBar.js';
import { StatsPanel } from './StatsPanel.js';
import { TutorialOverlay } from './TutorialOverlay.js';
import { FortressInfoPanel } from './FortressInfoPanel.js';
import { hasUnclaimedRewards, showRewardsModal } from '../modals/RewardsModal.js';
import styles from './Hud.module.css';

interface HudProps {
  onSnapClick?: () => void;
}

export function Hud({ onSnapClick }: HudProps) {
  // Wave display: show game wave during session, profile wave when idle
  const waveDisplay = gameState.value?.wave ?? profileWave.value;
  const killsDisplay = gameState.value?.kills ?? 0;
  const isPlaying = gamePhase.value !== 'idle';
  const isIdle = gamePhase.value === 'idle';
  const hasClass = selectedFortressClass.value !== null;
  const showHubUI = isIdle && hubInitialized.value;

  const [statsOpen, setStatsOpen] = useState(false);

  const handlePowerClick = () => {
    openPowerUpgradeModal('hero');
  };

  // Hide HUD during class selection
  if (classSelectionVisible.value) {
    return null;
  }

  return (
    <div class={styles.hud}>
      {/* Left section - Wave panel + Fortress button */}
      <div class={styles.leftSection}>
        <div class={`${styles.panel} ${styles.left}`}>
          <div class={styles.statItem}>
            <span class={styles.label}>Fala</span>
            <span class={styles.value}>{waveDisplay}</span>
          </div>
          {isPlaying && <WaveProgress />}
          {isPlaying && <PillarDisplay />}
          {isPlaying && <InfinityStones onSnapClick={onSnapClick} />}
        </div>

        {showHubUI && (
          <div class={styles.hubButtons}>
            <button class={styles.powerButton} onClick={handlePowerClick} title="Ulepszenia statystyk">
              <span class={styles.powerIcon}>⚡</span>
              <span class={styles.powerLabel}>MOC</span>
            </button>
            <button class={styles.rewardButton} onClick={() => showRewardsModal()} title="Nagrody">
              <span class={styles.rewardIcon}>🎁</span>
              {hasUnclaimedRewards.value && <div class={styles.rewardBadge} />}
            </button>
          </div>
        )}
      </div>

      {isPlaying && (
        <>
          <button 
            class={styles.statsButton} 
            onClick={() => setStatsOpen(true)}
            title="Statystyki Bitwy"
          >
            📊
          </button>
          <StatsPanel isOpen={statsOpen} onClose={() => setStatsOpen(false)} />
        </>
      )}

      {/* Center panels - Heroes, Turrets & Skills (only during gameplay) */}
      {isPlaying && hasClass && (
        <div class={styles.centerPanels}>
          <div class={styles.sidePanel}>
            <HeroPanel compact />
          </div>
          <div class={styles.sidePanel}>
            <TurretPanel compact />
          </div>
          <div class={styles.sidePanel}>
            <HeroSkillBar compact />
          </div>
          <div class={styles.sidePanel}>
            <TurretSkillBar compact />
          </div>
          <div class={styles.sidePanel}>
            <FortressSkillBar compact />
          </div>
        </div>
      )}

      {/* Right panel - Score & Synergies (only during gameplay) */}
      {isPlaying && (
        <div class={`${styles.panel} ${styles.right}`}>
          <div class={styles.statsGroup}>
            <div class={styles.statItem}>
              <span class={styles.label}>Zabicia</span>
              <span class={styles.value}>{killsDisplay}</span>
            </div>
            <div class={styles.statItem}>
              <span class={styles.label}>Wynik</span>
              <span class={styles.value}>{currentScore.value}</span>
            </div>
          </div>

          {hasClass && <SynergyPanel compact />}
        </div>
      )}

      {/* Right panel - Fortress info (only in hub) */}
      {showHubUI && hasClass && (
        <div class={styles.rightSection}>
          <FortressInfoPanel />
        </div>
      )}

      {/* Tutorial for new players (Wave 1-3) */}
      {isPlaying && <TutorialOverlay />}
    </div>
  );
}
