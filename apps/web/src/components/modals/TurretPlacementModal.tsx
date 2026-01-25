import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import type { TurretType, FortressClass, ActiveTurret } from '@arcade/sim-core';
import { TURRET_DEFINITIONS, getTurretById, isTurretUnlockedAtLevel, getTurretUnlockLevel } from '@arcade/sim-core';
import { TURRET_UNLOCK_COST } from '@arcade/protocol';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  activeTurrets,
  hubTurrets,
  gamePhase,
  unlockedTurretIds,
  baseGold,
  baseLevel,
  showErrorToast,
} from '../../state/index.js';
import { unlockTurret } from '../../api/client.js';
import { Modal } from '../shared/Modal.js';
import { GoldIcon } from '../icons/index.js';
import styles from './TurretPlacementModal.module.css';

// Turret role description translation keys
const ROLE_KEYS: Record<string, string> = {
  dps: 'turretPlacement.roles.dps',
  aoe: 'turretPlacement.roles.aoe',
  crowd_control: 'turretPlacement.roles.crowd_control',
  support: 'turretPlacement.roles.support',
  debuff: 'turretPlacement.roles.debuff',
};

// Class colors (7 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
  void: '#4b0082',
  plasma: '#00ffff',
};

// Turret icons (simplified: 4 turrets)
const TURRET_ICONS: Record<TurretType, string> = {
  railgun: '🎯', // target (precision)
  artillery: '\u{1F4A3}', // bomb
  arc: '\u{1F537}', // diamond (arc energy)
  cryo: '\u2744\uFE0F', // snowflake
};

interface TurretPlacementModalProps {
  onPlace: (turretType: TurretType, slotIndex: number) => void;
}

