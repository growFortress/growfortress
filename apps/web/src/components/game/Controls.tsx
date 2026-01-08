import { gamePhase, showMaterialsModal, showArtifactsModal, heroRecruitmentModalVisible, showIdleRewardsModal, hasPendingRewards, openBossRushSetup, bossRushActive, openPvpPanel, pvpPendingChallenges } from '../../state/index.js';
import { Button } from '../shared/Button.js';
import { Tooltip } from '../shared/Tooltip.js';
import styles from './Controls.module.css';

interface ControlsProps {
  onStartClick: () => void;
  onEndSessionClick: () => void;
  onBossRushEndClick?: () => void;
  startDisabled?: boolean;
}

export function Controls({ onStartClick, onEndSessionClick, onBossRushEndClick, startDisabled }: ControlsProps) {
  const isBossRush = bossRushActive.value;

  return (
    <div class={styles.controls}>

      {gamePhase.value === 'idle' && (
        <>
          <Tooltip content="Rekrutuj nowych bohaterów" position="top">
            <Button variant="secondary" onClick={() => { heroRecruitmentModalVisible.value = true; }}>
              <span style={{ marginRight: '6px' }}>🦸</span> Bohaterowie
            </Button>
          </Tooltip>
          <Tooltip content="Zebrane materiały" position="top">
            <Button variant="secondary" onClick={showMaterialsModal}>
              <span style={{ marginRight: '6px' }}>📦</span> Materiały
            </Button>
          </Tooltip>
          <Tooltip content="Artefakty i przedmioty" position="top">
            <Button variant="secondary" onClick={showArtifactsModal}>
              <span style={{ marginRight: '6px' }}>⚔️</span> Artefakty
            </Button>
          </Tooltip>
          <Tooltip content="Odbierz nagrody za czas offline" position="top">
            <Button variant={hasPendingRewards.value ? "primary" : "secondary"} onClick={showIdleRewardsModal}>
              <span style={{ marginRight: '6px' }}>⏰</span> Zbieranie
              {hasPendingRewards.value && <span style={{ marginLeft: '4px', color: '#4ade80' }}>●</span>}
            </Button>
          </Tooltip>
          <Button variant="primary" onClick={onStartClick} disabled={startDisabled}>
            Rozpocznij
          </Button>
          <Tooltip content="Walcz z serią bossów!" position="top">
            <Button variant="skill" onClick={openBossRushSetup} disabled={startDisabled}>
              <span style={{ marginRight: '6px' }}>⚔️</span> Boss Rush
            </Button>
          </Tooltip>
          <Tooltip content="Walcz z innymi graczami!" position="top">
            <Button variant="skill" onClick={openPvpPanel}>
              <span style={{ marginRight: '6px' }}>🏆</span> PvP Arena
              {pvpPendingChallenges.value > 0 && (
                <span style={{ marginLeft: '4px', background: '#ef4444', borderRadius: '999px', padding: '0 6px', fontSize: '0.7rem' }}>
                  {pvpPendingChallenges.value}
                </span>
              )}
            </Button>
          </Tooltip>
        </>
      )}

      {['playing', 'choice', 'segment_submit'].includes(gamePhase.value) && !isBossRush && (
        <Button variant="danger" onClick={onEndSessionClick}>
          Zakończ
        </Button>
      )}

      {isBossRush && (
        <Button variant="danger" onClick={onBossRushEndClick}>
          Zakończ Boss Rush
        </Button>
      )}
    </div>
  );
}
