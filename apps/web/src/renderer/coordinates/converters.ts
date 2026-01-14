/**
 * Core coordinate conversion functions.
 * Handles transformations between fixed-point, game units, and screen pixels.
 */

import { FP } from '@arcade/sim-core';
import {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  PATH_TOP_PERCENT,
  PATH_BOTTOM_PERCENT,
} from './constants.js';

// ============================================================================
// FIXED-POINT <-> GAME UNIT CONVERSIONS
// ============================================================================

/**
 * Convert fixed-point (Q16.16) to game units (float).
 * @param fp - Fixed-point value from sim-core
 * @returns Value in game units (e.g., 0-40 for X)
 */
export function fpToGameUnit(fp: number): number {
  return FP.toFloat(fp);
}

/**
 * Convert game units to fixed-point.
 * @param unit - Value in game units
 * @returns Fixed-point value for sim-core
 */
export function gameUnitToFp(unit: number): number {
  return FP.fromFloat(unit);
}

// ============================================================================
// GAME UNIT <-> SCREEN PIXEL CONVERSIONS (X-axis - linear mapping)
// ============================================================================

/**
 * Convert X from game units to screen pixels.
 * Linear mapping: 0 -> 0, FIELD_WIDTH -> viewWidth
 */
export function gameUnitXToScreen(unitX: number, viewWidth: number): number {
  return (unitX / FIELD_WIDTH) * viewWidth;
}

/**
 * Convert X from screen pixels to game units.
 * Inverse of gameUnitXToScreen.
 */
export function screenXToGameUnit(screenX: number, viewWidth: number): number {
  return (screenX / viewWidth) * FIELD_WIDTH;
}

// ============================================================================
// GAME UNIT <-> SCREEN PIXEL CONVERSIONS (Y-axis - path area mapping)
// ============================================================================

/**
 * Convert Y from game units to screen pixels.
 * Maps FIELD_HEIGHT (0-15) to path area (35%-65% of screen).
 *
 * Used by: heroes, projectiles (full Y range)
 */
export function gameUnitYToScreen(unitY: number, viewHeight: number): number {
  const pathTop = viewHeight * PATH_TOP_PERCENT;
  const pathBottom = viewHeight * PATH_BOTTOM_PERCENT;
  const pathHeight = pathBottom - pathTop;

  return pathTop + (unitY / FIELD_HEIGHT) * pathHeight;
}

/**
 * Convert Y from screen pixels to game units.
 * Clamps to path area before conversion.
 */
export function screenYToGameUnit(screenY: number, viewHeight: number): number {
  const pathTop = viewHeight * PATH_TOP_PERCENT;
  const pathBottom = viewHeight * PATH_BOTTOM_PERCENT;
  const pathHeight = pathBottom - pathTop;

  // Clamp to path area
  const clampedY = Math.max(pathTop, Math.min(pathBottom, screenY));

  return ((clampedY - pathTop) / pathHeight) * FIELD_HEIGHT;
}

// ============================================================================
// COMBINED FIXED-POINT -> SCREEN CONVERSIONS (convenience functions)
// ============================================================================

/**
 * Convert X from fixed-point directly to screen pixels.
 * Combines fpToGameUnit + gameUnitXToScreen.
 */
export function fpXToScreen(fpX: number, viewWidth: number): number {
  const unitX = fpToGameUnit(fpX);
  return gameUnitXToScreen(unitX, viewWidth);
}

/**
 * Convert Y from fixed-point to screen pixels (standard path mapping).
 * Combines fpToGameUnit + gameUnitYToScreen.
 *
 * Used by: heroes, projectiles
 */
export function fpYToScreen(fpY: number, viewHeight: number): number {
  const unitY = fpToGameUnit(fpY);
  return gameUnitYToScreen(unitY, viewHeight);
}

// ============================================================================
// VIEWPORT HELPERS
// ============================================================================

/**
 * Calculate path area dimensions in pixels.
 */
export function getPathBounds(viewHeight: number): {
  top: number;
  bottom: number;
  height: number;
} {
  const top = viewHeight * PATH_TOP_PERCENT;
  const bottom = viewHeight * PATH_BOTTOM_PERCENT;
  return {
    top,
    bottom,
    height: bottom - top,
  };
}
