/**
 * Free Stat Row
 *
 * A row component for allocating free stat points.
 * Similar to StatUpgradeRow but shows "FREE" instead of gold cost,
 * and includes +/- buttons for allocation control.
 */

import {
  HpIcon,
  DamageIcon,
  SpeedIcon,
  CritChanceIcon,
  ArmorIcon
} from '../icons/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './FreeStatRow.module.css';

// Stat icon mapping
function getStatIcon(stat: string, size: number = 24, className: string = '') {
  switch (stat) {
    case 'hp':
      return <HpIcon size={size} className={className} />;
    case 'damage':
      return <DamageIcon size={size} className={className} />;
    case 'attackSpeed':
      return <SpeedIcon size={size} className={className} />;
    case 'critChance':
      return <CritChanceIcon size={size} className={className} />;
    case 'armor':
      return <ArmorIcon size={size} className={className} />;
    default:
      return <span>+</span>;
  }
}

export interface FreeStatRowProps {
  stat: string;
  name: string;
  description: string;
  currentAllocation: number;
  maxAllocation: number;
  bonusPerPoint: number;
  availablePoints: number;
  onAllocate: (points: number) => void;
  isLoading?: boolean;
}

export function FreeStatRow({
  stat,
  name,
  description,
  currentAllocation,
  maxAllocation,
  bonusPerPoint,
  availablePoints,
  onAllocate,
  isLoading = false,
}: FreeStatRowProps) {
  const { t } = useTranslation('game');

  const currentBonus = (currentAllocation * bonusPerPoint * 100).toFixed(1);
  const isMaxed = currentAllocation >= maxAllocation;
  const canAdd = !isMaxed && availablePoints > 0;
  const canRemove = currentAllocation > 0;

  const handleAdd = (amount: number) => {
    const maxCanAdd = Math.min(amount, maxAllocation - currentAllocation, availablePoints);
    if (maxCanAdd > 0) {
      onAllocate(maxCanAdd);
    }
  };

  const handleRemove = (amount: number) => {
    const maxCanRemove = Math.min(amount, currentAllocation);
    if (maxCanRemove > 0) {
      onAllocate(-maxCanRemove);
    }
  };

  return (
    <div class={styles.statRow}>
      <div class={styles.statInfo}>
        <span class={styles.statIcon}>{getStatIcon(stat, 24, styles.icon)}</span>
        <div class={styles.statDetails}>
          <span class={styles.statName}>{name}</span>
          <span class={styles.statDesc}>{description}</span>
        </div>
      </div>

      <div class={styles.statFooter}>
        <div class={styles.allocationInfo}>
          <span class={styles.allocationCount}>
            {currentAllocation}
            <span class={styles.allocationMax}>/{maxAllocation}</span>
          </span>
          <span class={styles.bonusValue}>+{currentBonus}%</span>
        </div>

        <div class={styles.controls}>
          {isMaxed ? (
            <span class={styles.maxLabel}>{t('statPoints.maxReached')}</span>
          ) : (
            <>
              <button
                class={styles.controlBtn}
                disabled={!canRemove || isLoading}
                onClick={() => handleRemove(1)}
                aria-label={t('statPoints.removeSingle')}
                type="button"
              >
                -
              </button>
              <button
                class={styles.controlBtn}
                disabled={!canAdd || isLoading}
                onClick={() => handleAdd(1)}
                aria-label={t('statPoints.addSingle')}
                type="button"
              >
                +
              </button>
              <button
                class={`${styles.controlBtn} ${styles.batchBtn}`}
                disabled={!canAdd || isLoading}
                onClick={() => handleAdd(5)}
                aria-label={t('statPoints.addBatch', { count: 5 })}
                type="button"
              >
                +5
              </button>
              <button
                class={`${styles.controlBtn} ${styles.maxBtn}`}
                disabled={!canAdd || isLoading}
                onClick={() => handleAdd(maxAllocation - currentAllocation)}
                aria-label={t('statPoints.addMax')}
                type="button"
              >
                {t('statPoints.max')}
              </button>
            </>
          )}
          <span class={styles.freeBadge}>{t('statPoints.free')}</span>
        </div>
      </div>
    </div>
  );
}
