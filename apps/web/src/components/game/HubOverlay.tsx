import type { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
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
} from "../../state/index.js";
import { colonySceneVisible } from "../../state/idle.signals.js";
import { getMaxTurretSlots } from "@arcade/sim-core";
import { audioManager } from "../../game/AudioManager.js";
import { useCoordinates } from "../../hooks/useCoordinates.js";
import styles from "./HubOverlay.module.css";

/**
 * HubOverlay provides clickable areas for heroes, turrets, and fortress
 * when the game is in idle phase (before starting a session).
 */
export function HubOverlay() {
  // Track canvas dimensions for accurate positioning
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Use centralized coordinate conversion
  const { toScreenX, toScreenY } = useCoordinates(
    canvasSize.width,
    canvasSize.height,
  );

  useEffect(() => {
    const canvas = document.getElementById(
      "game-canvas",
    ) as HTMLCanvasElement | null;
    if (!canvas) return;

    let rafId: number | null = null;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        if (rafId === null) {
          rafId = requestAnimationFrame(updateSize);
        }
        return;
      }

      rafId = null;
      setCanvasSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    };

    const resizeObserver = new ResizeObserver(() => updateSize());
    resizeObserver.observe(canvas);

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Only show in idle phase with hub initialized and canvas ready
  // Hide when colony scene is visible
  if (
    gamePhase.value !== "idle" ||
    !hubInitialized.value ||
    canvasSize.width === 0 ||
    colonySceneVisible.value
  ) {
    return null;
  }

  const turrets = hubTurrets.value;
  const slots = turretSlots.value;
  const fortressLevel = baseLevel.value;
  const maxUnlockedSlots = getMaxTurretSlots(fortressLevel);

  const handleTurretClick = (slotIndex: number) => {
    audioManager.playSfx("ui_click");
    const turret = turrets.find((t) => t.slotIndex === slotIndex);
    if (turret) {
      // Open upgrade panel for existing turret
      upgradeTarget.value = {
        type: "turret",
        slotIndex,
        turretId: turret.definitionId,
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
        const hasTurret = turrets.some((t) => t.slotIndex === slot.index);
        // Skip occupied slots - turrets are rendered on canvas
        if (hasTurret) return null;

        // Check if slot is unlocked based on fortress level
        const isUnlocked = slot.index <= maxUnlockedSlots;

        // Locked slots are rendered by Pixi (TurretSystem) - skip HTML overlay
        if (!isUnlocked) {
          return null;
        }

        // Empty unlocked slot
        return (
          <button
            key={slot.index}
            class={`${styles.turretArea} ${styles.empty}`}
            onClick={() => handleTurretClick(slot.index)}
            style={
              {
                left: `${toScreenX(slot.x)}px`,
                top: `${toScreenY(slot.y)}px`,
              } as JSX.CSSProperties
            }
            title="Kliknij, aby dodać wieżyczkę"
          >
            <span class={styles.addIcon}>+</span>
          </button>
        );
      })}
    </div>
  );
}
