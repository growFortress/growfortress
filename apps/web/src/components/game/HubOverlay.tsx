import type { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import {
  gamePhase,
  hubTurrets,
  hubHeroes,
  turretSlots,
  hubInitialized,
  upgradeTarget,
  upgradePanelVisible,
  turretPlacementModalVisible,
  turretPlacementSlotIndex,
  baseLevel,
  purchasedHeroSlots,
  purchasedTurretSlots,
  heroPlacementModalVisible,
  heroPlacementSlotIndex,
  isGuestMode,
} from "../../state/index.js";
import { GuestRegistrationBanner } from "../shared/GuestRegistrationBanner.js";
import { colonySceneVisible } from "../../state/idle.signals.js";
import { getMaxTurretSlots } from "@arcade/sim-core";
import { audioManager } from "../../game/AudioManager.js";
import { useCoordinates } from "../../hooks/useCoordinates.js";
import { fpYToScreen } from "../../renderer/CoordinateSystem.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import styles from "./HubOverlay.module.css";

/**
 * HubOverlay provides clickable areas for heroes, turrets, and fortress
 * when the game is in idle phase (before starting a session).
 */
export function HubOverlay() {
  const { t } = useTranslation("game");

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
  const heroes = hubHeroes.value;
  const slots = turretSlots.value;
  const fortressLevel = baseLevel.value;
  const maxUnlockedSlots = getMaxTurretSlots(fortressLevel, purchasedTurretSlots.value);
  const maxHeroSlots = purchasedHeroSlots.value;

  // Formation position helper - same as in actions.ts
  const getFormationPosition = (index: number, totalCount: number): { xOffset: number; yOffset: number } => {
    const centerY = 7.5;
    const SLOT_X = [4, 7, 10];

    switch (totalCount) {
      case 1:
        return { xOffset: SLOT_X[0], yOffset: centerY };
      case 2:
        return [
          { xOffset: SLOT_X[0], yOffset: centerY - 2 },
          { xOffset: SLOT_X[0], yOffset: centerY + 2 },
        ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
      case 3:
        return [
          { xOffset: SLOT_X[1], yOffset: centerY },
          { xOffset: SLOT_X[0], yOffset: centerY - 2 },
          { xOffset: SLOT_X[0], yOffset: centerY + 2 },
        ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
      case 4:
        return [
          { xOffset: SLOT_X[1], yOffset: centerY },
          { xOffset: SLOT_X[0], yOffset: centerY - 2 },
          { xOffset: SLOT_X[0], yOffset: centerY + 2 },
          { xOffset: SLOT_X[0], yOffset: centerY },
        ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
      case 5:
        return [
          { xOffset: SLOT_X[2], yOffset: centerY },
          { xOffset: SLOT_X[1], yOffset: centerY - 2 },
          { xOffset: SLOT_X[1], yOffset: centerY + 2 },
          { xOffset: SLOT_X[0], yOffset: centerY - 2 },
          { xOffset: SLOT_X[0], yOffset: centerY + 2 },
        ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
      default: {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const ySpread = 2.5;
        const yPositions = [centerY - ySpread, centerY, centerY + ySpread];
        return {
          xOffset: SLOT_X[Math.min(row, 2)],
          yOffset: yPositions[col] || centerY
        };
      }
    }
  };

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

  const handleHeroSlotClick = (slotIndex: number) => {
    audioManager.playSfx("ui_click");
    const hero = heroes[slotIndex];
    if (hero) {
      // Open upgrade panel for existing hero
      upgradeTarget.value = { type: "hero", heroId: hero.definitionId };
      upgradePanelVisible.value = true;
    } else {
      // Open placement modal for empty slot
      heroPlacementSlotIndex.value = slotIndex;
      heroPlacementModalVisible.value = true;
    }
  };

  return (
    <div class={styles.overlay}>
      {/* Guest registration banner */}
      {isGuestMode.value && (
        <div class={styles.guestBannerContainer}>
          <GuestRegistrationBanner />
        </div>
      )}

      {/* Hero click areas - existing heroes */}
      {heroes.map((hero, index) => {
        if (!hero) return null;
        return (
          <button
            key={`${hero.definitionId}-${index}`}
            class={`${styles.heroArea} ${styles.heroHitbox}`}
            onClick={() => {
              audioManager.playSfx("ui_click");
              upgradeTarget.value = { type: "hero", heroId: hero.definitionId };
              upgradePanelVisible.value = true;
            }}
            style={
              {
                left: `${toScreenX(hero.x)}px`,
                top: `${fpYToScreen(hero.y, canvasSize.height)}px`,
              } as JSX.CSSProperties
            }
            title={t("hubOverlay.clickToManageHero")}
          />
        );
      })}

      {/* Hero click areas - empty slots */}
      {Array.from({ length: maxHeroSlots }, (_, index) => {
        if (heroes[index]) return null; // Skip if slot is filled
        
        const formation = getFormationPosition(index, maxHeroSlots);
        const heroX = 2 + formation.xOffset;
        const heroY = formation.yOffset;
        const FP_SCALE = 1 << 16;
        
        return (
          <button
            key={`empty-hero-${index}`}
            class={`${styles.heroArea} ${styles.empty}`}
            onClick={() => handleHeroSlotClick(index)}
            style={
              {
                left: `${toScreenX(Math.round(heroX * FP_SCALE))}px`,
                top: `${fpYToScreen(Math.round(heroY * FP_SCALE), canvasSize.height)}px`,
              } as JSX.CSSProperties
            }
            title={t("hubOverlay.clickToAddHero", { defaultValue: "Kliknij aby dodać bohatera" })}
          >
            <span class={styles.addIcon}>+</span>
          </button>
        );
      })}

      {/* Turret slot click areas */}
      {slots.map((slot) => {
        const hasTurret = turrets.some((t) => t.slotIndex === slot.index);

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
            class={`${styles.turretArea} ${hasTurret ? styles.occupiedOverlay : styles.empty}`}
            onClick={() => handleTurretClick(slot.index)}
            style={
              {
                left: `${toScreenX(slot.x)}px`,
                top: `${toScreenY(slot.y)}px`,
              } as JSX.CSSProperties
            }
            title={
              hasTurret
                ? t("hubOverlay.clickToManageTurret")
                : t("hubOverlay.clickToAddTurret")
            }
          >
            {!hasTurret && <span class={styles.addIcon}>+</span>}
          </button>
        );
      })}
    </div>
  );
}
