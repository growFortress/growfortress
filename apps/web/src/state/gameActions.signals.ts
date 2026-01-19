import { signal } from '@preact/signals';

/**
 * Game action callbacks - set by useGameLoop, called by UI components.
 * This avoids prop drilling while maintaining type safety.
 */

// Turret targeting mode change callback
export const setTurretTargetingFn = signal<((
  slotIndex: number,
  mode: 'closest_to_fortress' | 'weakest' | 'strongest' | 'nearest_to_turret' | 'fastest'
) => void) | null>(null);

// Turret overcharge activation callback
export const activateOverchargeFn = signal<((slotIndex: number) => void) | null>(null);

// Wall placement callback
export const placeWallFn = signal<((
  wallType: 'basic' | 'reinforced' | 'gate',
  x: number,
  y: number
) => void) | null>(null);

// Wall removal callback
export const removeWallFn = signal<((wallId: number) => void) | null>(null);

// Militia spawn callback
export const spawnMilitiaFn = signal<((
  militiaType: 'infantry' | 'archer' | 'shield_bearer',
  x: number,
  y: number,
  count?: number
) => void) | null>(null);

/**
 * Set turret targeting mode (called from UI components)
 */
export function setTurretTargeting(
  slotIndex: number,
  mode: 'closest_to_fortress' | 'weakest' | 'strongest' | 'nearest_to_turret' | 'fastest'
): void {
  const fn = setTurretTargetingFn.value;
  if (fn) fn(slotIndex, mode);
}

/**
 * Activate turret overcharge (called from UI components)
 */
export function activateOvercharge(slotIndex: number): void {
  const fn = activateOverchargeFn.value;
  if (fn) fn(slotIndex);
}

/**
 * Place a wall (called from UI components)
 */
export function placeWall(
  wallType: 'basic' | 'reinforced' | 'gate',
  x: number,
  y: number
): void {
  const fn = placeWallFn.value;
  if (fn) fn(wallType, x, y);
}

/**
 * Remove a wall (called from UI components)
 */
export function removeWall(wallId: number): void {
  const fn = removeWallFn.value;
  if (fn) fn(wallId);
}

/**
 * Spawn militia (called from UI components)
 */
export function spawnMilitia(
  militiaType: 'infantry' | 'archer' | 'shield_bearer',
  x: number,
  y: number,
  count?: number
): void {
  const fn = spawnMilitiaFn.value;
  if (fn) fn(militiaType, x, y, count);
}

/**
 * Reset all game action callbacks (called on game reset)
 */
export function resetGameActions(): void {
  setTurretTargetingFn.value = null;
  activateOverchargeFn.value = null;
  placeWallFn.value = null;
  removeWallFn.value = null;
  spawnMilitiaFn.value = null;
}
