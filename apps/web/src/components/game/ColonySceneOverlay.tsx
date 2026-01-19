/**
 * ColonySceneOverlay - Minimal UI overlay for colony scene
 *
 * Clean, focused design with:
 * - Minimal header (resources + back)
 * - Combined rewards + CTA at bottom
 * - Vignette for focus
 */

import type { JSX } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import type { ColonyStatus } from '@arcade/protocol';
import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';
import {
  idleRewardsState,
  claimIdleRewards,
  claimingRewards,
  hasPendingRewards,
  totalPendingGold,
  totalColonyGoldPerHour,
  upgradeColony,
  upgradingColony,
  colonySceneVisible,
  hideColonyScene,
} from '../../state/idle.signals.js';
import { baseGold, baseDust } from '../../state/profile.signals.js';
import styles from './ColonySceneOverlay.module.css';

// Colony names (Polish)
const COLONY_NAMES: Record<string, string> = {
  farm: 'Farma',
  mine: 'Kopalnia',
  market: 'Targ',
  factory: 'Fabryka',
};

// Material icons
const MATERIAL_ICONS: Record<string, string> = {
  adamantium: '🔩',
  vibranium: '💎',
  uru: '⚒️',
  darkforce: '🌑',
  cosmic_dust: '✨',
  mutant_dna: '🧬',
  pym_particles: '⚛️',
  extremis: '🧪',
  super_soldier_serum: '💉',
};

interface ColonySceneOverlayProps {
  onUpgradeAnimation?: (colonyId: string) => void;
  onClaimAnimation?: () => Promise<void>;
}

export function ColonySceneOverlay({
  onUpgradeAnimation,
  onClaimAnimation,
}: ColonySceneOverlayProps): JSX.Element | null {
  const isVisible = colonySceneVisible.value;
  const state = idleRewardsState.value;
  const claiming = claimingRewards.value;
  const canClaim = hasPendingRewards.value;
  const pendingGold = totalPendingGold.value;
  const goldPerHour = totalColonyGoldPerHour.value;
  const currentUpgrading = upgradingColony.value;
  const playerGold = baseGold.value;
  const playerDust = baseDust.value;

  const [selectedColonyId, setSelectedColonyId] = useState<string | null>(null);

  // Listen for building clicks
  useEffect(() => {
    const handleBuildingClick = (e: CustomEvent<{ colonyId: string }>) => {
      setSelectedColonyId(e.detail.colonyId);
    };
    window.addEventListener('colony-building-click' as any, handleBuildingClick);
    return () => {
      window.removeEventListener('colony-building-click' as any, handleBuildingClick);
    };
  }, []);

  // Reset on hide
  useEffect(() => {
    if (!isVisible) setSelectedColonyId(null);
  }, [isVisible]);

  const handleBack = useCallback(() => hideColonyScene(), []);

  const handleClaim = useCallback(async () => {
    if (onClaimAnimation) await onClaimAnimation();
    await claimIdleRewards();
  }, [onClaimAnimation]);

  const handleUpgrade = useCallback(async () => {
    if (selectedColonyId) {
      const success = await upgradeColony(selectedColonyId);
      if (success && onUpgradeAnimation) onUpgradeAnimation(selectedColonyId);
    }
  }, [selectedColonyId, onUpgradeAnimation]);

  const handleClosePopup = useCallback(() => setSelectedColonyId(null), []);

  if (!isVisible) return null;

  const selectedColony = selectedColonyId && state?.colonies
    ? state.colonies.find((c) => c.id === selectedColonyId)
    : null;

  // Get pending materials
  const materialsWithDefs = state?.pendingMaterials
    ? Object.entries(state.pendingMaterials)
        .map(([id, amount]) => ({
          id,
          amount,
          def: MATERIAL_DEFINITIONS.find((m) => m.id === id),
        }))
        .filter((m) => m.def !== undefined)
    : [];

  const pendingDust = state?.pendingDust ?? 0;
  const hasRewards = pendingGold > 0 || pendingDust > 0 || materialsWithDefs.length > 0;

  return (
    <div class={styles.overlay}>
      {/* Vignette effect */}
      <div class={styles.vignette} />

      {/* Minimal header - only resources + back */}
      <header class={styles.header}>
        <button class={styles.backButton} onClick={handleBack}>
          <span class={styles.backIcon}>←</span>
          <span class={styles.backText}>Wróć</span>
        </button>

        <div class={styles.resources}>
          <div class={styles.resource}>
            <span class={styles.resourceIcon}>🪙</span>
            <span class={styles.resourceValue}>{playerGold.toLocaleString()}</span>
          </div>
          <div class={styles.resource}>
            <span class={styles.resourceIcon}>💎</span>
            <span class={styles.resourceValue}>{playerDust}</span>
          </div>
        </div>
      </header>

      {/* Production rate - subtle indicator */}
      {goldPerHour > 0 && (
        <div class={styles.productionBadge}>
          <span>{goldPerHour} 🪙/h</span>
        </div>
      )}

      {/* Bottom: Rewards + CTA combined */}
      <div class={styles.bottomSection}>
        {/* Rewards preview */}
        {hasRewards && (
          <div class={styles.rewardsPreview}>
            <span class={styles.rewardsLabel}>Nagrody do odebrania</span>
            <div class={styles.rewardsList}>
              {pendingGold > 0 && (
                <span class={styles.rewardChip}>
                  <span class={styles.rewardChipIcon}>🪙</span>
                  +{pendingGold}
                </span>
              )}
              {pendingDust > 0 && (
                <span class={styles.rewardChip}>
                  <span class={styles.rewardChipIcon}>💎</span>
                  +{pendingDust}
                </span>
              )}
              {materialsWithDefs.slice(0, 3).map(({ id, amount }) => (
                <span key={id} class={styles.rewardChip}>
                  <span class={styles.rewardChipIcon}>{MATERIAL_ICONS[id] || '📦'}</span>
                  ×{amount}
                </span>
              ))}
              {materialsWithDefs.length > 3 && (
                <span class={styles.rewardChipMore}>+{materialsWithDefs.length - 3}</span>
              )}
            </div>
          </div>
        )}

        {/* CTA Button */}
        {state && !state.canClaim && state.minutesUntilNextClaim > 0 ? (
          <div class={styles.waitMessage}>
            Następny odbiór za {state.minutesUntilNextClaim} min
          </div>
        ) : (
          <button
            class={`${styles.claimButton} ${canClaim ? styles.claimButtonActive : ''}`}
            onClick={handleClaim}
            disabled={!canClaim || claiming}
          >
            {claiming ? 'Odbieranie...' : canClaim ? 'Odbierz nagrody' : 'Brak nagród'}
          </button>
        )}
      </div>

      {/* Building popup with backdrop */}
      {selectedColony && (
        <>
          <div class={styles.popupBackdrop} onClick={handleClosePopup} />
          <BuildingPopup
            colony={selectedColony}
            isUpgrading={currentUpgrading === selectedColony.id}
            playerGold={playerGold}
            onClose={handleClosePopup}
            onUpgrade={handleUpgrade}
          />
        </>
      )}
    </div>
  );
}

