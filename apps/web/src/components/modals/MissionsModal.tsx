/**
 * Weekly Missions Modal
 *
 * Displays the current week's missions with progress bars.
 * Missions reset every Monday at 00:00 UTC.
 */

import { useTranslation } from '../../i18n/useTranslation.js';
import { DamageIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import {
  missionsModalVisible,
  hideMissionsModal,
  sortedMissions,
  claimMissionReward,
  claimAllMissions,
  claimingMission,
  claimingAll,
  unclaimedCount,
  formatTimeUntilReset,
  isMissionClaimable,
  getMissionProgressText,
} from '../../state/missions.signals.js';
import { Modal } from '../shared/Modal.js';
import styles from './MissionsModal.module.css';

// Difficulty colors
const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#4ade80',
  medium: '#facc15',
  hard: '#f87171',
};

// Mission type icons - using SVG for damage-related missions
function getMissionIcon(missionType: string, size: number = 20): ComponentChildren {
  switch (missionType) {
    case 'kill_enemies':
    case 'deal_damage':
      return <DamageIcon size={size} />;
    case 'complete_waves':
      return '🌊';
    case 'earn_gold':
      return '🪙';
    case 'use_skills':
      return '✨';
    case 'pvp_battles':
      return '🏆';
    case 'boss_rush_cycles':
      return '🐉';
    case 'collect_materials':
      return '📦';
    case 'hero_synergies':
      return '🔗';
    default:
      return '📋';
  }
}

export function MissionsModal() {
  const { t } = useTranslation(['common']);
  const isVisible = missionsModalVisible.value;
  const missions = sortedMissions.value;
  const claiming = claimingMission.value;
  const claimingAllValue = claimingAll.value;
  const unclaimed = unclaimedCount.value;
  const timeUntilReset = formatTimeUntilReset();

  const handleClaimSingle = async (missionId: string) => {
    await claimMissionReward(missionId);
  };

  const handleClaimAll = async () => {
    await claimAllMissions();
  };

  return (
    <Modal
      visible={isVisible}
      title={t('missions.title')}
      onClose={hideMissionsModal}
      class={styles.modalContent}
      ariaLabel={t('missions.ariaLabel')}
    >
      {/* Reset Timer */}
      <div class={styles.resetTimer}>
        <span class={styles.resetIcon}>⏰</span>
        <span>{t('missions.resetIn')}: {timeUntilReset}</span>
      </div>

      {/* Claim All Button */}
      {unclaimed > 0 && (
        <button
          class={styles.claimAllBtn}
          onClick={handleClaimAll}
          disabled={claimingAllValue}
        >
          {claimingAllValue
            ? t('missions.claiming')
            : `${t('missions.claimAll')} (${unclaimed})`}
        </button>
      )}

      {/* Missions List */}
      <div class={styles.missionsList}>
        {missions.map((mission) => {
          const icon = getMissionIcon(mission.definition.type, 20);
          const color = DIFFICULTY_COLORS[mission.definition.difficulty] || '#808080';
          const isClaimable = isMissionClaimable(mission);
          const isClaiming = claiming === mission.missionId;

          return (
            <div
              key={mission.missionId}
              class={`${styles.missionCard} ${mission.completed ? styles.completed : ''} ${mission.claimed ? styles.claimed : ''}`}
              style={{ '--difficulty-color': color } as Record<string, string>}
            >
              <div class={styles.missionHeader}>
                <span class={styles.missionIcon}>{icon}</span>
                <div class={styles.missionInfo}>
                  <div class={styles.missionName}>{mission.definition.name}</div>
                  <div class={styles.missionDescription}>
                    {mission.definition.description.replace('{target}', mission.targetValue.toString())}
                  </div>
                </div>
                <div class={styles.difficultyBadge}>
                  {mission.definition.difficulty.toUpperCase()}
                </div>
              </div>

              {/* Progress Bar */}
              <div class={styles.progressContainer}>
                <div class={styles.progressBar}>
                  <div
                    class={styles.progressFill}
                    style={{ width: `${Math.min(mission.progressPercent, 100)}%` }}
                  />
                </div>
                <span class={styles.progressText}>
                  {getMissionProgressText(mission)}
                </span>
              </div>

              {/* Rewards */}
              <div class={styles.rewards}>
                {mission.definition.goldReward > 0 && (
                  <span class={styles.reward}>🪙 {mission.definition.goldReward}</span>
                )}
                {mission.definition.dustReward > 0 && (
                  <span class={styles.reward}>💎 {mission.definition.dustReward}</span>
                )}
                {Object.entries(mission.definition.materials).map(([matId, amount]) => (
                  <span key={matId} class={styles.reward}>📦 ×{amount}</span>
                ))}
              </div>

              {/* Claim Button or Status */}
              <div class={styles.missionAction}>
                {mission.claimed ? (
                  <span class={styles.claimedStatus}>✓ {t('missions.claimed')}</span>
                ) : isClaimable ? (
                  <button
                    class={styles.claimBtn}
                    onClick={() => handleClaimSingle(mission.missionId)}
                    disabled={isClaiming}
                  >
                    {isClaiming ? '...' : t('missions.claim')}
                  </button>
                ) : (
                  <span class={styles.inProgressStatus}>
                    {Math.round(mission.progressPercent)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {missions.length === 0 && (
          <div class={styles.emptyState}>
            {t('missions.loading')}
          </div>
        )}
      </div>
    </Modal>
  );
}
