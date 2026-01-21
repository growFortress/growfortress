import { useState, useCallback } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';
import type { ColonyStatus } from '@arcade/protocol';
import {
  idleRewardsState,
  idleRewardsModalVisible,
  hideIdleRewardsModal,
  claimIdleRewards,
  claimingRewards,
  formatIdleTime,
  hasPendingRewards,
  totalPendingGold,
  totalColonyGoldPerHour,
  upgradeColony,
  upgradingColony,
  showColonyScene,
} from '../../state/idle.signals.js';
import { baseGold } from '../../state/profile.signals.js';
import { Modal } from '../shared/Modal.js';
import { IdleRewardsScene } from './IdleRewardsScene.js';
import styles from './IdleRewardsModal.module.css';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  common: '#808080',
  uncommon: '#00ff00',
  rare: '#0088ff',
  epic: '#9932cc',
  legendary: '#ffd700',
};

// Material icons (emoji fallbacks)
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

// Building popup component (shown when clicking a building in scene)
function BuildingPopup({
  colony,
  onClose,
  onUpgrade,
}: {
  colony: ColonyStatus;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const { t } = useTranslation(['modals', 'common', 'game']);
  const isUpgrading = upgradingColony.value === colony.id;
  const playerGold = baseGold.value;
  const canAfford = playerGold >= colony.upgradeCost;
  const isMaxLevel = colony.level >= colony.maxLevel;
  const colonyName = t(`game:colonyScene.colonyNames.${colony.id}`, { defaultValue: colony.name });

  if (!colony.unlocked) {
    return (
      <div class={`${styles.buildingPopup} ${styles.locked}`} onClick={(e) => e.stopPropagation()}>
        <div class={styles.buildingPopupName}>{colonyName}</div>
        <div class={styles.buildingPopupUnlock}>
          {t('game:colonyScene.unlockAtLevel', { level: colony.unlockLevel })}
        </div>
        <button class={styles.colonyUpgradeBtn} onClick={onClose} style={{ marginTop: '8px', opacity: 0.6 }}>
          {t('common:buttons.close')}
        </button>
      </div>
    );
  }

  return (
    <div class={styles.buildingPopup} onClick={(e) => e.stopPropagation()}>
      <div class={styles.buildingPopupName}>
        {t('idleRewards.buildingNameLevel', { name: colonyName, level: colony.level })}
      </div>
      <div class={styles.buildingPopupStats}>
        {t('game:colonyScene.production')}: {colony.goldPerHour} 🪙/h
      </div>
      {colony.pendingGold > 0 && (
        <div class={styles.buildingPopupPending}>
          {t('game:colonyScene.collected')}: +{colony.pendingGold} 🪙
        </div>
      )}
      {isMaxLevel ? (
        <span class={styles.colonyMaxLevel}>{t('game:colonyScene.maxLevel')}</span>
      ) : (
        <button
          class={styles.colonyUpgradeBtn}
          onClick={onUpgrade}
          disabled={!canAfford || isUpgrading || !colony.canUpgrade}
        >
          {isUpgrading
            ? t('game:colonyScene.upgrading')
            : t('idleRewards.upgradeForCost', { cost: colony.upgradeCost })}
        </button>
      )}
    </div>
  );
}

export function IdleRewardsModal() {
  const { t } = useTranslation(['modals', 'common']);
  const isVisible = idleRewardsModalVisible.value;
  const state = idleRewardsState.value;
  const claiming = claimingRewards.value;
  const canClaim = hasPendingRewards.value;
  const pendingGold = totalPendingGold.value;
  const goldPerHour = totalColonyGoldPerHour.value;
  const currentUpgrading = upgradingColony.value;

  // Selected building for popup
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  if (!state) return null;

  // Get materials with definitions
  const materialsWithDefs = Object.entries(state.pendingMaterials)
    .map(([id, amount]) => ({
      id,
      amount,
      def: MATERIAL_DEFINITIONS.find((m) => m.id === id),
    }))
    .filter((m) => m.def !== undefined);

  const handleClaim = async () => {
    const success = await claimIdleRewards();
    if (success) {
      hideIdleRewardsModal();
    }
  };

  const handleBuildingClick = useCallback((colonyId: string) => {
    setSelectedBuildingId(colonyId);
  }, []);

  const handleClosePopup = useCallback(() => {
    setSelectedBuildingId(null);
  }, []);

  const handleUpgrade = useCallback(async () => {
    if (selectedBuildingId) {
      await upgradeColony(selectedBuildingId);
    }
  }, [selectedBuildingId]);

  // Check if there are any colonies to display
  const hasColonies = state.colonies && state.colonies.length > 0;
  const selectedColony = selectedBuildingId
    ? state.colonies.find((c) => c.id === selectedBuildingId)
    : null;

  return (
    <Modal
      visible={isVisible}
      title={t('idleRewards.title')}
      onClose={hideIdleRewardsModal}
      class={styles.modalContent}
      ariaLabel={t('idleRewards.ariaLabel')}
    >
      {/* Colony Scene with Pixi canvas */}
      {hasColonies && (
        <div class={styles.sceneContainer} onClick={handleClosePopup}>
          {/* Scene header overlay */}
          <div class={styles.sceneHeader}>
            <div class={styles.sceneTimeInfo}>
              <span class={styles.sceneTimeIcon}>⏰</span>
              <span class={styles.sceneTimeText}>{formatIdleTime(state.cappedHours)}</span>
            </div>
            {goldPerHour > 0 && (
              <div class={styles.sceneProductionInfo}>
                <span class={styles.sceneProductionText}>{goldPerHour} 🪙/h</span>
              </div>
            )}
          </div>

          {/* Pixi canvas */}
          <IdleRewardsScene
            colonies={state.colonies}
            visible={isVisible}
            onBuildingClick={handleBuildingClick}
            upgradingColonyId={currentUpgrading}
          />

          {/* Building popup */}
          {selectedColony && (
            <BuildingPopup
              colony={selectedColony}
              onClose={handleClosePopup}
              onUpgrade={handleUpgrade}
            />
          )}
        </div>
      )}

      {/* Compact rewards display */}
      <div class={styles.rewards}>
        <h3 class={styles.sectionTitle}>{t('idleRewards.rewardsTitle')}</h3>

        <div class={styles.compactRewards}>
          {/* Gold from colonies */}
          {pendingGold > 0 && (
            <div
              class={styles.compactRewardItem}
              style={{ '--rarity-color': '#ffd700' } as Record<string, string>}
            >
              <span class={styles.compactRewardIcon}>🪙</span>
              <span class={styles.compactRewardAmount}>+{pendingGold}</span>
            </div>
          )}

          {/* Dust */}
          {state.pendingDust > 0 && (
            <div
              class={styles.compactRewardItem}
              style={{ '--rarity-color': '#9932cc' } as Record<string, string>}
            >
              <span class={styles.compactRewardIcon}>💨</span>
              <span class={styles.compactRewardAmount}>+{state.pendingDust}</span>
            </div>
          )}

          {/* Materials */}
          {materialsWithDefs.map(({ id, amount, def }) => {
            const color = RARITY_COLORS[def!.rarity] || '#808080';
            const icon = MATERIAL_ICONS[id] || '📦';

            return (
              <div
                key={id}
                class={styles.compactRewardItem}
                style={{ '--rarity-color': color } as Record<string, string>}
                title={def!.polishName}
              >
                <span class={styles.compactRewardIcon}>{icon}</span>
                <span class={styles.compactRewardAmount}>×{amount}</span>
              </div>
            );
          })}
        </div>

        {pendingGold === 0 && materialsWithDefs.length === 0 && state.pendingDust === 0 && (
          <div class={styles.noRewards}>
            Brak nagród do odebrania. Wróć później!
          </div>
        )}
      </div>

      <div class={styles.actions}>
        {!state.canClaim && state.minutesUntilNextClaim > 0 ? (
          <div class={styles.waitMessage}>
            Poczekaj jeszcze {state.minutesUntilNextClaim} min
          </div>
        ) : (
          <button
            class={styles.claimBtn}
            onClick={handleClaim}
            disabled={!canClaim || claiming}
          >
            {claiming ? 'Odbieranie...' : 'Odbierz nagrody'}
          </button>
        )}

        {/* Button to open full-screen colony scene */}
        <button
          class={styles.manageBaseBtn}
          onClick={() => {
            hideIdleRewardsModal();
            showColonyScene();
          }}
        >
          🏭 Zarządzaj bazą
        </button>
      </div>
    </Modal>
  );
}
