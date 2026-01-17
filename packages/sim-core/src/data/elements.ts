/**
 * Element Counter System
 *
 * Rock-Paper-Scissors style counter system for heroes vs enemies.
 * Soft counters (+15-35%) rather than hard counters to keep all heroes viable.
 */

import type { PillarId } from '../types.js';

// Element types separate from hero classes
export type ElementType = 'fire' | 'ice' | 'lightning' | 'void' | 'cosmic' | 'tech';

/**
 * Counter matrix: [attacker][defender] = damage multiplier
 * 1.0 = neutral, >1.0 = effective, <1.0 = resisted
 */
export const ELEMENT_COUNTERS: Record<ElementType, Record<ElementType, number>> = {
  fire: {
    fire: 1.0,
    ice: 1.35,        // Fire melts ice
    lightning: 0.85,
    void: 1.0,
    cosmic: 0.85,
    tech: 1.15,       // Fire damages tech
  },
  ice: {
    fire: 0.85,
    ice: 1.0,
    lightning: 1.15,  // Ice conducts lightning
    void: 1.0,
    cosmic: 1.35,     // Ice vs cosmic energy
    tech: 0.85,
  },
  lightning: {
    fire: 1.15,
    ice: 0.85,
    lightning: 1.0,
    void: 0.85,
    cosmic: 1.0,
    tech: 1.35,       // Lightning fries tech
  },
  void: {
    fire: 1.0,
    ice: 1.0,
    lightning: 1.15,
    void: 1.0,
    cosmic: 0.85,     // Void vs cosmic is balanced
    tech: 1.0,
  },
  cosmic: {
    fire: 1.15,
    ice: 0.85,
    lightning: 1.0,
    void: 1.15,       // Cosmic counters void
    cosmic: 1.0,
    tech: 0.85,
  },
  tech: {
    fire: 0.85,
    ice: 1.15,
    lightning: 0.85,
    void: 1.0,
    cosmic: 1.15,
    tech: 1.0,
  },
};

/**
 * Map hero IDs to their element
 */
export const HERO_ELEMENTS: Record<string, ElementType> = {
  // Fire heroes
  'inferno': 'fire',
  'blaze': 'fire',

  // Ice heroes
  'frost': 'ice',
  'glacier': 'ice',

  // Lightning heroes
  'storm': 'lightning',
  'voltage': 'lightning',

  // Void heroes
  'rift': 'void',
  'omega': 'void',
  'titan': 'void',

  // Cosmic heroes
  'nova': 'cosmic',
  'zenith': 'cosmic',

  // Tech heroes
  'cipher': 'tech',
  'forge': 'tech',
  'vanguard': 'tech',
};

/**
 * Map pillars to their dominant element
 */
export const PILLAR_ELEMENTS: Record<PillarId, ElementType> = {
  streets: 'tech',
  science: 'lightning',
  mutants: 'cosmic',
  cosmos: 'cosmic',
  magic: 'void',
  gods: 'fire',
};

/**
 * Get element for a hero by ID
 */
export function getHeroElement(heroId: string): ElementType {
  return HERO_ELEMENTS[heroId.toLowerCase()] ?? 'tech';
}

/**
 * Get element for a pillar
 */
export function getPillarElement(pillarId: PillarId): ElementType {
  return PILLAR_ELEMENTS[pillarId];
}

/**
 * Calculate damage multiplier between attacker and defender elements
 */
export function getElementMultiplier(attackerElement: ElementType, defenderElement: ElementType): number {
  return ELEMENT_COUNTERS[attackerElement]?.[defenderElement] ?? 1.0;
}

/**
 * Calculate hero's element effectiveness against current pillar
 */
export function getHeroElementEffectiveness(heroId: string, pillarId: PillarId): number {
  const heroElement = getHeroElement(heroId);
  const pillarElement = getPillarElement(pillarId);
  return getElementMultiplier(heroElement, pillarElement);
}

/**
 * Get text description of element effectiveness
 */
export function getEffectivenessDescription(multiplier: number): string {
  if (multiplier >= 1.30) return 'Super Effective';
  if (multiplier >= 1.10) return 'Effective';
  if (multiplier <= 0.70) return 'Not Very Effective';
  if (multiplier <= 0.90) return 'Resisted';
  return 'Neutral';
}

/**
 * Get all heroes that are effective against a pillar
 */
export function getEffectiveHeroesForPillar(pillarId: PillarId): string[] {
  const pillarElement = getPillarElement(pillarId);
  const effectiveHeroes: string[] = [];

  for (const [heroId, element] of Object.entries(HERO_ELEMENTS)) {
    const multiplier = getElementMultiplier(element, pillarElement);
    if (multiplier > 1.0) {
      effectiveHeroes.push(heroId);
    }
  }

  return effectiveHeroes;
}

/**
 * Get all heroes that are weak against a pillar
 */
export function getWeakHeroesForPillar(pillarId: PillarId): string[] {
  const pillarElement = getPillarElement(pillarId);
  const weakHeroes: string[] = [];

  for (const [heroId, element] of Object.entries(HERO_ELEMENTS)) {
    const multiplier = getElementMultiplier(element, pillarElement);
    if (multiplier < 1.0) {
      weakHeroes.push(heroId);
    }
  }

  return weakHeroes;
}
