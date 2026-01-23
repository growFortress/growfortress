/**
 * Transform HubPreviewResponse data from API to HubState format for rendering.
 * This allows the GameScene to render another player's hub configuration.
 */
import type { HubPreviewResponse, HubPreviewHero, HubPreviewTurret } from '@arcade/protocol';
import type { ActiveHero, ActiveTurret, TurretSlot, FortressClass } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import type { HubState } from '../renderer/scenes/GameScene.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fixed point scale for positions (Q16.16 format) - use canonical value from sim-core */
const FP_SCALE = FP.ONE; // 65536

/** Shift heroes away from the fortress for the smaller preview canvas */
const PREVIEW_HERO_X_OFFSET = 5.0;

/** Base X offset for hero positioning */
const HERO_BASE_X = 2;

/** Center Y position for hero formations */
const FORMATION_CENTER_Y = 7.5;

/** Y spread for multi-row formations (increased for preview canvas) */
const FORMATION_Y_SPREAD = 3.0;

/** X positions for hero slots (front to back) */
const HERO_SLOT_X = [4, 7, 10] as const;

/** Number of turret slots */
const MAX_TURRET_SLOTS = 6;

/** Fortress tier thresholds */
const TIER_2_LEVEL = 10;
const TIER_3_LEVEL = 25;

/**
 * Default turret slot positions (matching fortress.signals.ts)
 * Slots are 1-indexed (1-6), matching the renderer expectations.
 * Top row: slots 1-3 at y=2
 * Bottom row: slots 4-6 at y=13
 */
const TURRET_SLOT_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 6, y: 2 },   // Top-left (starter slot)
  2: { x: 11, y: 2 },  // Top-center
  3: { x: 16, y: 2 },  // Top-right
  4: { x: 6, y: 13 },  // Bottom-left
  5: { x: 11, y: 13 }, // Bottom-center
  6: { x: 16, y: 13 }, // Bottom-right
};

/**
 * Get hero formation position based on index and total count.
 * Copied from HubOverlay.tsx to maintain consistency.
 * @param index - Hero index in the formation (0-based)
 * @param totalCount - Total number of heroes
 * @returns Position offsets for the hero
 */
function getFormationPosition(index: number, totalCount: number): { xOffset: number; yOffset: number } {
  const defaultPos = { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y };

  switch (totalCount) {
    case 1:
      return defaultPos;
    case 2:
      return [
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y - 2 },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y + 2 },
      ][index] ?? defaultPos;
    case 3:
      return [
        { xOffset: HERO_SLOT_X[1], yOffset: FORMATION_CENTER_Y },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y - 2 },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y + 2 },
      ][index] ?? defaultPos;
    case 4:
      return [
        { xOffset: HERO_SLOT_X[1], yOffset: FORMATION_CENTER_Y },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y - 2 },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y + 2 },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y },
      ][index] ?? defaultPos;
    case 5:
      return [
        { xOffset: HERO_SLOT_X[2], yOffset: FORMATION_CENTER_Y },
        { xOffset: HERO_SLOT_X[1], yOffset: FORMATION_CENTER_Y - 2 },
        { xOffset: HERO_SLOT_X[1], yOffset: FORMATION_CENTER_Y + 2 },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y - 2 },
        { xOffset: HERO_SLOT_X[0], yOffset: FORMATION_CENTER_Y + 2 },
      ][index] ?? defaultPos;
    default: {
      // Grid layout for 6+ heroes
      const row = Math.floor(index / 3);
      const col = index % 3;
      const yPositions = [
        FORMATION_CENTER_Y - FORMATION_Y_SPREAD,
        FORMATION_CENTER_Y,
        FORMATION_CENTER_Y + FORMATION_Y_SPREAD,
      ];
      return {
        xOffset: HERO_SLOT_X[Math.min(row, 2)],
        yOffset: yPositions[col] ?? FORMATION_CENTER_Y,
      };
    }
  }
}

/**
 * Transform a HubPreviewHero to ActiveHero format for rendering.
 * @param hero - Hero data from the API
 * @param index - Hero index in the formation
 * @param totalCount - Total number of heroes
 * @returns ActiveHero object ready for rendering
 */
function transformHero(hero: HubPreviewHero, index: number, totalCount: number): ActiveHero {
  const formation = getFormationPosition(index, totalCount);
  const heroX = HERO_BASE_X + formation.xOffset + PREVIEW_HERO_X_OFFSET;
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
 * API sends 0-indexed slotIndex, but renderer uses 1-indexed slots.
 */
function generateTurretSlots(turrets: HubPreviewTurret[]): TurretSlot[] {
  // Convert API's 0-based slotIndex to renderer's 1-based slot indices
  const occupiedSlots = new Set(turrets.map(t => t.slotIndex + 1));
  const maxOccupiedSlot = turrets.length > 0
    ? Math.max(...turrets.map(t => t.slotIndex + 1))
    : 1;

  return Array.from({ length: MAX_TURRET_SLOTS }, (_, i) => i + 1)
    .map(index => {
      const pos = TURRET_SLOT_POSITIONS[index];
      return {
        index,
        x: pos.x * FP_SCALE,
        y: pos.y * FP_SCALE,
        isUnlocked: occupiedSlots.has(index) || index <= maxOccupiedSlot,
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
  if (level < TIER_2_LEVEL) return 1;
  if (level < TIER_3_LEVEL) return 2;
  return 3;
}
