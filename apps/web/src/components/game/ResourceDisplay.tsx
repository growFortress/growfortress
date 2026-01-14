import { displayGold, displayDust } from '../../state/index.js';
import styles from './ResourceDisplay.module.css';

interface ResourceDisplayProps {
  className?: string;
  compact?: boolean;
}

export function ResourceDisplay({ className = '', compact = false }: ResourceDisplayProps) {
  return (
    <div class={`${styles.container} ${className} ${compact ? styles.compact : ''}`}>
      <div class={styles.resource} title="Gold">
        <span class={styles.icon}>💰</span>
        <span class={styles.value}>{displayGold.value}</span>
      </div>
      <div class={styles.resource} title="Dust">
        <span class={styles.icon}>✨</span>
        <span class={styles.value}>{displayDust.value}</span>
      </div>
    </div>
  );
}