// Building popup - clean design
interface BuildingPopupProps {
  colony: ColonyStatus;
  isUpgrading: boolean;
  playerGold: number;
  onClose: () => void;
  onUpgrade: () => void;
}

function BuildingPopup({ colony, isUpgrading, playerGold, onClose, onUpgrade }: BuildingPopupProps): JSX.Element {
  const canAfford = playerGold >= colony.upgradeCost;
  const isMaxLevel = colony.level >= colony.maxLevel;
  const name = COLONY_NAMES[colony.id] || colony.name;

  // Locked building - gray, not red
  if (!colony.unlocked) {
    return (
      <div class={`${styles.popup} ${styles.popupLocked}`}>
        <button class={styles.popupClose} onClick={onClose}>×</button>
        <div class={styles.popupHeader}>
          <span class={styles.popupLockIcon}>🔒</span>
          <span class={styles.popupName}>{name}</span>
        </div>
        <div class={styles.popupLockInfo}>
          Dostępne od poziomu {colony.unlockLevel}
        </div>
      </div>
    );
  }

  return (
    <div class={styles.popup}>
      <button class={styles.popupClose} onClick={onClose}>×</button>
      <div class={styles.popupHeader}>
        <span class={styles.popupName}>{name}</span>
        <span class={styles.popupLevel}>Poziom {colony.level}</span>
      </div>

      <div class={styles.popupStats}>
        <div class={styles.popupStat}>
          <span class={styles.popupStatLabel}>Produkcja</span>
          <span class={styles.popupStatValue}>{colony.goldPerHour} 🪙/h</span>
        </div>
        {colony.pendingGold > 0 && (
          <div class={styles.popupStat}>
            <span class={styles.popupStatLabel}>Zebrano</span>
            <span class={styles.popupStatValueGold}>+{colony.pendingGold} 🪙</span>
          </div>
        )}
      </div>

      <div class={styles.popupActions}>
        {isMaxLevel ? (
          <div class={styles.maxLevelBadge}>Maksymalny poziom</div>
        ) : (
          <button
            class={styles.upgradeButton}
            onClick={onUpgrade}
            disabled={!canAfford || isUpgrading || !colony.canUpgrade}
          >
            {isUpgrading ? (
              'Ulepszanie...'
            ) : (
              <>
                Ulepsz
                <span class={styles.upgradeCost}>
                  {colony.upgradeCost} 🪙
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default ColonySceneOverlay;
