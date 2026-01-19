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
import styles from './EnergyBar.module.css';

interface EnergyBarProps {
  className?: string;
  compact?: boolean;
}

export function EnergyBar({ className = '', compact = false }: EnergyBarProps) {
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
    <div class={containerClasses} title="Energy">
      {/* Icon and count */}
      <div class={styles.iconSection}>
        <span class={styles.icon}>⚡</span>
        <div class={styles.values}>
          <span class={styles.energyCount}>
            {currentEnergy.value}/{maxEnergy.value}
          </span>
          {!isFull && regenText && (
            <span class={styles.regenTime}>+1 in {regenText}</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div class={styles.barSection}>
        <ProgressBar
          percent={energyPercent.value}
          variant="energy"
          size={compact ? 'xs' : 'sm'}
          pulseWhenFull={true}
          ariaLabel={`Energy: ${currentEnergy.value} of ${maxEnergy.value}`}
        />
      </div>

      {/* Refill button or full badge */}
      <div class={styles.refillSection}>
        {isFull ? (
          <span class={styles.fullBadge}>Full</span>
        ) : (
          <button
            class={`${styles.refillButton} ${isRefilling ? styles.loading : ''}`}
            onClick={handleRefill}
            disabled={!canRefill.value || isRefilling}
            title={`Refill energy for ${refillCost.value} dust`}
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
