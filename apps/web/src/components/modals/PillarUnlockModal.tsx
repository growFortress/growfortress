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
import { PILLAR_INFO, currentPillar, gamePhase, selectPillar } from '../../state/index.js';
import type { PillarUnlockInfo } from '@arcade/protocol';
import styles from './PillarUnlockModal.module.css';
import { useEffect } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';

interface PillarUnlockModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PillarUnlockModal({ visible, onClose }: PillarUnlockModalProps) {
  const { t } = useTranslation(['modals', 'common']);
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
      title={t('pillarUnlock.title')}
      size="large"
    >
      {/* Progress section */}
      <div class={styles.progressSection}>
        <div class={styles.progressInfo}>
          <span class={styles.progressLabel}>{t('pillarUnlock.unlockedWorlds')}</span>
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
            ariaLabel={t('pillarUnlock.progressAria', { unlocked: unlockedCount.value, total: totalPillars.value })}
          />
        </div>
        <div class={styles.levelDisplay}>
          <span class={styles.levelLabel}>{t('pillarUnlock.yourLevel')}</span>
          <span class={styles.levelValue}>{t('pillarUnlock.levelValue', { level: fortressLevel })}</span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div class={styles.error}>{error}</div>
      )}

      {/* Loading state */}
      {isLoading && pillars.length === 0 ? (
        <div class={styles.loading}>{t('common:shared.loading')}</div>
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
  const { t } = useTranslation('modals');
  const info = PILLAR_INFO[pillar.pillarId];
  const levelMet = fortressLevel >= pillar.requiredLevel;
  const isActive = currentPillar.value === pillar.pillarId;
  const canSelect = pillar.isUnlocked && gamePhase.value === 'idle';

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
        {info?.icon || 'P'}
      </div>

      {/* Pillar info */}
      <div class={styles.pillarInfo}>
        <h3 class={styles.pillarName}>{info?.name || pillar.pillarId}</h3>
        <p class={styles.pillarDescription}>
          {pillar.isUnlocked
            ? t('pillarUnlock.unlockedDescription')
            : t('pillarUnlock.requiredLevel', { level: pillar.requiredLevel })}
        </p>
      </div>

      {/* Requirements / Status */}
      <div class={styles.requirements}>
        {pillar.isUnlocked ? (
          isActive ? (
            <span class={styles.activeBadge}>
              {t('pillarUnlock.activeBadge')}
            </span>
          ) : (
            <button
              class={styles.selectButton}
              type="button"
              onClick={() => selectPillar(pillar.pillarId)}
              disabled={!canSelect}
            >
              {t('pillarUnlock.select')}
            </button>
          )
        ) : (
          <div class={`${styles.requirement} ${levelMet ? styles.met : styles.notMet}`}>
            <span class={styles.requirementIcon}>{levelMet ? 'OK' : 'X'}</span>
            <span>{t('pillarUnlock.levelValue', { level: pillar.requiredLevel })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
