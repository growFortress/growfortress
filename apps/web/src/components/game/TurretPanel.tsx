import type { JSX } from 'preact';
import type { ActiveTurret, TurretSlot, FortressClass } from '@arcade/sim-core';
import {
  turretSlots,
  activeTurrets,
  hubTurrets,
  gamePhase,
  selectedTurretSlot,
  upgradePanelVisible,
  upgradeTarget,
  selectedFortressClass,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  baseLevel,
  purchasedTurretSlots,
} from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { getMaxTurretSlots, TURRET_SLOT_UNLOCKS } from '@arcade/sim-core';
import { Tooltip } from '../shared/Tooltip.js';
import { RailgunIcon, ArtilleryIcon, ArcIcon, CryoIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
import styles from './TurretPanel.module.css';

// Turret name translation keys
const TURRET_NAME_KEYS: Record<string, string> = {
  railgun: 'turretPanel.railgunTower',
  artillery: 'turretPanel.artilleryTower',
  arc: 'turretPanel.arcTower',
  cryo: 'turretPanel.cryoTower',
  // Legacy
  arrow: 'turretPanel.arrowTower',
  cannon: 'turretPanel.cannonTower',
  tesla: 'turretPanel.teslaTower',
  frost: 'turretPanel.frostTower',
};

// Turret icon components - using SVG matching game models
function getTurretIcon(turretId: string, size: number = 24): ComponentChildren {
  switch (turretId) {
    case 'railgun':
    case 'arrow': // Legacy
      return <RailgunIcon size={size} />;
    case 'artillery':
    case 'cannon': // Legacy
      return <ArtilleryIcon size={size} />;
    case 'arc':
    case 'tesla': // Legacy
      return <ArcIcon size={size} />;
    case 'cryo':
    case 'frost': // Legacy
      return <CryoIcon size={size} />;
    default:
      return '🗼';
  }
}

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

// Get unlock level for a slot (for display when slot is locked)
function getSlotUnlockLevel(slotIndex: number): number {
  const slotConfig = TURRET_SLOT_UNLOCKS[slotIndex];
  return slotConfig?.levelRequired ?? 50;
}

interface TurretPanelProps {
  compact?: boolean;
}

export function TurretPanel({ compact = false }: TurretPanelProps) {
  const { t } = useTranslation('game');
  const slots = turretSlots.value;
  // In idle phase, use hubTurrets; otherwise use activeTurrets (same logic as UpgradeModal)
  const turrets = gamePhase.value === 'idle' ? hubTurrets.value : activeTurrets.value;
  const fortressClass = selectedFortressClass.value;
  const fortressLevel = baseLevel.value;
  const maxSlots = getMaxTurretSlots(fortressLevel, purchasedTurretSlots.value);

  const handleSlotClick = (slot: TurretSlot, turret: ActiveTurret | undefined) => {
    selectedTurretSlot.value = slot.index;
    if (turret) {
      // Existing turret - open upgrade panel
      upgradeTarget.value = {
        type: 'turret',
        slotIndex: slot.index,
        turretId: turret.definitionId
      };
      upgradePanelVisible.value = true;
    } else {
      // Empty slot - open placement modal
      turretPlacementSlotIndex.value = slot.index;
      turretPlacementModalVisible.value = true;
    }
  };

  const renderTurretSlot = (slot: TurretSlot) => {
    const turret = turrets.find(t => t.slotIndex === slot.index);
    const isOccupied = turret !== undefined;
    const isUnlocked = slot.index < maxSlots;
    const unlockLevel = getSlotUnlockLevel(slot.index);

    // Locked slot - show lock icon with unlock level
    if (!isUnlocked) {
      return (
        <Tooltip content={t('turretPanel.unlockAtLevel', { level: unlockLevel })} position="top" key={slot.index}>
          <div class={`${styles.turretSlot} ${styles.locked}`}>
            <span class={styles.lockIcon}>🔒</span>
            <span class={styles.unlockLevel}>{t('turretPanel.levelShort', { level: unlockLevel })}</span>
          </div>
        </Tooltip>
      );
    }

    // Empty unlocked slot
    if (!isOccupied) {
      return (
        <div
          key={slot.index}
          class={`${styles.turretSlot} ${styles.empty}`}
          onClick={() => handleSlotClick(slot, undefined)}
        >
          <div class={styles.emptyIcon}>+</div>
          <span class={styles.slotNumber}>#{slot.index + 1}</span>
        </div>
      );
    }

    const nameKey = TURRET_NAME_KEYS[turret.definitionId];
    const name = nameKey ? t(nameKey) : turret.definitionId;
    const icon = getTurretIcon(turret.definitionId, 24);
    const classColor = CLASS_COLORS[turret.currentClass];
    const isSynergy = fortressClass && turret.currentClass === fortressClass;

    return (
      <button
        key={slot.index}
        class={`${styles.turretSlot} ${styles.filled} ${isSynergy ? styles.synergy : ''}`}
        style={{ '--turret-color': classColor } as JSX.CSSProperties}
        onClick={() => handleSlotClick(slot, turret)}
      >
        <div class={styles.turretIcon}>{icon}</div>

        {!compact && (
          <>
            <div class={styles.turretInfo}>
              <div class={styles.turretName}>{name}</div>
              <div class={styles.turretClass}>{turret.currentClass}</div>
            </div>
            <div class={styles.tierBadge}>T{turret.tier}</div>
          </>
        )}

        {/* Synergy indicator */}
        {isSynergy && (
          <div class={styles.synergyBadge} title={t('turretPanel.classSynergyActive')}>
            ⚡
          </div>
        )}
      </button>
    );
  };

  // Group slots into top (0-2) and bottom (3-5) rows
  const topSlots = slots.filter(s => s.index < 3);
  const bottomSlots = slots.filter(s => s.index >= 3);

  return (
    <div class={`${styles.turretPanel} ${compact ? styles.compact : ''}`}>
      <div class={styles.header}>
        <span class={styles.title}>{t('turretPanel.turrets')}</span>
        <span class={styles.count}>
          {turrets.length}/{slots.length}
        </span>
      </div>

      <div class={styles.slotLayout}>
        <div class={styles.slotRow}>
          {topSlots.map(slot => renderTurretSlot(slot))}
        </div>
        <div class={styles.fortressIndicator}>⛫</div>
        <div class={styles.slotRow}>
          {bottomSlots.map(slot => renderTurretSlot(slot))}
        </div>
      </div>
    </div>
  );
}
