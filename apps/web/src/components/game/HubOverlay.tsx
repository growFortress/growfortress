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
} from '../../state/index.js';
import styles from './HubOverlay.module.css';

// Layout constants matching the renderer
const LAYOUT = {
  fieldWidth: 40,
  fieldHeight: 15,
  fieldCenterY: 7.5, // Center Y coordinate in game units
  turretLaneHeight: 0.06, // Turret lane height as % of screen
  pathTopPercent: 0.35,  // Path starts at 35% from top
  pathBottomPercent: 0.65, // Path ends at 65% from top (was 70%, now 30% height)
};

/**
 * HubOverlay provides clickable areas for heroes, turrets, and fortress
 * when the game is in idle phase (before starting a session).
 */
export function HubOverlay() {
  // Track canvas dimensions for accurate positioning
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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

  const handleTurretClick = (slotIndex: number) => {
    const turret = turrets.find(t => t.slotIndex === slotIndex);
    if (turret) {
      // Open upgrade panel for existing turret
      upgradeTarget.value = { type: 'turret', slotIndex };
      upgradePanelVisible.value = true;
    } else {
      // Open placement modal for empty slot
      turretPlacementSlotIndex.value = slotIndex;
      turretPlacementModalVisible.value = true;
    }
  };

  // Convert fixed-point coordinates to screen pixels
  // These formulas match HeroSystem.ts and TurretSystem.ts exactly
  // Using Q16.16 fixed point format (65536 = 1.0 unit)
  const FP_SCALE = 65536;
  const toScreenX = (fpX: number): number => {
    const unitX = fpX / FP_SCALE;
    return (unitX / LAYOUT.fieldWidth) * canvasSize.width;
  };

  const toScreenY = (fpY: number): number => {
    const unitY = fpY / FP_SCALE;
    const turretLaneH = canvasSize.height * LAYOUT.turretLaneHeight;
    const pathTop = canvasSize.height * LAYOUT.pathTopPercent;
    const pathBottom = canvasSize.height * LAYOUT.pathBottomPercent;

    // Position turret slots in dedicated turret lanes (outside the enemy path)
    if (unitY < LAYOUT.fieldCenterY) {
      // Top turret lane (above path)
      const topLaneY = pathTop - turretLaneH;
      const topLaneCenterY = topLaneY + turretLaneH / 2;
      return topLaneCenterY;
    } else {
      // Bottom turret lane (below path)
      const bottomLaneCenterY = pathBottom + turretLaneH / 2;
      return bottomLaneCenterY;
    }
  };

  return (
    <div class={styles.overlay}>
      {/* Turret slot click areas - only show empty slots (turrets render on canvas) */}
      {slots.filter(slot => slot.isUnlocked).map((slot) => {
        const hasTurret = turrets.some(t => t.slotIndex === slot.index);
        // Skip occupied slots - turrets are rendered on canvas
        if (hasTurret) return null;
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
