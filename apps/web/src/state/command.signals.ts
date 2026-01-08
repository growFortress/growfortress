import { signal } from '@preact/signals';

/**
 * Hero command system signals
 * Allows player to issue tactical orders to heroes during combat waves
 */

// Currently selected hero for command (null = no hero selected)
export const commandSelectedHeroId = signal<string | null>(null);

// Target position for command (fixed-point coordinates)
export const commandTargetPosition = signal<{ x: number; y: number } | null>(null);

/**
 * Select a hero for command mode
 */
export function selectHeroForCommand(heroId: string): void {
  commandSelectedHeroId.value = heroId;
  commandTargetPosition.value = null;
}

/**
 * Set the target position for the current command
 */
export function setCommandTarget(x: number, y: number): void {
  commandTargetPosition.value = { x, y };
}

/**
 * Cancel command mode (deselect hero)
 */
export function cancelCommand(): void {
  commandSelectedHeroId.value = null;
  commandTargetPosition.value = null;
}

/**
 * Clear command for a specific hero (called when hero reaches destination)
 */
export function clearCommandForHero(heroId: string): void {
  if (commandSelectedHeroId.value === heroId) {
    cancelCommand();
  }
}
