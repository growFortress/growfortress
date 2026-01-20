import { Button } from '../shared/Button.js';
import {
  showPvpResultModal,
  pvpSelectedChallenge,
  pvpBattleResult,
  pvpBattleRewards,
  hideBattleResult,
  openReplayViewer,
  formatPower,
} from '../../state/index.js';
import { getArtifactById } from '@arcade/sim-core';
import styles from './PvpBattleResult.module.css';

export function PvpBattleResult() {
  if (!showPvpResultModal.value || !pvpSelectedChallenge.value || !pvpBattleResult.value) {
    return null;
  }

  const challenge = pvpSelectedChallenge.value;
  const result = pvpBattleResult.value;
  const rewards = pvpBattleRewards.value;

  const isWinner = result.winnerId === challenge.challengerId;
  const isDraw = !result.winnerId;

  const durationSeconds = Math.floor(result.duration / 30); // 30 ticks per second
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationRemainingSeconds = durationSeconds % 60;

  const winReasonText = {
    fortress_destroyed: 'Forteca zniszczona',
    timeout: 'Limit czasu',
    draw: 'Remis',
  }[result.winReason] || result.winReason;

  const handleWatchReplay = () => {
    hideBattleResult();
    openReplayViewer(challenge);
  };

  return (
    <div class={styles.overlay} onClick={(e) => {
      if (e.target === e.currentTarget) hideBattleResult();
    }}>
      <div class={styles.modal}>
        {/* Result Header */}
        <div class={`${styles.resultHeader} ${
          isDraw ? styles.resultDraw :
          isWinner ? styles.resultWin : styles.resultLoss
        }`}>
          <div class={styles.resultIcon}>
            {isDraw ? '🤝' : isWinner ? '🏆' : '💀'}
          </div>
          <div class={styles.resultText}>
            {isDraw ? 'REMIS' : isWinner ? 'ZWYCIĘSTWO!' : 'PORAŻKA'}
          </div>
          <div class={styles.resultReason}>
            {winReasonText}
          </div>
        </div>

        {/* Battle Summary */}
        <div class={styles.battleSummary}>
          {/* Challenger Side */}
          <div class={`${styles.side} ${isWinner ? styles.sideWinner : ''}`}>
            <div class={styles.sideName}>{challenge.challengerName}</div>
            <div class={styles.sidePower}>💪 {formatPower(challenge.challengerPower)}</div>
            <div class={styles.sideStats}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>HP Fortecy</span>
                <span class={styles.statValue}>{result.challengerStats.finalHp}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Obrażenia</span>
                <span class={styles.statValue}>{result.challengerStats.damageDealt.toLocaleString()}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Bohaterowie</span>
                <span class={styles.statValue}>{result.challengerStats.heroesAlive} żywych</span>
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div class={styles.vsDivider}>
            <span>VS</span>
          </div>

          {/* Challenged Side */}
          <div class={`${styles.side} ${!isWinner && !isDraw ? styles.sideWinner : ''}`}>
            <div class={styles.sideName}>{challenge.challengedName}</div>
            <div class={styles.sidePower}>💪 {formatPower(challenge.challengedPower)}</div>
            <div class={styles.sideStats}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>HP Fortecy</span>
                <span class={styles.statValue}>{result.challengedStats.finalHp}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Obrażenia</span>
                <span class={styles.statValue}>{result.challengedStats.damageDealt.toLocaleString()}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>Bohaterowie</span>
                <span class={styles.statValue}>{result.challengedStats.heroesAlive} żywych</span>
              </div>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div class={styles.duration}>
          <span class={styles.durationLabel}>Czas walki:</span>
          <span class={styles.durationValue}>
            {durationMinutes}:{durationRemainingSeconds.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Rewards Section */}
        {rewards && (
          <div class={styles.rewardsSection}>
            <div class={styles.rewardsTitle}>Nagrody</div>
            <div class={styles.rewardsList}>
              <div class={styles.rewardItem}>
                <span class={styles.rewardIcon}>🌫️</span>
                <span class={styles.rewardLabel}>Dust:</span>
                <span class={styles.rewardValue}>+{rewards.dust}</span>
              </div>
              <div class={styles.rewardItem}>
                <span class={styles.rewardIcon}>🪙</span>
                <span class={styles.rewardLabel}>Złoto:</span>
                <span class={styles.rewardValue}>+{rewards.gold}</span>
              </div>
              <div class={styles.rewardItem}>
                <span class={styles.rewardIcon}>⚔️</span>
                <span class={styles.rewardLabel}>Honor:</span>
                <span class={`${styles.rewardValue} ${
                  rewards.honorChange > 0 ? styles.honorGain :
                  rewards.honorChange < 0 ? styles.honorLoss : ''
                }`}>
                  {rewards.honorChange > 0 ? '+' : ''}{rewards.honorChange}
                </span>
              </div>
              {rewards.artifactId && (() => {
                const artifact = getArtifactById(rewards.artifactId);
                return artifact ? (
                  <div class={`${styles.rewardItem} ${styles.rewardArtifact}`}>
                    <span class={styles.rewardIcon}>🎁</span>
                    <span class={styles.rewardLabel}>Artefakt:</span>
                    <span class={styles.rewardValue}>{artifact.polishName}</span>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {/* Actions */}
        <div class={styles.actions}>
          <Button variant="secondary" onClick={hideBattleResult}>
            Zamknij
          </Button>
          <Button variant="skill" onClick={handleWatchReplay}>
            🎬 Obejrzyj Replay
          </Button>
        </div>
      </div>
    </div>
  );
}
