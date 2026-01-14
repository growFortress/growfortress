/**
 * Entity-specific coordinate transforms.
 * Handles special positioning logic for turrets (lanes) and enemies (visual spread).
 */

import {
  FIELD_CENTER_Y,
  TURRET_LANE_HEIGHT_PERCENT,
  PATH_TOP_PERCENT,
  PATH_BOTTOM_PERCENT,
  ENEMY_VERTICAL_LANES,
  ENEMY_VERTICAL_SPREAD_PX,
} from './constants.js';
import { fpToGameUnit, fpXToScreen } from './converters.js';

// ============================================================================
// TURRET Y-AXIS TRANSFORM (snap to top/bottom lane)
// ============================================================================

/**
 * Convert turret Y from fixed-point to screen pixels.
 * Turrets snap to dedicated lanes (above/below path area).
 *
 * - unitY < 7.5 -> top lane (just above path)
 * - unitY >= 7.5 -> bottom lane (just below path)
 */
export function turretYToScreen(fpY: number, viewHeight: number): number {
  const unitY = fpToGameUnit(fpY);
  const turretLaneH = viewHeight * TURRET_LANE_HEIGHT_PERCENT;
  const pathTop = viewHeight * PATH_TOP_PERCENT;
  const pathBottom = viewHeight * PATH_BOTTOM_PERCENT;

  if (unitY < FIELD_CENTER_Y) {
    // Top turret lane (above path)
    const topLaneY = pathTop - turretLaneH;
    return topLaneY + turretLaneH / 2;
  } else {
    // Bottom turret lane (below path)
    return pathBottom + turretLaneH / 2;
  }
}

/**
 * Full turret position conversion (X + Y).
 */
export function turretPositionToScreen(
  fpX: number,
  fpY: number,
  viewWidth: number,
  viewHeight: number
): { x: number; y: number } {
  return {
    x: fpXToScreen(fpX, viewWidth),
    y: turretYToScreen(fpY, viewHeight),
  };
}

// ============================================================================
// ENEMY Y-AXIS TRANSFORM (lane-based with pixel spacing)
// ============================================================================

/**
 * Calculate enemy Y based on its ID (lane system).
 * Enemies are spread across ENEMY_VERTICAL_LANES lanes for visual variety.
 *
 * @param enemyId - Unique enemy ID (used to assign lane)
 * @param viewHeight - Viewport height
 * @returns Screen Y coordinate (centered in assigned lane)
 */
export function calculateEnemyLaneY(enemyId: number, viewHeight: number): number {
  const laneOffset = (enemyId % ENEMY_VERTICAL_LANES) - Math.floor(ENEMY_VERTICAL_LANES / 2);
  const centerY = viewHeight / 2;
  return centerY + laneOffset * ENEMY_VERTICAL_SPREAD_PX;
}

/**
 * Full enemy position conversion.
 * X uses standard conversion, Y uses lane system.
 */
export function enemyPositionToScreen(
  fpX: number,
  enemyId: number,
  viewWidth: number,
  viewHeight: number
): { x: number; y: number } {
  return {
    x: fpXToScreen(fpX, viewWidth),
    y: calculateEnemyLaneY(enemyId, viewHeight),
  };
}

// ============================================================================
// TURRET LANE BOUNDS (for click detection and rendering)
// ============================================================================

export interface TurretLaneBounds {
  topLane: { top: number; bottom: number; centerY: number };
  bottomLane: { top: number; bottom: number; centerY: number };
}

/**
 * Calculate turret lane bounds in pixels.
 * Used for click detection in HubOverlay and rendering in GameScene.
 */
export function getTurretLaneBounds(viewHeight: number): TurretLaneBounds {
  const turretLaneH = viewHeight * TURRET_LANE_HEIGHT_PERCENT;
  const pathTop = viewHeight * PATH_TOP_PERCENT;
  const pathBottom = viewHeight * PATH_BOTTOM_PERCENT;

  const topLaneBottom = pathTop;
  const topLaneTop = topLaneBottom - turretLaneH;

  const bottomLaneTop = pathBottom;
  const bottomLaneBottom = bottomLaneTop + turretLaneH;

  return {
    topLane: {
      top: topLaneTop,
      bottom: topLaneBottom,
      centerY: topLaneTop + turretLaneH / 2,
    },
    bottomLane: {
      top: bottomLaneTop,
      bottom: bottomLaneBottom,
      centerY: bottomLaneTop + turretLaneH / 2,
    },
  };
}
