/**
 * Centralized layout constants for the coordinate system.
 * Single source of truth for all positioning calculations.
 */

// ============================================================================
// GAME FIELD DIMENSIONS (in game units)
// ============================================================================

/** Width of the game field in units (X ranges 0 to FIELD_WIDTH) */
export const FIELD_WIDTH = 40;

/** Height of the game field in units (Y ranges 0 to FIELD_HEIGHT) */
export const FIELD_HEIGHT = 15;

/** Center Y coordinate of the field */
export const FIELD_CENTER_Y = FIELD_HEIGHT / 2; // 7.5

// ============================================================================
// SCREEN LAYOUT (as percentages 0-1)
// ============================================================================

/** Top edge of the path area as % of screen height */
export const PATH_TOP_PERCENT = 0.35;

/** Bottom edge of the path area as % of screen height */
export const PATH_BOTTOM_PERCENT = 0.65;

/** Path height as % of screen (PATH_BOTTOM - PATH_TOP) */
export const PATH_HEIGHT_PERCENT = PATH_BOTTOM_PERCENT - PATH_TOP_PERCENT; // 0.30

/** Turret lane height as % of screen height */
export const TURRET_LANE_HEIGHT_PERCENT = 0.06;

// ============================================================================
// ENEMY LANE SYSTEM
// ============================================================================

/** Number of vertical lanes for enemy visual spread */
export const ENEMY_VERTICAL_LANES = 7;

/** Pixel spacing between enemy lanes */
export const ENEMY_VERTICAL_SPREAD_PX = 40;

// ============================================================================
// FORTRESS POSITIONING
// ============================================================================

/** Fortress X position in game units */
export const FORTRESS_POSITION_X = 2;

/** Fortress HP bar offset in pixels */
export const FORTRESS_HP_BAR_OFFSET = 20;

/** Enemy HP bar offset in pixels */
export const ENEMY_HP_BAR_OFFSET = 8;

/** Grid spacing in pixels */
export const GRID_SPACING = 80;

// ============================================================================
// FIXED-POINT SCALE (Q16.16 format)
// ============================================================================

/** Fixed-point scale factor (65536 = 1.0 unit) */
export const FP_SCALE = 65536;

