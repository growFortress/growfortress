import {
  gameState,
  gamePhase,
  currentWave as profileWave,
  selectedFortressClass,
  classSelectionVisible,
  hubInitialized,
  displayGold,
  displayDust,
  openSettingsMenu,
  openGuildPanel,
  openMessagesModal,
  openLeaderboardModal,
  showDailyQuestsPanel,
  showShopModal,
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { WaveProgress } from './WaveProgress.js';
import { PillarDisplay } from './PillarDisplay.js';
import { HeroSkillBar } from './HeroSkillBar.js';
import { TurretSkillBar } from './TurretSkillBar.js';
import { FortressSkillBar } from './FortressSkillBar.js';
import { FortressInfoPanel } from './FortressInfoPanel.js';
import { hasUnclaimedRewards, showRewardsModal } from '../modals/RewardsModal.js';
import styles from './Hud.module.css';

export function Hud() {
  const { t } = useTranslation('game');
  // Wave display: show game wave during session, profile wave when idle
  const waveDisplay = gameState.value?.wave ?? profileWave.value;
  const isPlaying = gamePhase.value !== 'idle';
  const isIdle = gamePhase.value === 'idle';
  const hasClass = selectedFortressClass.value !== null;
  const showHubUI = isIdle && hubInitialized.value;

  // Hide HUD during class selection
  if (classSelectionVisible.value) {
    return null;
  }

  return (
    <div class={styles.hud}>
      {/* Left section - Wave display with integrated progress */}
      <div class={styles.leftSection}>
        <div class={styles.waveDisplay}>
          <span class={styles.waveLabel}>{t('hud.wave')}</span>
          <span class={styles.waveNumber}>{waveDisplay}</span>
          {isPlaying && (
            <div class={styles.waveProgressIntegrated}>
              <WaveProgress />
            </div>
          )}
        </div>


        {showHubUI && hasUnclaimedRewards.value && (
          <button class={styles.rewardButton} onClick={() => showRewardsModal()}>
            <span class={styles.rewardLabel}>{t('hud.rewards')}</span>
            <div class={styles.rewardBadge} />
          </button>
        )}
      </div>


      {/* Right panel - Resources and buttons (only during gameplay) */}
      {isPlaying && (
        <div class={styles.rightGamePanel}>
          <div class={styles.gameResources}>
            <div class={styles.resourceItem}>
              <span class={styles.resourceIcon}>🪙</span>
              <span class={styles.resourceValue}>{displayGold.value}</span>
            </div>
            <div class={styles.resourceItem}>
              <span class={styles.resourceIcon}>✨</span>
              <span class={styles.resourceValue}>{displayDust.value}</span>
            </div>
          </div>

          <div class={styles.gameButtons}>
            <button onClick={() => showDailyQuestsPanel()} title={t('navigation.dailyQuests', { ns: 'common' })}></button>
            <button onClick={() => openLeaderboardModal()} title={t('navigation.leaderboards', { ns: 'common' })}></button>
            <button onClick={() => openMessagesModal()} title={t('navigation.messages', { ns: 'common' })}></button>
            <button onClick={() => openGuildPanel()} title={t('navigation.guild', { ns: 'common' })}></button>
            <button onClick={() => showShopModal()} title={t('navigation.shop', { ns: 'common' })}></button>
            <button onClick={openSettingsMenu} title={t('navigation.settings', { ns: 'common' })}></button>
          </div>
        </div>
      )}

      {/* Pillar display - separate panel below resources (only during gameplay) */}
      {isPlaying && (
        <div class={styles.pillarSection}>
          <PillarDisplay />
        </div>
      )}

      {/* Right panel - Fortress info (only in hub) */}
      {showHubUI && (
        <div class={styles.rightSection}>
          {hasClass && <FortressInfoPanel />}
        </div>
      )}

      {/* Skills section - Bottom left (only during gameplay) */}
      {isPlaying && hasClass && (
        <div class={styles.skillsSectionBottomLeft}>
          <div class={styles.skillsHeader}>{t('hud.skills')}</div>
          <div class={styles.skillsRow}>
            <HeroSkillBar compact />
            <TurretSkillBar compact />
            <FortressSkillBar compact />
          </div>
        </div>
      )}

    </div>
  );
}
