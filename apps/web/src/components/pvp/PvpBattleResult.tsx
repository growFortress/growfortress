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
import { getUserId } from '../../api/auth.js';
import { DustIcon, DamageIcon } from '../icons/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './PvpBattleResult.module.css';

export function PvpBattleResult() {
  const { t } = useTranslation('game');

  if (!showPvpResultModal.value || !pvpSelectedChallenge.value || !pvpBattleResult.value) {
    return null;
  }

  const challenge = pvpSelectedChallenge.value;
  const result = pvpBattleResult.value;
  const rewards = pvpBattleRewards.value;

  const currentUserId = getUserId();
  const isDraw = !result.winnerId;
  const challengerWon = result.winnerId === challenge.challengerId;
  const isUserWinner = currentUserId
    ? result.winnerId === currentUserId
    : challengerWon;

  const durationSeconds = Math.floor(result.duration / 30); // 30 ticks per second
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationRemainingSeconds = durationSeconds % 60;

  const winReasonText = {
    fortress_destroyed: t('pvp.winReason.fortressDestroyed'),
    timeout: t('pvp.winReason.timeout'),
    draw: t('pvp.winReason.draw'),
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
          isUserWinner ? styles.resultWin : styles.resultLoss
        }`}>
          <div class={styles.resultIcon}>
            {isDraw ? '🤝' : isUserWinner ? '🏆' : '💀'}
          </div>
          <div class={styles.resultText}>
            {isDraw ? t('pvp.result.draw') : isUserWinner ? t('pvp.result.victory') : t('pvp.result.defeat')}
          </div>
          <div class={styles.resultReason}>
            {winReasonText}
          </div>
        </div>

        {/* Battle Summary */}
        <div class={styles.battleSummary}>
          {/* Challenger Side */}
          <div class={`${styles.side} ${challengerWon ? styles.sideWinner : ''}`}>
            <div class={styles.sideName}>{challenge.challengerName}</div>
            <div class={styles.sidePower}>💪 {formatPower(challenge.challengerPower)}</div>
            <div class={styles.sideStats}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>{t('pvp.battleStats.fortressHp')}</span>
                <span class={styles.statValue}>{result.challengerStats.finalHp}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>{t('pvp.battleStats.damage')}</span>
                <span class={styles.statValue}>{result.challengerStats.damageDealt.toLocaleString()}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>{t('pvp.battleStats.heroes')}</span>
                <span class={styles.statValue}>{result.challengerStats.heroesAlive} {t('pvp.battleStats.alive')}</span>
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div class={styles.vsDivider}>
            <span>VS</span>
          </div>

          {/* Challenged Side */}
          <div class={`${styles.side} ${!challengerWon && !isDraw ? styles.sideWinner : ''}`}>
            <div class={styles.sideName}>{challenge.challengedName}</div>
            <div class={styles.sidePower}>💪 {formatPower(challenge.challengedPower)}</div>
            <div class={styles.sideStats}>
              <div class={styles.stat}>
                <span class={styles.statLabel}>{t('pvp.battleStats.fortressHp')}</span>
                <span class={styles.statValue}>{result.challengedStats.finalHp}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>{t('pvp.battleStats.damage')}</span>
                <span class={styles.statValue}>{result.challengedStats.damageDealt.toLocaleString()}</span>
              </div>
              <div class={styles.stat}>
                <span class={styles.statLabel}>{t('pvp.battleStats.heroes')}</span>
                <span class={styles.statValue}>{result.challengedStats.heroesAlive} {t('pvp.battleStats.alive')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div class={styles.duration}>
          <span class={styles.durationLabel}>{t('pvp.battleStats.battleDuration')}</span>
          <span class={styles.durationValue}>
            {durationMinutes}:{durationRemainingSeconds.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Rewards Section */}
        {rewards && (
          <div class={styles.rewardsSection}>
            <div class={styles.rewardsTitle}>{t('pvp.rewards.title')}</div>
            <div class={styles.rewardsList}>
              <div class={styles.rewardItem}>
                <DustIcon size={16} className={styles.rewardIcon} />
                <span class={styles.rewardLabel}>{t('pvp.rewards.dust')}</span>
                <span class={styles.rewardValue}>+{rewards.dust}</span>
              </div>
              <div class={styles.rewardItem}>
                <span class={styles.rewardIcon}>🪙</span>
                <span class={styles.rewardLabel}>{t('pvp.rewards.gold')}</span>
                <span class={styles.rewardValue}>+{rewards.gold}</span>
              </div>
              <div class={styles.rewardItem}>
                <DamageIcon size={18} className={styles.rewardIcon} />
                <span class={styles.rewardLabel}>{t('pvp.rewards.honor')}</span>
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
                    <span class={styles.rewardLabel}>{t('pvp.rewards.artifact')}</span>
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
            {t('pvp.actions.close')}
          </Button>
          <Button variant="skill" onClick={handleWatchReplay}>
            🎬 {t('pvp.actions.watchReplay')}
          </Button>
        </div>
      </div>
    </div>
  );
}
