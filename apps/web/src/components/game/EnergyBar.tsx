/**
 * EnergyBar Component
 *
 * Displays player energy status with regeneration timer and refill option.
 * Part of the premium economy system.
 */

import { ProgressBar } from '../shared/ProgressBar.js';
import {
  currentEnergy,
  maxEnergy,
  energyPercent,
  hasEnergy,
  isEnergyFull,
  canRefill,
  nextRegenIn,
  refillCost,
  refilling,
  refillEnergyAction,
} from '../../state/energy.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './EnergyBar.module.css';

interface EnergyBarProps {
  className?: string;
  compact?: boolean;
}

export function EnergyBar({ className = '', compact = false }: EnergyBarProps) {
  const { t } = useTranslation('game');
  const isFull = isEnergyFull.value;
  const hasNoEnergy = !hasEnergy.value;
  const isRefilling = refilling.value;
  const regenText = nextRegenIn.value;

  const handleRefill = async () => {
    await refillEnergyAction();
  };

  const containerClasses = [
    styles.container,
    className,
    compact && styles.compact,
    isFull && styles.full,
    hasNoEnergy && styles.noEnergy,
  ].filter(Boolean).join(' ');

  return (
    <div class={containerClasses} title={t('header.energy.label')}>
      {/* Icon and count */}
      <div class={styles.iconSection}>
        <span class={styles.icon}>🔋</span>
        <div class={styles.values}>
          <span class={styles.energyCount}>
            {currentEnergy.value}/{maxEnergy.value}
          </span>
          {/* Hide regen time in compact mode */}
          {!compact && !isFull && regenText && (
            <span class={styles.regenTime}>{t('header.energy.regen', { time: regenText })}</span>
          )}
        </div>
      </div>

      {/* Progress bar - smaller in compact mode */}
      <div class={styles.barSection}>
        <ProgressBar
          percent={energyPercent.value}
          variant="energy"
          size={compact ? 'xs' : 'sm'}
          pulseWhenFull={true}
          ariaLabel={t('header.energy.ariaLabel', { current: currentEnergy.value, max: maxEnergy.value })}
        />
      </div>

      {/* Refill button or full badge */}
      <div class={styles.refillSection}>
        {isFull ? (
          <span class={styles.fullBadge}>{t('header.energy.full')}</span>
        ) : (
          <button
            class={`${styles.refillButton} ${isRefilling ? styles.loading : ''}`}
            onClick={handleRefill}
            disabled={!canRefill.value || isRefilling}
            title={t('header.energy.refillTitle', { cost: refillCost.value })}
          >
            <span class={styles.refillCost}>
              <span class={styles.dustIcon}>🌫️</span>
              {refillCost.value}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
