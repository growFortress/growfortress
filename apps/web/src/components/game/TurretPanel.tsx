import type { JSX } from 'preact';
import type { ActiveTurret, TurretSlot, FortressClass } from '@arcade/sim-core';
import {
  turretSlots,
  activeTurrets,
  selectedTurretSlot,
  upgradePanelVisible,
  upgradeTarget,
  selectedFortressClass,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
} from '../../state/index.js';
import styles from './TurretPanel.module.css';

// Turret type names (simplified: 4 turrets)
const TURRET_NAMES: Record<string, string> = {
  arrow: 'Wieża Łucznicza',
  cannon: 'Wieża Armatnia',
  tesla: 'Wieża Tesli',
  frost: 'Wieża Mrozu',
};

// Turret icons
const TURRET_ICONS: Record<string, string> = {
  arrow: '\u{1F3F9}', // bow and arrow
  cannon: '\u{1F4A3}', // bomb
  tesla: '\u26A1', // lightning
  frost: '\u2744\uFE0F', // snowflake
};

// Class colors (simplified: 5 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
};

interface TurretPanelProps {
  compact?: boolean;
}

export function TurretPanel({ compact = false }: TurretPanelProps) {
  const slots = turretSlots.value;
  const turrets = activeTurrets.value;
  const fortressClass = selectedFortressClass.value;

  const handleSlotClick = (slot: TurretSlot, turret: ActiveTurret | undefined) => {
    selectedTurretSlot.value = slot.index;
    if (turret) {
      // Existing turret - open upgrade panel
      upgradeTarget.value = { type: 'turret', slotIndex: slot.index };
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

    const name = TURRET_NAMES[turret.definitionId] || turret.definitionId;
    const icon = TURRET_ICONS[turret.definitionId] || '🗼';
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
          <div class={styles.synergyBadge} title="Class Synergy Active">
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
        <span class={styles.title}>Wieżyczki</span>
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
