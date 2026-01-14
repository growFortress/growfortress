import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';
import {
  idleRewardsState,
  idleRewardsModalVisible,
  hideIdleRewardsModal,
  claimIdleRewards,
  claimingRewards,
  formatIdleTime,
  hasPendingRewards,
  totalPendingMaterials,
} from '../../state/idle.signals.js';
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

export function IdleRewardsModal() {
  const isVisible = idleRewardsModalVisible.value;
  const state = idleRewardsState.value;
  const claiming = claimingRewards.value;
  const canClaim = hasPendingRewards.value;
  const totalMaterials = totalPendingMaterials.value;

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

      <div class={styles.rewards}>
        <h3 class={styles.sectionTitle}>Zdobyte nagrody</h3>

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
        ) : (
          <div class={styles.noRewards}>
            Brak materiałów do odebrania. Wróć później!
          </div>
        )}

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
