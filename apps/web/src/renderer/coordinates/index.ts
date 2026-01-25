/**
 * Coordinate System Module
 *
 * Centralized coordinate conversion for Pixi.js renderer.
 * Single source of truth for all positioning calculations.
 *
 * @example
 * ```typescript
 * import {
 *   fpXToScreen,
 *   fpYToScreen,
 *   turretPositionToScreen,
 *   calculateEnemyLaneY,
 *   FIELD_WIDTH,
 * } from '../coordinates/index.js';
 *
 * // Hero/Projectile (full Y range)
 * const screenX = fpXToScreen(hero.x, viewWidth);
 * const screenY = fpYToScreen(hero.y, viewHeight);
 *
 * // Turret (snaps to lanes)
 * const { x, y } = turretPositionToScreen(turret.x, turret.y, w, h);
 *
 * // Enemy (lane-based Y)
 * const enemyY = calculateEnemyLaneY(enemy.id, viewHeight);
 * ```
 */

// Re-export types
export type {
  FixedPointCoord,
  GameUnitCoord,
  ScreenPixelCoord,
  Point2D,
  FixedPointPosition,
  GameUnitPosition,
  ScreenPosition,
  ViewportSize,
  EntityType,
} from './types.js';

// Re-export constants
export {
  FIELD_WIDTH,
  FIELD_HEIGHT,
  FIELD_CENTER_Y,
  PATH_TOP_PERCENT,
  PATH_BOTTOM_PERCENT,
  PATH_HEIGHT_PERCENT,
  TURRET_LANE_HEIGHT_PERCENT,
  ENEMY_VERTICAL_LANES,
  ENEMY_VERTICAL_SPREAD_PX,
  FORTRESS_POSITION_X,
  FORTRESS_HP_BAR_OFFSET,
  ENEMY_HP_BAR_OFFSET,
  GRID_SPACING,
  FP_SCALE,
} from './constants.js';

// Re-export converters
export {
  fpToGameUnit,
  gameUnitToFp,
  gameUnitXToScreen,
  screenXToGameUnit,
  gameUnitYToScreen,
  screenYToGameUnit,
  fpXToScreen,
  fpYToScreen,
  getPathBounds,
} from './converters.js';

// Re-export entity transforms
export {
  turretYToScreen,
  turretPositionToScreen,
  calculateEnemyLaneY,
  enemyPositionToScreen,
  getTurretLaneBounds,
  type TurretLaneBounds,
} from './entity-transforms.js';
