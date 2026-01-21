/**
 * Power Display Component
 *
 * Shows total Power Level with breakdown categories.
 * Clicking opens the PowerUpgradeModal.
 */

import { formatPower, getPowerColor } from '@arcade/sim-core';
import {
  powerState,
  totalPowerDisplay,
  isPowerLoaded,
  openPowerUpgradeModal,
} from '../../state/power.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './PowerDisplay.module.css';

interface PowerDisplayProps {
  compact?: boolean;
}

export function PowerDisplay({ compact = false }: PowerDisplayProps) {
  const { t } = useTranslation('game');
  const state = powerState.value;
  const loaded = isPowerLoaded.value;
  const powerStr = totalPowerDisplay.value;

  if (!loaded) {
    return (
      <div class={`${styles.container} ${compact ? styles.compact : ''}`}>
        <div class={styles.loading}>...</div>
      </div>
    );
  }

  const colorHex = getPowerColor(state.totalPower).toString(16).padStart(6, '0');

  const handleClick = () => {
    openPowerUpgradeModal('fortress');
  };

  if (compact) {
    return (
      <div
        class={`${styles.container} ${styles.compact}`}
        onClick={handleClick}
        title={t('powerDisplay.openUpgrades')}
      >
        <span class={styles.powerIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </span>
        <span class={styles.powerValue} style={{ color: `#${colorHex}` }}>
          {powerStr}
        </span>
      </div>
    );
  }

  return (
    <div class={styles.container} onClick={handleClick}>
      <div class={styles.header}>
        <span class={styles.powerIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </span>
        <span class={styles.label}>{t('powerDisplay.title')}</span>
      </div>

      <div class={styles.mainValue} style={{ color: `#${colorHex}` }}>
        {powerStr}
      </div>

      <div class={styles.breakdown}>
        <div class={styles.breakdownItem}>
          <span class={styles.breakdownIcon}>🏰</span>
          <span class={styles.breakdownLabel}>{t('powerDisplay.fortress')}</span>
          <span class={styles.breakdownValue}>
            {state.fortressPower ? formatPower(state.fortressPower.totalPower) : '0'}
          </span>
        </div>

        <div class={styles.breakdownItem}>
          <span class={styles.breakdownIcon}>👤</span>
          <span class={styles.breakdownLabel}>{t('powerDisplay.heroes')}</span>
          <span class={styles.breakdownValue}>
            {formatPower(state.heroPower.reduce((sum, hp) => sum + hp.power.totalPower, 0))}
          </span>
        </div>

        <div class={styles.breakdownItem}>
          <span class={styles.breakdownIcon}>🗼</span>
          <span class={styles.breakdownLabel}>{t('powerDisplay.turrets')}</span>
          <span class={styles.breakdownValue}>
            {formatPower(state.turretPower.reduce((sum, tp) => sum + tp.power.totalPower, 0))}
          </span>
        </div>

        <div class={styles.breakdownItem}>
          <span class={styles.breakdownIcon}>💎</span>
          <span class={styles.breakdownLabel}>{t('powerDisplay.items')}</span>
          <span class={styles.breakdownValue}>
            {formatPower(state.itemPower)}
          </span>
        </div>
      </div>

      <div class={styles.hint}>
        {t('powerDisplay.clickToUpgrade')}
      </div>
    </div>
  );
}
