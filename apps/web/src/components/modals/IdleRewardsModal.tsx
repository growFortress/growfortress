import { useTranslation } from '../../i18n/useTranslation.js';
import { MATERIAL_DEFINITIONS } from '@arcade/sim-core';
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
  showColonyScene,
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
  const { t } = useTranslation(['modals', 'common']);
  const isVisible = idleRewardsModalVisible.value;
  const state = idleRewardsState.value;
  const claiming = claimingRewards.value;
  const canClaim = hasPendingRewards.value;
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

  const handleManageBase = () => {
    hideIdleRewardsModal();
    showColonyScene();
  };

  return (
    <Modal
      visible={isVisible}
      title={t('idleRewards.title')}
      onClose={hideIdleRewardsModal}
      class={styles.modalContent}
      ariaLabel={t('idleRewards.ariaLabel')}
    >
      {/* Time and production info */}
      <div class={styles.statsHeader}>
        <div class={styles.statItem}>
          <span class={styles.statIcon}>&#9201;</span>
          <span class={styles.statLabel}>Time Offline</span>
          <span class={styles.statValue}>{formatIdleTime(state.cappedHours)}</span>
        </div>
        {goldPerHour > 0 && (
          <div class={styles.statItem}>
            <span class={styles.statIcon}>&#129689;</span>
            <span class={styles.statLabel}>Production</span>
            <span class={styles.statValue}>{goldPerHour}/h</span>
          </div>
        )}
      </div>

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
              <span class={styles.compactRewardIcon}>&#129689;</span>
              <span class={styles.compactRewardAmount}>+{pendingGold}</span>
            </div>
          )}

          {/* Dust */}
          {state.pendingDust > 0 && (
            <div
              class={styles.compactRewardItem}
              style={{ '--rarity-color': '#9932cc' } as Record<string, string>}
            >
              <span class={styles.compactRewardIcon}>&#128142;</span>
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

        {/* Button to open full-screen colony terminal */}
        <button
          class={styles.manageBaseBtn}
          onClick={handleManageBase}
        >
          &#127981; Zarządzaj bazą
        </button>
      </div>
    </Modal>
  );
}
