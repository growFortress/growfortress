/**
 * HologramOverlay - Holographic stats display on hover
 * Shows building statistics with sci-fi hologram effect
 */
import { AnimatePresence, motion } from 'framer-motion';
import styles from './effects.module.css';

interface HologramStats {
  goldPerHour: number;
  pendingGold?: number;
  level?: number;
  nextLevelBonus?: number;
}

interface HologramOverlayProps {
  visible: boolean;
  stats: HologramStats;
}

export function HologramOverlay({ visible, stats }: HologramOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={styles.hologram}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <div className={styles.hologramScanline} />
          <div className={styles.hologramStats}>
            <div>
              <span>Production:</span>
              <span>{stats.goldPerHour}/h</span>
            </div>
            {stats.pendingGold !== undefined && stats.pendingGold > 0 && (
              <div>
                <span>Pending:</span>
                <span>+{stats.pendingGold}</span>
              </div>
            )}
            {stats.nextLevelBonus !== undefined && (
              <div>
                <span>Next Level:</span>
                <span>+{stats.nextLevelBonus}/h</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
