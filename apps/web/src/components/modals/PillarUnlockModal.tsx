/**
 * PillarUnlockModal Component
 *
 * Shows world/pillar progression with unlock requirements.
 * Part of the level-gated world progression system.
 */

import { Modal } from '../shared/Modal.js';
import { ProgressBar } from '../shared/ProgressBar.js';
import {
  allPillars,
  unlockedCount,
  totalPillars,
  unlockProgress,
  pillarUnlocksLoading,
  pillarUnlocksError,
  fetchPillarUnlocks,
  currentFortressLevel,
} from '../../state/pillarUnlocks.signals.js';
import { PILLAR_INFO } from '../../state/index.js';
import type { PillarUnlockInfo } from '@arcade/protocol';
import styles from './PillarUnlockModal.module.css';
import { useEffect } from 'preact/hooks';

interface PillarUnlockModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PillarUnlockModal({ visible, onClose }: PillarUnlockModalProps) {
  // Fetch pillar unlocks when modal opens
  useEffect(() => {
    if (visible) {
      fetchPillarUnlocks();
    }
  }, [visible]);

  const isLoading = pillarUnlocksLoading.value;
  const error = pillarUnlocksError.value;
  const pillars = allPillars.value;
  const fortressLevel = currentFortressLevel.value;

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title="Eksploracja Światów"
      size="large"
    >
      {/* Progress section */}
      <div class={styles.progressSection}>
        <div class={styles.progressInfo}>
          <span class={styles.progressLabel}>Odblokowane światy</span>
          <span class={styles.progressValue}>
            {unlockedCount.value} / {totalPillars.value}
          </span>
        </div>
        <div class={styles.progressBar}>
          <ProgressBar
            percent={unlockProgress.value}
            variant="primary"
            size="md"
            glow
            ariaLabel={`${unlockedCount.value} z ${totalPillars.value} światów odblokowanych`}
          />
        </div>
        <div class={styles.levelDisplay}>
          <span class={styles.levelLabel}>Twój poziom:</span>
          <span class={styles.levelValue}>Lv. {fortressLevel}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div class={styles.error}>{error}</div>
      )}

      {/* Loading state */}
      {isLoading && pillars.length === 0 ? (
        <div class={styles.loading}>Ładowanie...</div>
      ) : (
        /* Pillar list */
        <div class={styles.pillarList}>
          {pillars.map((pillar) => (
            <PillarCard
              key={pillar.pillarId}
              pillar={pillar}
              fortressLevel={fortressLevel}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

// Individual pillar card
interface PillarCardProps {
  pillar: PillarUnlockInfo;
  fortressLevel: number;
}

function PillarCard({ pillar, fortressLevel }: PillarCardProps) {
  const info = PILLAR_INFO[pillar.pillarId];
  const levelMet = fortressLevel >= pillar.requiredLevel;

  const cardClasses = [
    styles.pillarCard,
    pillar.isUnlocked && styles.unlocked,
    !pillar.isUnlocked && levelMet && styles.available,
    !pillar.isUnlocked && !levelMet && styles.locked,
  ].filter(Boolean).join(' ');

  return (
    <div class={cardClasses}>
      {/* Pillar icon */}
      <div class={styles.pillarIcon}>
        {info?.icon || '🎮'}
      </div>

      {/* Pillar info */}
      <div class={styles.pillarInfo}>
        <h3 class={styles.pillarName}>{info?.name || pillar.pillarId}</h3>
        <p class={styles.pillarDescription}>
          {pillar.isUnlocked
            ? 'Odblokowany - możesz grać!'
            : `Wymagany poziom ${pillar.requiredLevel}`}
        </p>
      </div>

      {/* Requirements / Status */}
      <div class={styles.requirements}>
        {pillar.isUnlocked ? (
          <span class={styles.unlockedBadge}>
            ✓ Odblokowany
          </span>
        ) : (
          <div class={`${styles.requirement} ${levelMet ? styles.met : styles.notMet}`}>
            <span class={styles.requirementIcon}>{levelMet ? '✓' : '✗'}</span>
            <span>Lv. {pillar.requiredLevel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
