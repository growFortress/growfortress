import { gamePhase, showMaterialsModal, showArtifactsModal, heroRecruitmentModalVisible, showIdleRewardsModal, hasPendingRewards, bossRushActive } from '../../state/index.js';
import { Button } from '../shared/Button.js';
import { Tooltip } from '../shared/Tooltip.js';
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

      {gamePhase.value === 'idle' && (
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
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>🦸</span> {t('controls.heroesLabel')}
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.collectedMaterials')} position="top">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={showMaterialsModal}
                  aria-label={t('controls.materialsAria')}
                >
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>📦</span> {t('controls.materialsLabel')}
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.artifactsItems')} position="top">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={showArtifactsModal}
                  aria-label={t('controls.artifactsAria')}
                >
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>⚔️</span> {t('controls.artifactsLabel')}
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.claimOfflineRewards')} position="top">
                <Button
                  variant={hasPendingRewards.value ? "primary" : "secondary"}
                  size="sm"
                  onClick={showIdleRewardsModal}
                  aria-label={t('controls.gatheringAria') + (hasPendingRewards.value ? t('controls.pendingRewards') : '')}
                >
                  <span aria-hidden="true" style={{ marginRight: '6px' }}>⏰</span> {t('controls.gatheringLabel')}
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
              <Tooltip content={t('controls.comingSoon')} position="top">
                <Button
                  variant="skill"
                  size="sm"
                  disabled={true}
                  aria-label={t('controls.bossRushComingSoon')}
                  style={{ opacity: 0.6 }}
                >
                  <span aria-hidden="true" style={{ marginRight: '4px', fontSize: '1em' }}>👹</span> Boss Rush
                  <span style={{ marginLeft: '4px', fontSize: '0.65em', background: 'rgba(251, 191, 36, 0.3)', padding: '1px 4px', borderRadius: '3px', color: '#fbbf24' }}>SOON</span>
                </Button>
              </Tooltip>
              <Tooltip content={t('controls.comingSoon')} position="top">
                <Button
                  variant="skill"
                  size="sm"
                  disabled={true}
                  aria-label="Pillar Challenge - Coming Soon"
                  style={{ opacity: 0.6 }}
                >
                  <span aria-hidden="true" style={{ marginRight: '4px', fontSize: '1em' }}>🌀</span> Pillar
                  <span style={{ marginLeft: '4px', fontSize: '0.65em', background: 'rgba(251, 191, 36, 0.3)', padding: '1px 4px', borderRadius: '3px', color: '#fbbf24' }}>SOON</span>
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
            <span class={styles.menuLabel}>Menu</span>
          </button>
        </div>
      )}
    </div>
  );
}
