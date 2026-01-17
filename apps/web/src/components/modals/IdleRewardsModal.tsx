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
  totalPendingMaterials,
  totalPendingGold,
  totalColonyGoldPerHour,
  upgradeColony,
  upgradingColony,
} from '../../state/idle.signals.js';
import { baseGold } from '../../state/profile.signals.js';
import { Modal } from '../shared/Modal.js';
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

// Colony icons
const COLONY_ICONS: Record<string, string> = {
  farm: '🌾',
  mine: '⛏️',
  market: '🏪',
  factory: '🏭',
};

// Colony names (Polish)
const COLONY_NAMES: Record<string, string> = {
  farm: 'Farma',
  mine: 'Kopalnia',
  market: 'Targ',
  factory: 'Fabryka',
};

// Colony Card sub-component
function ColonyCard({ colony }: { colony: ColonyStatus }) {
  const isUpgrading = upgradingColony.value === colony.id;
  const playerGold = baseGold.value;
  const canAfford = playerGold >= colony.upgradeCost;
  const isMaxLevel = colony.level >= colony.maxLevel;

  const handleUpgrade = async () => {
    await upgradeColony(colony.id);
  };

  if (!colony.unlocked) {
    return (
      <div class={`${styles.colonyCard} ${styles.locked}`}>
        <span class={styles.colonyIcon}>{COLONY_ICONS[colony.id] || '🏠'}</span>
        <div class={styles.colonyInfo}>
          <div class={styles.colonyHeader}>
            <span class={styles.colonyName}>{COLONY_NAMES[colony.id] || colony.name}</span>
          </div>
          <span class={styles.colonyUnlockInfo}>
            Odblokuj na poziomie {colony.unlockLevel}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div class={styles.colonyCard}>
      <span class={styles.colonyIcon}>{COLONY_ICONS[colony.id] || '🏠'}</span>
      <div class={styles.colonyInfo}>
        <div class={styles.colonyHeader}>
          <span class={styles.colonyName}>{COLONY_NAMES[colony.id] || colony.name}</span>
          <span class={styles.colonyLevel}>Lv.{colony.level}</span>
        </div>
        <div class={styles.colonyStats}>
          <span class={styles.colonyStat}>
            🪙 <span class={styles.colonyStatValue}>{colony.goldPerHour}</span>/h
          </span>
          {colony.pendingGold > 0 && (
            <span class={`${styles.colonyStat} ${styles.colonyPending}`}>
              +{colony.pendingGold} zebrano
            </span>
          )}
        </div>
      </div>
      {isMaxLevel ? (
        <span class={styles.colonyMaxLevel}>MAX</span>
      ) : (
        <button
          class={styles.colonyUpgradeBtn}
          onClick={handleUpgrade}
          disabled={!canAfford || isUpgrading || !colony.canUpgrade}
        >
          {isUpgrading ? '...' : `${colony.upgradeCost} 🪙`}
        </button>
      )}
    </div>
  );
}

export function IdleRewardsModal() {
  const isVisible = idleRewardsModalVisible.value;
  const state = idleRewardsState.value;
  const claiming = claimingRewards.value;
  const canClaim = hasPendingRewards.value;
  const totalMaterials = totalPendingMaterials.value;
  const pendingGold = totalPendingGold.value;
  const goldPerHour = totalColonyGoldPerHour.value;

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

  // Check if there are any colonies to display
  const hasColonies = state.colonies && state.colonies.length > 0;

  return (
    <Modal
      visible={isVisible}
      title="Idle Rewards"
      onClose={hideIdleRewardsModal}
      class={styles.modalContent}
      ariaLabel="Offline Rewards"
    >
      <div class={styles.timeInfo}>
        <span class={styles.clock}>⏰</span>
        <div class={styles.timeText}>
          <span class={styles.timeLabel}>Czas offline</span>
          <span class={styles.timeValue}>{formatIdleTime(state.cappedHours)}</span>
          {state.hoursOffline > state.cappedHours && (
            <span class={styles.cappedNote}>
              (max {state.cappedHours}h)
            </span>
          )}
        </div>
      </div>

      {/* Colonies section */}
      {hasColonies && (
        <div class={styles.coloniesSection}>
          <h3 class={styles.sectionTitle}>Kolonie</h3>
          <div class={styles.coloniesList}>
            {state.colonies.map((colony) => (
              <ColonyCard key={colony.id} colony={colony} />
            ))}
          </div>
          {goldPerHour > 0 && (
            <div class={styles.goldPerHour}>
              Produkcja: <span class={styles.goldPerHourValue}>{goldPerHour} 🪙/h</span>
            </div>
          )}
        </div>
      )}

      <div class={styles.rewards}>
        <h3 class={styles.sectionTitle}>Zdobyte nagrody</h3>

        {/* Gold from colonies */}
        {pendingGold > 0 && (
          <div class={styles.goldReward}>
            <span class={styles.goldIcon}>🪙</span>
            <span class={styles.goldLabel}>Gold</span>
            <span class={styles.goldAmount}>+{pendingGold}</span>
          </div>
        )}

        {materialsWithDefs.length > 0 ? (
          <div class={styles.materialsList}>
            {materialsWithDefs.map(({ id, amount, def }) => {
              const color = RARITY_COLORS[def!.rarity] || '#808080';
              const icon = MATERIAL_ICONS[id] || '📦';

              return (
                <div
                  key={id}
                  class={styles.materialItem}
                  style={{ '--rarity-color': color } as Record<string, string>}
                >
                  <span class={styles.materialIcon}>{icon}</span>
                  <span class={styles.materialName}>{def!.polishName}</span>
                  <span class={styles.materialAmount}>×{amount}</span>
                </div>
              );
            })}
          </div>
        ) : pendingGold === 0 ? (
          <div class={styles.noRewards}>
            Brak materiałów do odebrania. Wróć później!
          </div>
        ) : null}

        {state.pendingDust > 0 && (
          <div class={styles.dustReward}>
            <span class={styles.dustIcon}>💨</span>
            <span class={styles.dustLabel}>Dust</span>
            <span class={styles.dustAmount}>+{state.pendingDust}</span>
          </div>
        )}
      </div>

      <div class={styles.summary}>
        <div class={styles.summaryItem}>
          <span>Gold</span>
          <span class={styles.summaryValue}>{pendingGold}</span>
        </div>
        <div class={styles.summaryItem}>
          <span>Materiały</span>
          <span class={styles.summaryValue}>{totalMaterials}</span>
        </div>
        <div class={styles.summaryItem}>
          <span>Dust</span>
          <span class={styles.summaryValue}>{state.pendingDust}</span>
        </div>
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
      </div>
    </Modal>
  );
}
