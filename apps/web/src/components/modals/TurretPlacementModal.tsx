import type { JSX } from 'preact';
import type { TurretType, FortressClass, ActiveTurret } from '@arcade/sim-core';
import { TURRET_DEFINITIONS, getTurretById, isTurretUnlockedAtLevel, getTurretUnlockLevel } from '@arcade/sim-core';
import {
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  activeTurrets,
  baseGold,
  baseLevel,
} from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import styles from './TurretPlacementModal.module.css';

// Turret role descriptions (Polish)
const ROLE_DESCRIPTIONS: Record<string, string> = {
  dps: 'Obrażenia',
  aoe: 'Obrażenia Obszarowe',
  crowd_control: 'Kontrola Tłumu',
  support: 'Wsparcie',
  debuff: 'Debuffer',
};

// Class colors (simplified: 5 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
};

// Turret icons (simplified: 4 turrets)
const TURRET_ICONS: Record<TurretType, string> = {
  arrow: '\u{1F3F9}', // bow and arrow
  cannon: '\u{1F4A3}', // bomb
  tesla: '\u26A1', // lightning
  frost: '\u2744\uFE0F', // snowflake
};

interface TurretPlacementModalProps {
  onPlace: (turretType: TurretType, slotIndex: number) => void;
}

export function TurretPlacementModal({ onPlace }: TurretPlacementModalProps) {
  const slotIndex = turretPlacementSlotIndex.value;

  const handleSelect = (turretType: TurretType) => {
    if (slotIndex === null) return;

    const turretTier = 1 as const;
    const turretDefinition = getTurretById(turretType);
    const baseHp = turretDefinition?.baseStats.hp ?? 150;
    const maxHp = Math.floor(baseHp * (1 + (turretTier - 1) * 0.25));

    // Add turret to active turrets
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

    activeTurrets.value = [...activeTurrets.value, newTurret];

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
  const usedTurretIds = activeTurrets.value.map((t) => t.definitionId);
  const currentGold = baseGold.value;
  const currentFortressLevel = baseLevel.value;

  return (
    <Modal
      visible={turretPlacementModalVisible.value}
      class={styles.modal}
      onClick={handleClose}
    >
      <div class={styles.container}>
        <h2 class={styles.title}>Postaw Wieżyczkę</h2>
        <p class={styles.subtitle}>
          Wybierz typ wieżyczki dla slotu #{slotIndex !== null ? slotIndex : '?'}
        </p>

        <div class={styles.turretGrid}>
          {TURRET_DEFINITIONS.map((turret) => {
            const icon = TURRET_ICONS[turret.id];
            const roleDesc = ROLE_DESCRIPTIONS[turret.role] || turret.role;
            const baseCost = turret.baseCost.gold;

            // Use fortress level-based unlock system
            const isUnlockedByLevel = isTurretUnlockedAtLevel(turret.id, currentFortressLevel);
            const requiredLevel = getTurretUnlockLevel(turret.id);
            const isLocked = !isUnlockedByLevel;
            const isUsed = usedTurretIds.includes(turret.id);
            const canAfford = currentGold >= baseCost;
            const isDisabled = isLocked || isUsed || !canAfford;

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
                    OBR: {Math.floor(turret.baseStats.damage / 16384)}
                  </span>
                  <span class={styles.stat}>
                    SA: {(turret.baseStats.attackSpeed / 16384).toFixed(1)}/s
                  </span>
                </div>

                {isLocked ? (
                  <div class={styles.lockedLabel}>
                    <span class={styles.lockIcon}>🔒</span>
                    Poziom {requiredLevel}
                  </div>
                ) : (
                  <>
                    <div class={`${styles.costBadge} ${!canAfford ? styles.costInsufficient : ''}`}>
                      <span class={styles.goldIcon}>&#x1F4B0;</span>
                      {baseCost}
                    </div>
                    {isUsed && <div class={styles.usedLabel}>W użyciu</div>}
                    {!isUsed && !canAfford && (
                      <div class={styles.insufficientLabel}>Brak złota</div>
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
          Anuluj
        </button>
      </div>
    </Modal>
  );
}
