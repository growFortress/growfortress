/**
 * LevelBar Component
 *
 * Displays player level with XP progress bar.
 */

import { ProgressBar } from '../shared/ProgressBar.js';
import { unifiedLevel, unifiedXpProgress } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './LevelBar.module.css';

interface LevelBarProps {
  className?: string;
  compact?: boolean;
}

export function LevelBar({ className = '', compact = false }: LevelBarProps) {
  const { t } = useTranslation(['common']);
  const level = unifiedLevel.value;
  const xpPercent = unifiedXpProgress.value;

  const containerClasses = [
    styles.container,
    className,
    compact && styles.compact,
  ].filter(Boolean).join(' ');

  return (
    <div class={containerClasses} title={t('common:labels.level')}>
      {/* Level icon and number */}
      <div class={styles.iconSection}>
        <span class={styles.icon}>⭐</span>
        <div class={styles.values}>
          <span class={styles.levelLabel}>{t('common:labels.lv')}</span>
          <span class={styles.levelNumber}>{level}</span>
        </div>
      </div>

      {/* XP Progress bar */}
      <div class={styles.barSection}>
        <ProgressBar
          percent={xpPercent}
          variant="xp"
          size={compact ? 'xs' : 'sm'}
          glow={true}
          ariaLabel={`${t('common:labels.level')} ${level}, ${Math.round(xpPercent)}% ${t('common:resources.xp')}`}
        />
      </div>
    </div>
  );
}