export function TurretPlacementModal({ onPlace }: TurretPlacementModalProps) {
  const { t } = useTranslation('common');
  const slotIndex = turretPlacementSlotIndex.value;
  const [isLoading, setIsLoading] = useState(false);
  const isIdle = gamePhase.value === 'idle';
  const turretList = isIdle ? hubTurrets.value : activeTurrets.value;
  const currentTurret = slotIndex !== null
    ? turretList.find((t) => t.slotIndex === slotIndex)
    : undefined;
  const isReplacing = !!currentTurret;

  const handleSelect = async (turretType: TurretType) => {
    if (slotIndex === null || isLoading) return;

    // Check if already unlocked - if so, just place it without API call
    const alreadyUnlocked = unlockedTurretIds.value.includes(turretType);

    if (!alreadyUnlocked) {
      // Call API to unlock turret (deducts gold on server)
      setIsLoading(true);
      try {
        const response = await unlockTurret({ turretType });

        if (!response.success) {
          showErrorToast(response.error || t('turretPlacement.purchaseError'));
          setIsLoading(false);
          return;
        }

        // Update gold and unlocked turrets from server response
        baseGold.value = response.inventory.gold;
        unlockedTurretIds.value = response.unlockedTurretIds;
      } catch (error) {
        console.error('Failed to unlock turret:', error);
        showErrorToast(t('turretPlacement.purchaseError'));
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    // Add/replace turret in local state for display
    const turretTier = 1 as const;
    const turretDefinition = getTurretById(turretType);
    const baseHp = turretDefinition?.baseStats.hp ?? 150;
    const maxHp = Math.floor(baseHp * (1 + (turretTier - 1) * 0.25));

    const newTurret: ActiveTurret = {
      definitionId: turretType,
      tier: turretTier,
      currentClass: 'natural' as FortressClass,
      slotIndex: slotIndex,
      lastAttackTick: 0,
      specialCooldown: 0,
      targetingMode: 'closest_to_fortress',
      currentHp: maxHp,
      maxHp,
    };

    const replaceTurret = (list: ActiveTurret[]) => {
      const filtered = list.filter((t) => t.slotIndex !== slotIndex);
      return [...filtered, newTurret];
    };

    activeTurrets.value = replaceTurret(activeTurrets.value);
    hubTurrets.value = replaceTurret(hubTurrets.value);

    // Close modal
    turretPlacementModalVisible.value = false;
    turretPlacementSlotIndex.value = null;

    // Callback
    onPlace(turretType, slotIndex);
  };

  const handleClose = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      turretPlacementModalVisible.value = false;
      turretPlacementSlotIndex.value = null;
    }
  };

  // Get turret IDs already in loadout
  const usedTurretIds = turretList
    .filter((t) => t.slotIndex !== slotIndex)
    .map((t) => t.definitionId);
  const currentGold = baseGold.value;
  const currentFortressLevel = baseLevel.value;

  return (
    <Modal
      visible={turretPlacementModalVisible.value}
      size="xlarge"
      onClick={handleClose}
    >
      <div class={styles.container}>
        <h2 class={styles.title}>
          {isReplacing ? t('turretPlacement.titleReplace') : t('turretPlacement.title')}
        </h2>
        <p class={styles.subtitle}>
          {isReplacing
            ? t('turretPlacement.subtitleReplace', { slot: slotIndex !== null ? slotIndex + 1 : '?' })
            : t('turretPlacement.subtitle', { slot: slotIndex !== null ? slotIndex + 1 : '?' })}
        </p>

        <div class={styles.turretGrid}>
          {TURRET_DEFINITIONS.map((turret) => {
            const icon = TURRET_ICONS[turret.id];
            const roleKey = ROLE_KEYS[turret.role];
            const roleDesc = roleKey ? t(roleKey) : turret.role;
            const baseCost = TURRET_UNLOCK_COST.gold;

            // Check if turret is unlocked by fortress level
            const isUnlockedByLevel = isTurretUnlockedAtLevel(turret.id, currentFortressLevel);
            const requiredLevel = getTurretUnlockLevel(turret.id);
            const isLocked = !isUnlockedByLevel;

            // Check if already purchased/unlocked (owned)
            const isOwned = unlockedTurretIds.value.includes(turret.id);

            // Check if already placed in a slot
            const isUsed = usedTurretIds.includes(turret.id);

            // Can afford only matters if not already owned
            const canAfford = isOwned || currentGold >= baseCost;
            const isDisabled = isLocked || isUsed || !canAfford || isLoading;

            const cardClasses = [
              styles.turretCard,
              isLocked && styles.locked,
              !isLocked && isUsed && styles.used,
              !isLocked && !isUsed && !canAfford && styles.disabled,
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                key={turret.id}
                class={cardClasses}
                style={{ '--turret-color': CLASS_COLORS.natural } as JSX.CSSProperties}
                onClick={() => !isDisabled && handleSelect(turret.id)}
                disabled={isDisabled}
              >
                <div class={styles.turretIcon}>{isLocked ? '🔒' : icon}</div>
                <div class={styles.turretName}>{turret.name}</div>
                <div class={styles.turretRole}>{roleDesc}</div>
                <div class={styles.turretDescription}>{turret.description}</div>

                <div class={styles.statsList}>
                  <span class={styles.stat}>
                    {t('turretPlacement.dmg')}: {Math.floor(turret.baseStats.damage / 16384)}
                  </span>
                  <span class={styles.stat}>
                    {t('turretPlacement.as')}: {(turret.baseStats.attackSpeed / 16384).toFixed(1)}/s
                  </span>
                </div>

                {isLocked ? (
                  <div class={styles.lockedLabel}>
                    <span class={styles.lockIcon}>🔒</span>
                    {t('turretPlacement.level', { level: requiredLevel })}
                  </div>
                ) : isOwned ? (
                  <>
                    <div class={styles.ownedBadge}>
                      {t('turretPlacement.owned')}
                    </div>
                    {isUsed && <div class={styles.usedLabel}>{t('turretPlacement.inUse')}</div>}
                  </>
                ) : (
                  <>
                    <div class={`${styles.costBadge} ${!canAfford ? styles.costInsufficient : ''}`}>
                      <GoldIcon size={16} className={styles.goldIcon} />
                      {baseCost}
                    </div>
                    {!canAfford && (
                      <div class={styles.insufficientLabel}>{t('turretPlacement.noGold')}</div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <button
          class={styles.closeButton}
          onClick={() => {
            turretPlacementModalVisible.value = false;
            turretPlacementSlotIndex.value = null;
          }}
        >
          {t('turretPlacement.cancel')}
        </button>
      </div>
    </Modal>
  );
}
