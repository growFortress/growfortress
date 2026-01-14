import type { JSX } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
  gamePhase,
  hubTurrets,
  turretSlots,
  hubInitialized,
  upgradeTarget,
  upgradePanelVisible,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  baseLevel,
} from '../../state/index.js';
import { getMaxTurretSlots } from '@arcade/sim-core';
import { audioManager } from '../../game/AudioManager.js';
import { useCoordinates } from '../../hooks/useCoordinates.js';
import styles from './HubOverlay.module.css';

// Turret slot unlock levels (slot index 1-6 -> required fortress level)
const SLOT_UNLOCK_LEVELS: Record<number, number> = {
  1: 1,
  2: 5,
  3: 15,
  4: 25,
  5: 35,
  6: 40,
};

/**
 * HubOverlay provides clickable areas for heroes, turrets, and fortress
 * when the game is in idle phase (before starting a session).
 */
export function HubOverlay() {
  // Track canvas dimensions for accurate positioning
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Use centralized coordinate conversion
  const { toScreenX, toScreenY } = useCoordinates(canvasSize.width, canvasSize.height);

  useEffect(() => {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Only show in idle phase with hub initialized and canvas ready
  if (gamePhase.value !== 'idle' || !hubInitialized.value || canvasSize.width === 0) {
    return null;
  }

  const turrets = hubTurrets.value;
  const slots = turretSlots.value;
  const fortressLevel = baseLevel.value;
  const maxUnlockedSlots = getMaxTurretSlots(fortressLevel);

  const handleTurretClick = (slotIndex: number) => {
    audioManager.playSfx('ui_click');
    const turret = turrets.find(t => t.slotIndex === slotIndex);
    if (turret) {
      // Open upgrade panel for existing turret
      upgradeTarget.value = {
        type: 'turret',
        slotIndex,
        turretId: turret.definitionId
      };
      upgradePanelVisible.value = true;
    } else {
      // Open placement modal for empty slot
      turretPlacementSlotIndex.value = slotIndex;
      turretPlacementModalVisible.value = true;
    }
  };

  return (
    <div class={styles.overlay}>
      {/* Turret slot click areas */}
      {slots.map((slot) => {
        const hasTurret = turrets.some(t => t.slotIndex === slot.index);
        // Skip occupied slots - turrets are rendered on canvas
        if (hasTurret) return null;

        // Check if slot is unlocked based on fortress level
        const isUnlocked = slot.index <= maxUnlockedSlots;
        const unlockLevel = SLOT_UNLOCK_LEVELS[slot.index] ?? 50;

        // Locked slot
        if (!isUnlocked) {
          return (
            <div
              key={slot.index}
              class={`${styles.turretArea} ${styles.locked}`}
              style={{
                left: `${toScreenX(slot.x)}px`,
                top: `${toScreenY(slot.y)}px`,
              } as JSX.CSSProperties}
              title={`Odblokuj na poziomie ${unlockLevel}`}
            >
              <span class={styles.lockIcon}>🔒</span>
              <span class={styles.unlockLabel}>Poz. {unlockLevel}</span>
            </div>
          );
        }

        // Empty unlocked slot
        return (
          <button
            key={slot.index}
            class={`${styles.turretArea} ${styles.empty}`}
            onClick={() => handleTurretClick(slot.index)}
            style={{
              left: `${toScreenX(slot.x)}px`,
              top: `${toScreenY(slot.y)}px`,
            } as JSX.CSSProperties}
            title="Kliknij, aby dodać wieżyczkę"
          >
            <span class={styles.addIcon}>+</span>
          </button>
        );
      })}
    </div>
  );
}
