import {
  getUpgradeCost,
  getStatBonusPercent,
  type StatUpgradeConfig,
} from '@arcade/sim-core';
import { 
  GoldIcon, 
  HpIcon, 
  DamageIcon, 
  SpeedIcon, 
  RangeIcon, 
  CritChanceIcon, 
  CritMultiplierIcon, 
  ArmorIcon, 
  DodgeIcon 
} from '../icons/index.js';
import styles from './StatUpgradeRow.module.css';

// Stat icon components mapping
function getStatIcon(stat: string, size: number = 24, className: string = '') {
  switch (stat) {
    case 'hp':
      return <HpIcon size={size} className={className} />;
    case 'damage':
      return <DamageIcon size={size} className={className} />;
    case 'attackSpeed':
      return <SpeedIcon size={size} className={className} />;
    case 'range':
      return <RangeIcon size={size} className={className} />;
    case 'critChance':
      return <CritChanceIcon size={size} className={className} />;
    case 'critMultiplier':
      return <CritMultiplierIcon size={size} className={className} />;
    case 'armor':
      return <ArmorIcon size={size} className={className} />;
    case 'dodge':
      return <DodgeIcon size={size} className={className} />;
    default:
      return <span>📊</span>;
  }
}

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
        <span class={styles.statIcon}>{getStatIcon(config.stat, 24, styles.statIcon)}</span>
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
