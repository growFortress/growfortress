/**
 * Fortress Aura System
 *
 * Applies passive aura bonuses to turrets and heroes within range of the fortress.
 */

import { FP } from '../fixed.js';
import type { GameState, SimConfig, ModifierSet } from '../types.js';
import { getAvailableAuras, type FortressAuraDefinition } from '../data/fortress-auras.js';
import { TURRET_SLOTS } from '../data/turrets.js';

// ============================================================================
// AURA EFFECT TRACKING
// ============================================================================

export interface AuraEffect {
  auraId: string;
  modifiers: Partial<ModifierSet>;
}

export interface EntityAuraEffects {
  entityId: string | number;
  entityType: 'hero' | 'turret';
  activeAuras: AuraEffect[];
  totalModifiers: Partial<ModifierSet>;
}

// Cache for aura effects (recalculated when needed)
let cachedAuraEffects: EntityAuraEffects[] = [];
let cacheValidTick = -1;

// ============================================================================
// MAIN UPDATE FUNCTION
// ============================================================================

/**
 * Calculate and cache aura effects for all entities
 * Should be called once per tick before damage calculations
 */
export function updateFortressAuras(
  state: GameState,
  config: SimConfig
): void {
  // Only recalculate if cache is stale
  if (cacheValidTick === state.tick) return;

  cachedAuraEffects = [];

  // Get fortress position
  const fortressX = config.fortressX;
  const fortressY = FP.fromFloat(7.5); // Center of field height

  // Get available auras for current class and level
  const availableAuras = getAvailableAuras(
    state.fortressClass,
    state.commanderLevel
  );

  // Calculate effects for each hero
  for (const hero of state.heroes) {
    const effects = calculateEntityAuraEffects(
      hero.x,
      hero.y,
      fortressX,
      fortressY,
      availableAuras,
      'hero'
    );

    if (effects.activeAuras.length > 0) {
      cachedAuraEffects.push({
        entityId: hero.definitionId,
        entityType: 'hero',
        ...effects,
      });
    }
  }

  // Calculate effects for each turret
  for (const turret of state.turrets) {
    const slot = TURRET_SLOTS.find(s => s.id === turret.slotIndex);
    if (!slot) continue;

    const turretX = FP.add(config.fortressX, FP.fromFloat(slot.offsetX));
    const turretY = FP.fromFloat(7 + slot.offsetY);

    const effects = calculateEntityAuraEffects(
      turretX,
      turretY,
      fortressX,
      fortressY,
      availableAuras,
      'turret'
    );

    if (effects.activeAuras.length > 0) {
      cachedAuraEffects.push({
        entityId: turret.slotIndex,
        entityType: 'turret',
        ...effects,
      });
    }
  }

  cacheValidTick = state.tick;
}

/**
 * Calculate aura effects for a single entity
 */
function calculateEntityAuraEffects(
  entityX: number,
  entityY: number,
  fortressX: number,
  fortressY: number,
  auras: FortressAuraDefinition[],
  entityType: 'hero' | 'turret'
): { activeAuras: AuraEffect[]; totalModifiers: Partial<ModifierSet> } {
  const activeAuras: AuraEffect[] = [];
  const totalModifiers: Partial<ModifierSet> = {};

  const distSq = FP.distSq(entityX, entityY, fortressX, fortressY);

  for (const aura of auras) {
    // Check if entity type matches aura target
    if (aura.targetType !== 'both' && aura.targetType !== entityType) {
      continue;
    }

    // Check if within aura radius
    const radiusSq = FP.mul(aura.radius, aura.radius);
    if (distSq > radiusSq) {
      continue;
    }

    // Entity is affected by this aura
    activeAuras.push({
      auraId: aura.id,
      modifiers: aura.modifiers,
    });

    // Add modifiers to total
    for (const [key, value] of Object.entries(aura.modifiers)) {
      const modKey = key as keyof ModifierSet;
      const currentValue = (totalModifiers[modKey] as number) ?? 0;
      totalModifiers[modKey] = currentValue + (value as number);
    }
  }

  return { activeAuras, totalModifiers };
}

// ============================================================================
// ACCESSOR FUNCTIONS
// ============================================================================

/**
 * Get aura effects for a specific hero
 */
export function getHeroAuraEffects(heroId: string): EntityAuraEffects | undefined {
  return cachedAuraEffects.find(
    e => e.entityType === 'hero' && e.entityId === heroId
  );
}

/**
 * Get aura effects for a specific turret
 */
export function getTurretAuraEffects(slotIndex: number): EntityAuraEffects | undefined {
  return cachedAuraEffects.find(
    e => e.entityType === 'turret' && e.entityId === slotIndex
  );
}

/**
 * Get total aura damage bonus for a hero
 */
export function getHeroAuraDamageBonus(heroId: string): number {
  const effects = getHeroAuraEffects(heroId);
  return effects?.totalModifiers.damageBonus ?? 0;
}

/**
 * Get total aura damage bonus for a turret
 */
export function getTurretAuraDamageBonus(slotIndex: number): number {
  const effects = getTurretAuraEffects(slotIndex);
  return effects?.totalModifiers.damageBonus ?? 0;
}

/**
 * Get total aura attack speed bonus for an entity
 */
export function getAuraAttackSpeedBonus(
  entityType: 'hero' | 'turret',
  entityId: string | number
): number {
  const effects = cachedAuraEffects.find(
    e => e.entityType === entityType && e.entityId === entityId
  );
  return effects?.totalModifiers.attackSpeedBonus ?? 0;
}

/**
 * Get all active aura effects (for rendering)
 */
export function getAllAuraEffects(): EntityAuraEffects[] {
  return cachedAuraEffects;
}

/**
 * Invalidate aura cache (call when hero/turret positions change significantly)
 */
export function invalidateAuraCache(): void {
  cacheValidTick = -1;
}
