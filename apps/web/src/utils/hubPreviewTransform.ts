/**
 * Transform HubPreviewResponse data from API to HubState format for rendering.
 * This allows the GameScene to render another player's hub configuration.
 */
import type { HubPreviewResponse, HubPreviewHero, HubPreviewTurret } from '@arcade/protocol';
import type { ActiveHero, ActiveTurret, TurretSlot, FortressClass } from '@arcade/sim-core';
import type { HubState } from '../renderer/scenes/GameScene.js';

// Fixed point scale (Q16.16 format)
const FP_SCALE = 1 << 16; // 65536
// Shift heroes away from the fortress for the smaller preview canvas.
const PREVIEW_HERO_X_OFFSET = 2.5;

/**
 * Default turret slot positions (matching fortress.signals.ts)
 */
const TURRET_SLOT_POSITIONS: Record<number, { x: number; y: number }> = {
  0: { x: 6, y: 2 },
  1: { x: 6, y: 2 },
  2: { x: 11, y: 2 },
  3: { x: 16, y: 2 },
  4: { x: 6, y: 13 },
  5: { x: 11, y: 13 },
  6: { x: 16, y: 13 },
};

/**
 * Get hero formation position based on index and total count.
 * Copied from HubOverlay.tsx to maintain consistency.
 */
function getFormationPosition(index: number, totalCount: number): { xOffset: number; yOffset: number } {
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
}

/**
 * Transform a HubPreviewHero to ActiveHero format for rendering.
 */
function transformHero(hero: HubPreviewHero, index: number, totalCount: number): ActiveHero {
  const formation = getFormationPosition(index, totalCount);
  const heroX = 2 + formation.xOffset + PREVIEW_HERO_X_OFFSET;
  const heroY = formation.yOffset;

  return {
    definitionId: hero.heroId,
    tier: hero.tier as 1 | 2 | 3,
    level: hero.level,
    xp: 0,
    currentHp: 100,
    maxHp: 100,
    x: Math.round(heroX * FP_SCALE),
    y: Math.round(heroY * FP_SCALE),
    vx: 0,
    vy: 0,
    radius: FP_SCALE,
    mass: FP_SCALE,
    movementModifiers: [],
    state: 'idle',
    lastAttackTick: 0,
    lastDeployTick: 0,
    skillCooldowns: {},
    buffs: [],
    equippedItems: [],
  };
}

/**
 * Transform a HubPreviewTurret to ActiveTurret format for rendering.
 */
function transformTurret(turret: HubPreviewTurret, fortressClass: FortressClass): ActiveTurret {
  return {
    definitionId: turret.turretType,
    tier: turret.tier as 1 | 2 | 3,
    currentClass: fortressClass,
    // Hub preview slots are 1-based in the renderer.
    slotIndex: turret.slotIndex + 1,
    lastAttackTick: 0,
    specialCooldown: 0,
    targetingMode: 'closest_to_fortress',
    currentHp: 100,
    maxHp: 100,
  };
}

/**
 * Generate turret slots array based on turrets present.
 */
function generateTurretSlots(turrets: HubPreviewTurret[]): TurretSlot[] {
  // Always return all 6 slots, marking ones with turrets as unlocked
  const occupiedSlots = new Set(turrets.map(t => t.slotIndex));

  return [1, 2, 3, 4, 5, 6]
    .map(index => {
      const pos = TURRET_SLOT_POSITIONS[index] || TURRET_SLOT_POSITIONS[1];
      return {
        index,
        x: pos.x * FP_SCALE,
        y: pos.y * FP_SCALE,
        isUnlocked: occupiedSlots.has(index) || index <= Math.max(...occupiedSlots, 1),
      };
    })
    .filter(slot => slot.isUnlocked);
}

/**
 * Transform HubPreviewResponse to HubState for rendering.
 */
export function transformHubPreviewToHubState(preview: HubPreviewResponse): HubState {
  const fortressClass = preview.fortressClass as FortressClass;
  const heroCount = preview.heroes.length;

  return {
    heroes: preview.heroes.map((hero, index) => transformHero(hero, index, heroCount)),
    turrets: preview.turrets.map(turret => transformTurret(turret, fortressClass)),
    turretSlots: generateTurretSlots(preview.turrets),
  };
}

/**
 * Get fortress tier based on level (matching GameScene logic).
 */
export function getFortressTierFromLevel(level: number): 1 | 2 | 3 {
  if (level < 10) return 1;
  if (level < 25) return 2;
  return 3;
}
