import {
  getUpgradeCost,
  getStatBonusPercent,
  type StatUpgradeConfig,
} from '@arcade/sim-core';
import { GoldIcon } from '../icons/index.js';
import styles from './StatUpgradeRow.module.css';

// Stat icons
const STAT_ICONS: Record<string, string> = {
  hp: '❤️',
  damage: '⚔️',
  attackSpeed: '⚡',
  range: '🎯',
  critChance: '💥',
  critMultiplier: '💀',
  armor: '🛡️',
  dodge: '💨',
};

interface StatUpgradeRowProps {
  config: StatUpgradeConfig;
  currentLevel: number;
  gold: number;
  onUpgrade: () => Promise<void>;
  isLoading: boolean;
}

export function StatUpgradeRow({ config, currentLevel, gold, onUpgrade, isLoading }: StatUpgradeRowProps) {
  const cost = getUpgradeCost(config, currentLevel);
  const canAfford = gold >= cost && currentLevel < config.maxLevel;
  const isMaxed = currentLevel >= config.maxLevel;
  const bonusPercent = getStatBonusPercent(config, currentLevel).toFixed(1);
  const nextBonusPercent = getStatBonusPercent(config, currentLevel + 1).toFixed(1);

  return (
    <div class={styles.statRow}>
      <div class={styles.statInfo}>
        <span class={styles.statIcon}>{STAT_ICONS[config.stat] || '📊'}</span>
        <div class={styles.statDetails}>
          <span class={styles.statName}>{config.name}</span>
          <span class={styles.statDesc}>{config.description}</span>
        </div>
      </div>

      <div class={styles.statFooter}>
        <div class={styles.statProgress}>
          <span class={styles.statLevel}>
            Lv {currentLevel}{config.maxLevel !== Infinity && `/${config.maxLevel}`}
          </span>
          <div class={styles.statBonusContainer}>
            <span class={styles.statBonus}>+{bonusPercent}%</span>
            {!isMaxed && (
              <span class={styles.statNext}>→ +{nextBonusPercent}%</span>
            )}
          </div>
        </div>

        <div class={styles.statAction}>
          {isMaxed ? (
            <span class={styles.maxLabel}>Max</span>
          ) : (
            <button
              class={styles.upgradeBtn}
              disabled={!canAfford || isLoading}
              onClick={onUpgrade}
            >
              {isLoading ? '...' : (
                <>
                  <span>{cost}</span>
                  <GoldIcon size={11} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
