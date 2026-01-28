/**
 * ColonyTerminal - Main sci-fi terminal UI for colony management
 * Full-screen overlay with building grid, stats, and claim functionality
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  colonySceneVisible,
  hideColonyScene,
  idleRewardsState,
  idleRewardsError,
  idleRewardsLoading,
  hasPendingRewards,
  claimIdleRewards,
  claimingRewards,
  upgradeColony,
  upgradingColony,
  totalColonyGoldPerHour,
  formatIdleTime,
  checkIdleRewards,
} from '../../state/idle.signals';
import { baseGold, baseDust } from '../../state/profile.signals';
import { formatNumber } from '../../utils/formatters';
import { GlitchText } from './effects';
import { BuildingCard } from './BuildingCard';
import { GoldIcon } from '../icons/GoldIcon';
import { DustIcon } from '../icons/DustIcon';
import styles from './ColonyTerminal.module.css';

export function ColonyTerminal() {
  const isVisible = colonySceneVisible.value;
  const state = idleRewardsState.value;
  const error = idleRewardsError.value;
  const isLoading = idleRewardsLoading.value;
  const colonies = state?.colonies ?? [];
  const isClaiming = claimingRewards.value;
  const currentUpgrading = upgradingColony.value;
  const canClaim = hasPendingRewards.value;

  const handleUpgrade = async (colonyId: string): Promise<boolean> => {
    return await upgradeColony(colonyId);
  };

  const handleClaim = async () => {
    await claimIdleRewards();
  };

  const handleBack = () => {
    hideColonyScene();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={styles.terminal}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Header */}
          <header className={styles.header}>
            <motion.button
              className={styles.backBtn}
              whileTap={{ scale: 0.95 }}
              onClick={handleBack}
            >
              <span>&larr;</span> Back
            </motion.button>

            <div className={styles.title}>
              <GlitchText active={false}>COLONY HQ</GlitchText>
            </div>

            <div className={styles.resources}>
              <div className={styles.resourceItem}>
                <GoldIcon size={18} />
                <span className={styles.value}>{formatNumber(baseGold.value)}</span>
              </div>
              <div className={styles.resourceItem}>
                <DustIcon size={18} />
                <span className={styles.value}>{formatNumber(baseDust.value)}</span>
              </div>
            </div>

            <motion.button
              className={styles.claimBtn}
              whileTap={{ scale: 0.95 }}
              onClick={handleClaim}
              disabled={!canClaim || isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'Claim Rewards'}
            </motion.button>
          </header>

          {/* Stats Bar */}
          {state && (
            <div className={styles.statsBar}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Production</span>
                <span className={`${styles.statValue} ${styles.gold}`}>
                  {formatNumber(totalColonyGoldPerHour.value)}/h
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Pending Gold</span>
                <span className={`${styles.statValue} ${styles.gold}`}>
                  +{formatNumber(state.pendingGold)}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Time Offline</span>
                <span className={styles.statValue}>
                  {formatIdleTime(state.hoursOffline)}
                  {state.cappedHours < state.hoursOffline && ' (capped)'}
                </span>
              </div>
              {state.pendingDust > 0 && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Pending Dust</span>
                  <span className={styles.statValue}>+{state.pendingDust}</span>
                </div>
              )}
            </div>
          )}

          {/* Building Grid */}
          {error ? (
            <div className={styles.errorState}>
              <GlitchText active>ERROR</GlitchText>
              <div className={styles.errorMessage}>{error}</div>
              <motion.button
                className={styles.retryBtn}
                whileTap={{ scale: 0.95 }}
                onClick={() => checkIdleRewards()}
              >
                Retry
              </motion.button>
            </div>
          ) : !state || isLoading ? (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} />
              <div className={styles.loadingText}>Loading Colonies...</div>
            </div>
          ) : colonies.length === 0 ? (
            <div className={styles.emptyState}>
              <GlitchText active>No colonies available</GlitchText>
            </div>
          ) : (
            <div className={styles.grid}>
              {colonies.map((colony) => (
                <BuildingCard
                  key={colony.id}
                  colony={colony}
                  onUpgrade={handleUpgrade}
                  isUpgrading={currentUpgrading === colony.id}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
