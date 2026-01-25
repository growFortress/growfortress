/**
 * MilestonePopup - Notification when milestone is achieved
 * Appears when a milestone becomes claimable
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  milestoneNotification,
  claimMilestone,
  dismissMilestoneNotification,
  claimingMilestone,
} from '../../state/idle.signals';
import { GlitchText } from './effects';
import { formatNumber } from '../../utils/formatters';
import styles from './MilestonePopup.module.css';

export function MilestonePopup() {
  const milestone = milestoneNotification.value;
  const isClaiming = claimingMilestone.value === milestone?.id;

  const handleClaim = async () => {
    if (milestone) {
      await claimMilestone(milestone.id);
    }
  };

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          className={styles.popup}
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className={styles.header}>
            <span className={styles.icon}>&#127942;</span>
            <GlitchText active className={styles.title}>
              MILESTONE ACHIEVED!
            </GlitchText>
          </div>

          <div className={styles.content}>
            <div className={styles.milestoneName}>{milestone.name}</div>
            <div className={styles.milestoneDesc}>{milestone.description}</div>

            <div className={styles.reward}>
              <span className={styles.rewardLabel}>Reward:</span>
              <div className={styles.rewardItems}>
                {milestone.reward.gold && (
                  <span className={styles.rewardItem}>
                    <span className={styles.rewardIcon}>&#129689;</span>
                    {formatNumber(milestone.reward.gold)}
                  </span>
                )}
                {milestone.reward.dust && (
                  <span className={styles.rewardItem}>
                    <span className={styles.rewardIcon}>&#128142;</span>
                    {milestone.reward.dust}
                  </span>
                )}
                {milestone.reward.material && (
                  <span className={styles.rewardItem}>
                    <span className={styles.rewardIcon}>&#128163;</span>
                    {milestone.reward.material} material
                  </span>
                )}
                {milestone.reward.unlock && (
                  <span className={styles.rewardItem}>
                    <span className={styles.rewardIcon}>&#128275;</span>
                    Unlock: {milestone.reward.unlock}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <motion.button
              className={styles.dismissBtn}
              whileTap={{ scale: 0.95 }}
              onClick={dismissMilestoneNotification}
            >
              Later
            </motion.button>
            <motion.button
              className={styles.claimBtn}
              whileTap={{ scale: 0.95 }}
              onClick={handleClaim}
              disabled={isClaiming}
            >
              {isClaiming ? 'Claiming...' : 'CLAIM'}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
