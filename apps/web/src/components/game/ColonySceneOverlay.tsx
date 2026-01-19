/**
 * ColonySceneOverlay - UI overlay for the full-screen colony scene
 *
 * Provides navigation, stats, building popups, and actions
 * for the space station colony management screen.
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
  formatIdleTime,
  colonySceneVisible,
  hideColonyScene,
} from '../../state/idle.signals.js';
import { baseGold } from '../../state/profile.signals.js';
import styles from './ColonySceneOverlay.module.css';

// Colony names (Polish)
const COLONY_NAMES: Record<string, string> = {
  farm: 'Farma',
  mine: 'Kopalnia',
  market: 'Targ',
  factory: 'Fabryka',
};

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  common: '#808080',
  uncommon: '#00ff00',
  rare: '#0088ff',
  epic: '#9932cc',
  legendary: '#ffd700',
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
  /** Callback when a building is clicked in the scene */
  onBuildingClick?: (colonyId: string, colony: ColonyStatus | null) => void;
  /** Callback when upgrade animation should play */
  onUpgradeAnimation?: (colonyId: string) => void;
  /** Callback when claim animation should play */
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

  // Selected building for popup
  const [selectedColonyId, setSelectedColonyId] = useState<string | null>(null);

  // Listen for building clicks from the scene
  // This will be connected via GameContainer
  useEffect(() => {
    const handleBuildingClick = (e: CustomEvent<{ colonyId: string }>) => {
      setSelectedColonyId(e.detail.colonyId);
    };

    window.addEventListener('colony-building-click' as any, handleBuildingClick);
    return () => {
      window.removeEventListener('colony-building-click' as any, handleBuildingClick);
    };
  }, []);

  // Reset selection when hiding
  useEffect(() => {
    if (!isVisible) {
      setSelectedColonyId(null);
    }
  }, [isVisible]);

  const handleBack = useCallback(() => {
    hideColonyScene();
  }, []);

  const handleClaim = useCallback(async () => {
    if (onClaimAnimation) {
      await onClaimAnimation();
    }
    await claimIdleRewards();
  }, [onClaimAnimation]);

  const handleUpgrade = useCallback(async () => {
    if (selectedColonyId) {
      const success = await upgradeColony(selectedColonyId);
      if (success && onUpgradeAnimation) {
        onUpgradeAnimation(selectedColonyId);
      }
    }
  }, [selectedColonyId, onUpgradeAnimation]);

  const handleClosePopup = useCallback(() => {
    setSelectedColonyId(null);
  }, []);

  const handleBackgroundClick = useCallback((e: MouseEvent) => {
    // Only close if clicking the background, not the popup
    if ((e.target as HTMLElement).classList.contains(styles.overlay)) {
      setSelectedColonyId(null);
    }
  }, []);

  // Don't render if not visible
  if (!isVisible) return null;

  const selectedColony = selectedColonyId && state?.colonies
    ? state.colonies.find((c) => c.id === selectedColonyId)
    : null;

  // Get materials with definitions
  const materialsWithDefs = state?.pendingMaterials
    ? Object.entries(state.pendingMaterials)
        .map(([id, amount]) => ({
          id,
          amount,
          def: MATERIAL_DEFINITIONS.find((m) => m.id === id),
        }))
        .filter((m) => m.def !== undefined)
    : [];

  return (
    <div class={styles.overlay} onClick={handleBackgroundClick}>
      {/* Header with back button and stats */}
      <header class={styles.header}>
        <button class={styles.backButton} onClick={handleBack} aria-label="Wróć">
          ← Wróć
        </button>

        <div class={styles.stats}>
          {state && (
            <div class={styles.timeInfo}>
              <span class={styles.timeIcon}>⏰</span>
              <span class={styles.timeText}>{formatIdleTime(state.cappedHours)}</span>
            </div>
          )}
          {goldPerHour > 0 && (
            <div class={styles.productionInfo}>
              <span class={styles.productionText}>{goldPerHour} 🪙/h</span>
            </div>
          )}
        </div>
      </header>

      {/* Pending rewards summary */}
      {(pendingGold > 0 || materialsWithDefs.length > 0 || (state?.pendingDust ?? 0) > 0) && (
        <div class={styles.rewardsSummary}>
          {pendingGold > 0 && (
            <div class={styles.rewardItem}>
              <span class={styles.rewardIcon}>🪙</span>
              <span class={styles.rewardAmount}>+{pendingGold}</span>
            </div>
          )}
          {(state?.pendingDust ?? 0) > 0 && (
            <div class={styles.rewardItem}>
              <span class={styles.rewardIcon}>💨</span>
              <span class={styles.rewardAmount}>+{state?.pendingDust}</span>
            </div>
          )}
          {materialsWithDefs.slice(0, 3).map(({ id, amount, def }) => {
            const color = RARITY_COLORS[def!.rarity] || '#808080';
            const icon = MATERIAL_ICONS[id] || '📦';
            return (
              <div
                key={id}
                class={styles.rewardItem}
                style={{ '--reward-color': color } as JSX.CSSProperties}
                title={def!.polishName}
              >
                <span class={styles.rewardIcon}>{icon}</span>
                <span class={styles.rewardAmount}>×{amount}</span>
              </div>
            );
          })}
          {materialsWithDefs.length > 3 && (
            <span class={styles.moreRewards}>+{materialsWithDefs.length - 3}</span>
          )}
        </div>
      )}

      {/* Claim button */}
      <div class={styles.claimSection}>
        {state && !state.canClaim && state.minutesUntilNextClaim > 0 ? (
          <div class={styles.waitMessage}>
            Poczekaj jeszcze {state.minutesUntilNextClaim} min
          </div>
        ) : (
          <button
            class={styles.claimButton}
            onClick={handleClaim}
            disabled={!canClaim || claiming}
          >
            {claiming ? 'Odbieranie...' : 'Odbierz nagrody'}
          </button>
        )}
      </div>

      {/* Building popup */}
      {selectedColony && (
        <BuildingPopup
          colony={selectedColony}
          isUpgrading={currentUpgrading === selectedColony.id}
          onClose={handleClosePopup}
          onUpgrade={handleUpgrade}
        />
      )}
    </div>
  );
}

