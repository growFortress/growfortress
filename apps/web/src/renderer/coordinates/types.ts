/**
 * Type definitions for the coordinate system.
 * Uses branded types to prevent mixing up different coordinate spaces.
 */

// ============================================================================
// BRANDED TYPES FOR TYPE SAFETY
// ============================================================================

/**
 * Fixed-point coordinate (Q16.16 format from sim-core).
 * 65536 = 1.0 game unit.
 */
export type FixedPointCoord = number & { readonly __brand: 'FixedPoint' };

/**
 * Game unit coordinate (floating point).
 * X: 0-40, Y: 0-15.
 */
export type GameUnitCoord = number & { readonly __brand: 'GameUnit' };

/**
 * Screen pixel coordinate.
 */
export type ScreenPixelCoord = number & { readonly __brand: 'ScreenPixel' };

// ============================================================================
// POINT TYPES
// ============================================================================

export interface Point2D<T> {
  x: T;
  y: T;
}

export type FixedPointPosition = Point2D<FixedPointCoord>;
export type GameUnitPosition = Point2D<GameUnitCoord>;
export type ScreenPosition = Point2D<ScreenPixelCoord>;

// ============================================================================
// VIEWPORT
// ============================================================================

export interface ViewportSize {
  width: number;
  height: number;
}

// ============================================================================
// ENTITY TYPES
// ============================================================================

export type EntityType = 'hero' | 'turret' | 'enemy' | 'projectile' | 'fortress';
