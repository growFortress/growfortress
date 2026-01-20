import { gameState, waveProgress, wavesUntilBoss, nextBossWave } from '../../state/index.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import { Icon } from '../icons/Icon.js';
import styles from './WaveProgress.module.css';

export function WaveProgress() {
  const untilBoss = wavesUntilBoss.value;
  const isBossNow = untilBoss === 0;
  const isBossNext = untilBoss === 1;
  const showBossIndicator = isBossNow || isBossNext;
  const nextBossWaveNumber = nextBossWave.value;
  const currentWave = gameState.value?.wave;
  const bossLabel = isBossNow
    ? `Boss na fali ${currentWave ?? ''}`.trim()
    : `Boss w nastepnej fali ${nextBossWaveNumber ?? ''}`.trim();

  return (
    <div class={styles.wrapper}>
      <ProgressBar
        percent={waveProgress.value}
        class={styles.container}
        fillClass={styles.fill}
      />
      {showBossIndicator && (
        <div
          class={`${styles.bossIndicator} ${isBossNow ? styles.bossNow : styles.bossNext}`}
          title={bossLabel}
          role="img"
          aria-label={bossLabel}
        >
          <Icon name="skull" size={14} class={styles.bossIcon} />
        </div>
      )}
    </div>
  );
}
