/**
 * BuildingCard - Colony building card with sci-fi effects
 * Displays building stats with hologram overlay and upgrade animations
 */
import { useState } from 'preact/hooks';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { GlitchText, HologramOverlay, EnergyBurst } from './effects';
import { formatNumber } from '../../utils/formatters';
import type { ColonyStatus } from '@arcade/protocol';
import styles from './ColonyTerminal.module.css';

interface BuildingCardProps {
  colony: ColonyStatus;
  onUpgrade: (colonyId: string) => Promise<boolean>;
  isUpgrading: boolean;
}

export function BuildingCard({ colony, onUpgrade, isUpgrading }: BuildingCardProps) {
  const [showHologram, setShowHologram] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  const handleUpgrade = async () => {
    if (isUpgrading || !colony.canUpgrade) return;

    const success = await onUpgrade(colony.id);
    if (success) {
      setShowBurst(true);
    }
  };

  const isMaxLevel = colony.level >= colony.maxLevel;

  // Locked building
  if (!colony.unlocked) {
    return (
      <motion.div
        className={cn(styles.card, styles.locked)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.cardHeader}>
          <div className={styles.buildingIcon}>{colony.icon}</div>
          <div className={styles.cardInfo}>
            <div className={styles.buildingName}>{colony.name}</div>
            <div className={styles.buildingLevel}>Locked</div>
          </div>
        </div>

        <div className={styles.lockedOverlay}>
          <GlitchText active className={styles.lockedText}>
            LOCKED
          </GlitchText>
          <div className={styles.unlockRequirement}>
            Commander Level <span>{colony.unlockLevel}</span> required
          </div>
        </div>
      </motion.div>
    );
  }

  // Calculate next level bonus (approximate)
  const nextLevelBonus = colony.level > 0 ? Math.floor(colony.goldPerHour * 0.15) : colony.goldPerHour;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      onHoverStart={() => setShowHologram(true)}
      onHoverEnd={() => setShowHologram(false)}
    >
      {/* Header */}
      <div className={styles.cardHeader}>
        <div className={styles.buildingIcon}>{colony.icon}</div>
        <div className={styles.cardInfo}>
          <div className={styles.buildingName}>{colony.name}</div>
          <div className={styles.buildingLevel}>
            Level <span>{colony.level}</span>
            {isMaxLevel && ' (MAX)'}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.cardStats}>
        <div className={styles.cardStatRow}>
          <span className={styles.label}>Production</span>
          <span className={cn(styles.value, styles.gold)}>
            {formatNumber(colony.goldPerHour)}/h
          </span>
        </div>
        {!isMaxLevel && (
          <div className={styles.cardStatRow}>
            <span className={styles.label}>Next Level</span>
            <span className={styles.value}>+{formatNumber(nextLevelBonus)}/h</span>
          </div>
        )}
      </div>

      {/* Hologram Overlay */}
      <HologramOverlay
        visible={showHologram && !showBurst}
        stats={{
          goldPerHour: colony.goldPerHour,
          level: colony.level,
          nextLevelBonus: isMaxLevel ? undefined : nextLevelBonus,
        }}
      />

      {/* Upgrade Button */}
      {isMaxLevel ? (
        <button className={cn(styles.upgradeBtn, styles.maxLevel)} disabled>
          MAX LEVEL
        </button>
      ) : (
        <motion.button
          className={styles.upgradeBtn}
          whileTap={{ scale: 0.95 }}
          onClick={handleUpgrade}
          disabled={!colony.canUpgrade || isUpgrading}
        >
          {isUpgrading ? (
            'Upgrading...'
          ) : colony.canUpgrade ? (
            <>
              Upgrade <span>{formatNumber(colony.upgradeCost)}g</span>
            </>
          ) : (
            <>
              Need <span>{formatNumber(colony.upgradeCost)}g</span>
            </>
          )}
        </motion.button>
      )}

      {/* Energy Burst Effect */}
      <EnergyBurst trigger={showBurst} onComplete={() => setShowBurst(false)} />
    </motion.div>
  );
}
