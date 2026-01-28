import { gamePhase, showMaterialsModal, showArtifactsModal, heroRecruitmentModalVisible, hasPendingRewards, bossRushActive, openBossRushSetup } from '../../state/index.js';
import { showColonyScene, colonySceneVisible } from '../../state/idle.signals.js';
import { autoPlaySettings, speedSettings, toggleAutoPlay, cycleSpeedMultiplier, setAutoPlayPreset } from '../../state/settings.signals.js';
import { Button } from '../shared/Button.js';
import { Tooltip } from '../shared/Tooltip.js';
import {
  HeroIcon,
  MaterialsIcon,
  ArtifactIcon,
  GatheringIcon,
  BossRushIcon,
  CrystalTrialIcon,
  DamageIcon,
  ArmorIcon,
  SpeedIcon,
} from '../icons/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './Controls.module.css';

interface ControlsProps {
  onStartClick: () => void;
  onEndSessionClick: () => void;
  onBossRushEndClick?: () => void;
  startDisabled?: boolean;
}

export function Controls({ onStartClick, onEndSessionClick: _onEndSessionClick, onBossRushEndClick, startDisabled }: ControlsProps) {
  const { t } = useTranslation('game');
  const isBossRush = bossRushActive.value;

  return (
    <div class={styles.controls} role="toolbar" aria-label={t('controls.gameControls')}>

      {gamePhase.value === 'idle' && !colonySceneVisible.value && (
        <div class={styles.navContainer}>
          {/* Left group: Management */}
          <div class={styles.navGroupWrapper}>
            <span class={styles.groupLabel}>{t('controls.management')}</span>
            <div class={styles.navGroup} data-group="management" role="group" aria-label={t('controls.management')}>
              <Tooltip content={t('controls.recruitHeroes')} position="top">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { heroRecruitmentModalVisible.value = true; }}
                  aria-label={t('controls.heroesAria')}
                >
                  <HeroIcon size={22} /> <span style={{ marginLeft: '6px' }}>{t('controls.heroesLabel')}</span>
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.collectedMaterials')} position="top">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={showMaterialsModal}
                  aria-label={t('controls.materialsAria')}
                >
                  <MaterialsIcon size={22} /> <span style={{ marginLeft: '6px' }}>{t('controls.materialsLabel')}</span>
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.artifactsItems')} position="top">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={showArtifactsModal}
                  aria-label={t('controls.artifactsAria')}
                >
                  <ArtifactIcon size={22} /> <span style={{ marginLeft: '6px' }}>{t('controls.artifactsLabel')}</span>
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.claimOfflineRewards')} position="top">
                <Button
                  variant={hasPendingRewards.value ? "primary" : "secondary"}
                  size="sm"
                  onClick={showColonyScene}
                  aria-label={t('controls.gatheringAria') + (hasPendingRewards.value ? t('controls.pendingRewards') : '')}
                >
                  <GatheringIcon size={22} /> <span style={{ marginLeft: '6px' }}>{t('controls.gatheringLabel')}</span>
                  {hasPendingRewards.value && <span aria-hidden="true" style={{ marginLeft: '4px', color: '#4ade80' }}>●</span>}
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Center: Main CTA */}
          <div class={styles.mainAction}>
            <Button
              variant="primary"
              size="lg"
              onClick={onStartClick}
              disabled={startDisabled}
              aria-label={t('controls.startGame')}
            >
              {t('controls.startLabel')}
            </Button>
          </div>

          {/* Right group: Game modes - more prominent */}
          <div class={styles.navGroupWrapper}>
            <span class={styles.groupLabel}>{t('controls.gameModes')}</span>
            <div class={styles.navGroup} data-group="modes" role="group" aria-label={t('controls.gameModes')}>
              <Tooltip content={t('controls.bossRushTooltip')} position="top">
                <Button
                  variant="skill"
                  size="sm"
                  onClick={openBossRushSetup}
                  aria-label={t('controls.bossRushLabel')}
                >
                  <BossRushIcon size={22} /> <span style={{ marginLeft: '4px' }}>{t('controls.bossRushLabel')}</span>
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.comingSoon')} position="top">
                <Button
                  variant="skill"
                  size="sm"
                  disabled
                  aria-label={`${t('controls.pillarChallengeLabel')} - ${t('controls.comingSoon')}`}
                >
                  <CrystalTrialIcon size={22} /> <span style={{ marginLeft: '4px' }}>{t('controls.pillarChallengeLabel')}</span>
                  <span class={styles.soonBadge}>{t('controls.soonBadge')}</span>
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      )}

      {/* Menu button is now in GameSidePanel for regular gameplay */}

      {/* Boss Rush menu button - shown because boss rush doesn't use side panel */}
      {isBossRush && (
        <div class={styles.menuButtonWrapper}>
          <button
            onClick={onBossRushEndClick}
            aria-label={t('controls.endBossRush')}
            class={styles.menuButton}
          >
            <span class={styles.menuIcon}>☰</span>
            <span class={styles.menuLabel}>{t('game:sidePanel.menu')}</span>
          </button>
        </div>
      )}

      {/* Auto-Play Controls - shown during Boss Rush */}
      {isBossRush && (
        <div class={styles.autoPlayControls}>
          <Tooltip content={autoPlaySettings.value.enabled ? 'Disable auto-play' : 'Enable auto-play'} position="top">
            <button
              type="button"
              class={`${styles.autoPlayButton} ${autoPlaySettings.value.enabled ? styles.active : ''}`}
              onClick={toggleAutoPlay}
              aria-label={autoPlaySettings.value.enabled ? 'Disable auto-play' : 'Enable auto-play'}
            >
              <span class={styles.autoPlayIcon}>{autoPlaySettings.value.enabled ? '🤖' : '👤'}</span>
              <span class={styles.autoPlayLabel}>
                {autoPlaySettings.value.enabled ? 'AUTO' : 'MANUAL'}
              </span>
            </button>
          </Tooltip>

          {autoPlaySettings.value.enabled && (
            <div class={styles.autoPlayPresets}>
              <button
                type="button"
                class={`${styles.presetButton} ${autoPlaySettings.value.relicPriority === 'damage' ? styles.activePreset : ''}`}
                onClick={() => setAutoPlayPreset('damage')}
              >
                <DamageIcon size={20} />
              </button>
              <button
                type="button"
                class={`${styles.presetButton} ${autoPlaySettings.value.relicPriority === 'defense' ? styles.activePreset : ''}`}
                onClick={() => setAutoPlayPreset('defense')}
              >
                <ArmorIcon size={20} />
              </button>
              <button
                type="button"
                class={`${styles.presetButton} ${autoPlaySettings.value.relicPriority === 'gold' ? styles.activePreset : ''}`}
                onClick={() => setAutoPlayPreset('gold')}
              >
                💰
              </button>
              <button
                type="button"
                class={`${styles.presetButton} ${autoPlaySettings.value.relicPriority === 'balanced' ? styles.activePreset : ''}`}
                onClick={() => setAutoPlayPreset('balanced')}
              >
                ⚖️
              </button>
            </div>
          )}

          <Tooltip content={`Speed: ${speedSettings.value.speedMultiplier}x`} position="top">
            <button
              type="button"
              class={`${styles.speedButton} ${speedSettings.value.speedMultiplier > 1 ? styles.active : ''}`}
              onClick={cycleSpeedMultiplier}
              aria-label={`Change speed (currently ${speedSettings.value.speedMultiplier}x)`}
            >
              <SpeedIcon size={18} className={styles.speedIcon} />
              <span class={styles.speedLabel}>{speedSettings.value.speedMultiplier}x</span>
            </button>
          </Tooltip>
        </div>
      )}

    </div>
  );
}