// Building popup component
interface BuildingPopupProps {
  colony: ColonyStatus;
  isUpgrading: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

function BuildingPopup({ colony, isUpgrading, onClose, onUpgrade }: BuildingPopupProps): JSX.Element {
  const playerGold = baseGold.value;
  const canAfford = playerGold >= colony.upgradeCost;
  const isMaxLevel = colony.level >= colony.maxLevel;

  if (!colony.unlocked) {
    return (
      <div class={`${styles.popup} ${styles.popupLocked}`}>
        <button class={styles.popupClose} onClick={onClose} aria-label="Zamknij">×</button>
        <div class={styles.popupName}>{COLONY_NAMES[colony.id] || colony.name}</div>
        <div class={styles.popupUnlock}>
          <span class={styles.lockIcon}>🔒</span>
          Odblokuj na poziomie {colony.unlockLevel}
        </div>
      </div>
    );
  }

  return (
    <div class={styles.popup}>
      <button class={styles.popupClose} onClick={onClose} aria-label="Zamknij">×</button>
      <div class={styles.popupName}>
        {COLONY_NAMES[colony.id] || colony.name} <span class={styles.popupLevel}>Lv.{colony.level}</span>
      </div>
      <div class={styles.popupStats}>
        <div class={styles.popupStatRow}>
          <span>Produkcja:</span>
          <span class={styles.popupStatValue}>{colony.goldPerHour} 🪙/h</span>
        </div>
        {colony.pendingGold > 0 && (
          <div class={styles.popupStatRow}>
            <span>Zebrano:</span>
            <span class={styles.popupStatValue}>+{colony.pendingGold} 🪙</span>
          </div>
        )}
      </div>
      <div class={styles.popupActions}>
        {isMaxLevel ? (
          <span class={styles.maxLevel}>MAX LEVEL</span>
        ) : (
          <button
            class={styles.upgradeButton}
            onClick={onUpgrade}
            disabled={!canAfford || isUpgrading || !colony.canUpgrade}
          >
            {isUpgrading ? 'Ulepszanie...' : `Ulepsz za ${colony.upgradeCost} 🪙`}
          </button>
        )}
      </div>
    </div>
  );
}

export default ColonySceneOverlay;
