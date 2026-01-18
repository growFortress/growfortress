/**
 * PillarUnlockModal Component
 *
 * Shows world/pillar progression with unlock requirements and purchase options.
 * Part of the dust-gated world progression system.
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
  unlockingPillar,
  unlockPillarAction,
  fetchPillarUnlocks,
  currentFortressLevel,
} from '../../state/pillarUnlocks.signals.js';
import { baseDust, PILLAR_INFO } from '../../state/index.js';
import type { PillarUnlockId, PillarUnlockInfo } from '@arcade/protocol';
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
  const unlocking = unlockingPillar.value;
  const fortressLevel = currentFortressLevel.value;
  const dust = baseDust.value;

  const handleUnlock = async (pillarId: PillarUnlockId) => {
    await unlockPillarAction(pillarId);
  };

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
        <div class={styles.dustDisplay}>
          <span class={styles.dustLabel}>Dust:</span>
          <span class={styles.dustValue}>✨ {dust}</span>
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
              currentDust={dust}
              isUnlocking={unlocking === pillar.pillarId}
              onUnlock={() => handleUnlock(pillar.pillarId)}
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
  currentDust: number;
  isUnlocking: boolean;
  onUnlock: () => void;
}

function PillarCard({ pillar, fortressLevel, currentDust, isUnlocking, onUnlock }: PillarCardProps) {
  const info = PILLAR_INFO[pillar.pillarId];
  const levelMet = fortressLevel >= pillar.fortressLevel;
  const dustMet = currentDust >= pillar.dustCost;

  const cardClasses = [
    styles.pillarCard,
    pillar.isUnlocked && styles.unlocked,
    !pillar.isUnlocked && pillar.canUnlock && styles.available,
    !pillar.isUnlocked && !pillar.canUnlock && styles.locked,
  ].filter(Boolean).join(' ');

  return (
    <div class={cardClasses}>
      {/* Pillar icon */}
      <div class={styles.pillarIcon}>
        {info?.icon || '🎮'}
      </div>

      {/* Pillar info */}
      <div class={styles.pillarInfo}>
        <h3 class={styles.pillarName}>{pillar.name}</h3>
        <p class={styles.pillarDescription}>
          {pillar.isUnlocked
            ? 'Odblokowany - możesz grać!'
            : pillar.reason || `Wymagany poziom ${pillar.fortressLevel}`}
        </p>
      </div>

      {/* Requirements / Status */}
      <div class={styles.requirements}>
        {pillar.isUnlocked ? (
          <span class={styles.unlockedBadge}>
            ✓ Odblokowany
          </span>
        ) : (
          <>
            {/* Level requirement */}
            <div class={`${styles.requirement} ${levelMet ? styles.met : styles.notMet}`}>
              <span class={styles.requirementIcon}>{levelMet ? '✓' : '✗'}</span>
              <span>Lv. {pillar.fortressLevel}</span>
            </div>

            {/* Dust requirement */}
            {pillar.dustCost > 0 && (
              <div class={`${styles.requirement} ${dustMet ? styles.met : styles.notMet}`}>
                <span class={styles.requirementIcon}>{dustMet ? '✓' : '✗'}</span>
                <span>✨ {pillar.dustCost}</span>
              </div>
            )}

            {/* Unlock button */}
            {pillar.canUnlock && (
              <button
                class={`${styles.unlockButton} ${isUnlocking ? styles.loading : ''}`}
                onClick={onUnlock}
                disabled={isUnlocking}
                title={`Odblokuj za ${pillar.dustCost} dust`}
              >
                {isUnlocking ? 'Odblokowuję...' : (
                  <span class={styles.unlockCost}>
                    <span class={styles.dustIcon}>✨</span>
                    {pillar.dustCost}
                  </span>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
