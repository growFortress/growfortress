import { displayGold, displayDust } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './ResourceDisplay.module.css';

interface ResourceDisplayProps {
  className?: string;
  compact?: boolean;
}

export function ResourceDisplay({ className = '', compact = false }: ResourceDisplayProps) {
  const { t } = useTranslation('common');
  return (
    <div class={`${styles.container} ${className} ${compact ? styles.compact : ''}`}>
      <div class={styles.resource} title={t('resources.gold')}>
        <span class={styles.icon}>🪙</span>
        <span class={styles.value}>{displayGold.value}</span>
      </div>
      <div class={styles.resource} title={t('resources.dust')}>
        <span class={styles.icon}>🌫️</span>
        <span class={styles.value}>{displayDust.value}</span>
      </div>
    </div>
  );
}
