/**
 * Stat Points Indicator
 *
 * Compact HUD indicator showing available free stat points.
 * Displayed near the level bar when the player has points to spend.
 */

import { hasAvailableStatPoints, availableStatPoints } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './StatPointsIndicator.module.css';

interface StatPointsIndicatorProps {
  onClick?: () => void;
}

export function StatPointsIndicator({ onClick }: StatPointsIndicatorProps) {
  const { t } = useTranslation('game');
  const hasPoints = hasAvailableStatPoints.value;
  const points = availableStatPoints.value;

  // Debug log
  console.log('[StatPointsIndicator] hasPoints:', hasPoints, 'points:', points);

  if (!hasPoints) return null;

  return (
    <button
      class={styles.indicator}
      onClick={onClick}
      aria-label={t('statPoints.indicatorAria', { count: points })}
      type="button"
    >
      <span class={styles.icon}>+</span>
      <span class={styles.count}>{points}</span>
      <span class={styles.label}>{t('statPoints.freePoints')}</span>
    </button>
  );
}
