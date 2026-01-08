import { waveProgress } from '../../state/index.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import styles from './WaveProgress.module.css';

export function WaveProgress() {
  return (
    <ProgressBar
      percent={waveProgress.value}
      class={styles.container}
      fillClass={styles.fill}
    />
  );
}
