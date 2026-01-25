/**
 * PrestigeModal - Stellar Rebirth confirmation modal
 * Epic animation when performing prestige
 */
import { AnimatePresence, motion } from 'framer-motion';
import {
  prestigeState,
  prestigeModalVisible,
  hidePrestigeModal,
  performPrestige,
  performingPrestige,
} from '../../state/idle.signals';
import { GlitchText } from './effects';
import styles from './PrestigeModal.module.css';

export function PrestigeModal() {
  const isVisible = prestigeModalVisible.value;
  const state = prestigeState.value;
  const isPerforming = performingPrestige.value;

  if (!state) return null;

  const handleConfirm = async () => {
    await performPrestige();
  };

  const currentBonusPercent = Math.round(state.currentBonus * 100);
  const newBonusPercent = Math.round(
    (state.currentBonus + (state.pendingStellarPoints > 0 ? 0.05 : 0)) * 100
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isPerforming && hidePrestigeModal()}
        >
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.header}>
              <h2 className={styles.title}>
                <GlitchText active>STELLAR REBIRTH</GlitchText>
              </h2>
              <p className={styles.subtitle}>
                Reset your colonies to earn Stellar Points
              </p>
            </div>

            {/* Preview */}
            <div className={styles.preview}>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>You will earn</span>
                <span className={styles.previewValue}>
                  +{state.pendingStellarPoints} <span className={styles.sp}>SP</span>
                </span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Production Bonus</span>
                <span className={styles.previewValue}>
                  {currentBonusPercent}% &rarr; {newBonusPercent}%
                </span>
              </div>
              <div className={styles.previewItem}>
                <span className={styles.previewLabel}>Total Stellar Points</span>
                <span className={styles.previewValue}>
                  {state.stellarPoints} + {state.pendingStellarPoints} = {state.stellarPoints + state.pendingStellarPoints}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className={styles.warning}>
              <span className={styles.warningIcon}>&#9888;</span>
              All colony buildings will be reset to level 0
            </div>

            {/* Unlocks preview */}
            {state.unlocks.length > 0 && (
              <div className={styles.unlocks}>
                <span className={styles.unlocksLabel}>Active Unlocks:</span>
                <div className={styles.unlocksList}>
                  {state.unlocks.map((unlock) => (
                    <span key={unlock} className={styles.unlockBadge}>
                      {unlock.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className={styles.actions}>
              <motion.button
                className={styles.cancelBtn}
                whileTap={{ scale: 0.95 }}
                onClick={() => hidePrestigeModal()}
                disabled={isPerforming}
              >
                Cancel
              </motion.button>
              <motion.button
                className={styles.confirmBtn}
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirm}
                disabled={isPerforming || state.pendingStellarPoints <= 0}
              >
                {isPerforming ? 'Rebirthing...' : 'REBIRTH'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
