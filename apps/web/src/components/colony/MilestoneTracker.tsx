/**
 * MilestoneTracker - Progress bar showing milestone progress
 * Displays current production and progress to next milestone
 */
import { motion } from 'framer-motion';
import { milestonesState, totalColonyGoldPerHour } from '../../state/idle.signals';
import { formatNumber } from '../../utils/formatters';
import styles from './MilestoneTracker.module.css';

export function MilestoneTracker() {
  const state = milestonesState.value;
  const goldPerHour = totalColonyGoldPerHour.value;

  if (!state) return null;

  const { nextMilestone, progress } = state;

  // All milestones completed
  if (!nextMilestone) {
    return (
      <div className={styles.tracker}>
        <div className={styles.label}>
          <span className={styles.milestone}>All Milestones Complete!</span>
          <span className={styles.production}>{formatNumber(goldPerHour)} gold/h</span>
        </div>
        <div className={styles.progressBar}>
          <motion.div
            className={`${styles.fill} ${styles.complete}`}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
          />
        </div>
      </div>
    );
  }

  const progressPercent = progress !== null ? Math.min(progress * 100, 100) : 0;

  return (
    <div className={styles.tracker}>
      <div className={styles.label}>
        <span className={styles.milestone}>
          Next: <strong>{nextMilestone.name}</strong>
        </span>
        <span className={styles.production}>
          {formatNumber(goldPerHour)} / {formatNumber(nextMilestone.requirement)} gold/h
        </span>
      </div>
      <div className={styles.progressBar}>
        <motion.div
          className={styles.fill}
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <div className={styles.percentage}>{Math.floor(progressPercent)}%</div>
    </div>
  );
}
