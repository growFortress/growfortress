/**
 * Centralized Coordinate System for Pixi.js Renderer
 * ==================================================
 *
 * This module provides a single source of truth for all coordinate
 * conversions between different coordinate systems:
 *
 * 1. Fixed-Point (Q16.16) - used by sim-core for determinism
 * 2. Game Units - floating point representation of game field (0-40 x 0-15)
 * 3. Screen Pixels - canvas/viewport coordinates
 *
 * @example
 * ```typescript
 * import { coords } from './CoordinateSystem.js';
 *
 * // Hero/Projectile (full Y range)
 * const screenX = coords.fpXToScreen(hero.x, viewWidth);
 * const screenY = coords.fpYToScreen(hero.y, viewHeight);
 *
 * // Turret (snaps to lanes)
 * const { x, y } = coords.turretPositionToScreen(turret.x, turret.y, w, h);
 *
 * // Enemy (lane-based Y)
 * const enemyY = coords.calculateEnemyLaneY(enemy.id, viewHeight);
 *
 * // Reverse (click detection)
 * const gameX = coords.screenXToGameUnit(clickX, viewWidth);
 * ```
 */

// Re-export everything from the coordinates module
export * from './coordinates/index.js';

// Import for namespace export
import * as constants from './coordinates/constants.js';
import * as converters from './coordinates/converters.js';
import * as entityTransforms from './coordinates/entity-transforms.js';

/**
 * Namespace export for convenient access to all coordinate functions.
 *
 * @example
 * import { coords } from './CoordinateSystem.js';
 * const x = coords.fpXToScreen(hero.x, width);
 */
export const coords = {
  ...constants,
  ...converters,
  ...entityTransforms,
} as const;
