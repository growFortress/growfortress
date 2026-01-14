import { useMemo } from 'preact/hooks';
import {
  fpXToScreen,
  turretYToScreen,
  getTurretLaneBounds,
  getPathBounds,
  type TurretLaneBounds,
} from '../renderer/CoordinateSystem.js';

interface CoordinateHelpers {
  /** Convert FP X to screen pixels */
  toScreenX: (fpX: number) => number;
  /** Convert FP Y to screen pixels (turret lane snapping) */
  toScreenY: (fpY: number) => number;
  /** Get turret lane bounds for click detection */
  turretLanes: TurretLaneBounds;
  /** Get path bounds */
  pathBounds: { top: number; bottom: number; height: number };
}

/**
 * React hook providing coordinate conversion functions for components.
 * Memoizes helpers based on canvas dimensions.
 *
 * @param canvasWidth - Canvas width in pixels
 * @param canvasHeight - Canvas height in pixels
 *
 * @example
 * ```tsx
 * const { toScreenX, toScreenY } = useCoordinates(canvasSize.width, canvasSize.height);
 *
 * <button style={{ left: toScreenX(slot.x), top: toScreenY(slot.y) }}>
 * ```
 */
export function useCoordinates(
  canvasWidth: number,
  canvasHeight: number
): CoordinateHelpers {
  return useMemo(() => {
    return {
      toScreenX: (fpX: number) => fpXToScreen(fpX, canvasWidth),
      toScreenY: (fpY: number) => turretYToScreen(fpY, canvasHeight),
      turretLanes: getTurretLaneBounds(canvasHeight),
      pathBounds: getPathBounds(canvasHeight),
    };
  }, [canvasWidth, canvasHeight]);
}
