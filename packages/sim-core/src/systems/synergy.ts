/**
 * Synergy System
 *
 * Calculates synergy bonuses based on hero/turret class matching
 * and pillar damage modifiers.
 *
 * Uses additive bonus system: base × (1 + sum of bonuses)
 */

import type { GameState, ModifierSet } from '../types.js';
import { getHeroById } from '../data/heroes.js';
import { getPillarForWave, calculatePillarDamageMultiplier } from '../data/pillars.js';
import { getRelicById, type ExtendedRelicDef } from '../data/relics.js';
import type { MasterySynergyAmplifier } from '../data/mastery.js';

/**
 * Mastery synergy amplifiers that boost existing synergy bonuses
 */
export interface SynergyMasteryAmplifiers {
  /** Multiplier to hero-fortress synergy bonuses (0.15 = +15% to those bonuses) */
  heroSynergyBonus?: number;
  /** Multiplier to turret-fortress synergy bonuses */
  turretSynergyBonus?: number;
  /** Multiplier to full synergy bonus */
  fullSynergyBonus?: number;
}

/**
 * Calculate synergy bonuses based on hero/turret class matching
 * Returns additive bonuses that should be added to base modifiers
 *
 * @param state - Current game state
 * @param masteryAmplifiers - Optional mastery bonuses that amplify synergy effects
 */
export function calculateSynergyBonuses(
  state: GameState,
  masteryAmplifiers?: MasterySynergyAmplifier
): Partial<ModifierSet> {
  const bonuses: Partial<ModifierSet> = {};

  const fortressClass = state.fortressClass;

  // Count matching classes
  let heroMatches = 0;
  let turretMatches = 0;

  for (const hero of state.heroes) {
    const heroDef = getHeroById(hero.definitionId);
    if (heroDef && heroDef.class === fortressClass) {
      heroMatches++;
    }
  }

  for (const turret of state.turrets) {
    if (turret.currentClass === fortressClass) {
      turretMatches++;
    }
  }

  // Helper to add to additive bonus (all bonuses are additive now)
  const addBonus = (key: keyof ModifierSet, amount: number): void => {
    bonuses[key] = ((bonuses[key] as number) ?? 0) + amount;
  };

  // Mastery amplifier multipliers (default to 1.0 = no amplification)
  const heroAmp = 1 + (masteryAmplifiers?.heroSynergyBonus ?? 0);
  const turretAmp = 1 + (masteryAmplifiers?.turretSynergyBonus ?? 0);
  const fullAmp = 1 + (masteryAmplifiers?.fullSynergyBonus ?? 0);

  // Hero-Fortress synergy: +30% DMG, +15% AS per matching hero (amplified by mastery)
  if (heroMatches > 0) {
    addBonus('damageBonus', 0.30 * heroMatches * heroAmp);
    addBonus('attackSpeedBonus', 0.15 * heroMatches * heroAmp);
  }

  // Turret-Fortress synergy: +25% AS, +15% DMG per matching turret (amplified by mastery)
  if (turretMatches > 0) {
    addBonus('attackSpeedBonus', 0.25 * turretMatches * turretAmp);
    addBonus('damageBonus', 0.15 * turretMatches * turretAmp);
  }

  // Full synergy bonus (minimum set size) - amplified by mastery
  const hasFullSynergy = heroMatches >= 2 && turretMatches >= 3;
  if (hasFullSynergy) {
    // +50% DMG, +15% crit, +20% CDR (all amplified)
    addBonus('damageBonus', 0.50 * fullAmp);
    addBonus('critChance', 0.15 * fullAmp);
    addBonus('cooldownReduction', 0.20 * fullAmp);
  }

  const synergyRelics = state.relics
    .map((relic) => getRelicById(relic.id))
    .filter((relic): relic is ExtendedRelicDef => !!relic && relic.category === 'synergy');

  const getSynergyRelic = (id: string): ExtendedRelicDef | undefined =>
    synergyRelics.find((relic) => relic.id === id);

  const matchingUnits = heroMatches + turretMatches;

  const elementalBond = getSynergyRelic('elemental-bond');
  if (elementalBond && matchingUnits >= 2) {
    const damageBonus = elementalBond.modifiers.damageBonus;
    if (damageBonus) {
      addBonus('damageBonus', damageBonus);
    }
  }

  const teamSpirit = getSynergyRelic('team-spirit');
  if (teamSpirit && heroMatches > 0) {
    const stacks = heroMatches;
    // Apply stacked bonuses
    if (teamSpirit.modifiers.damageBonus) {
      addBonus('damageBonus', teamSpirit.modifiers.damageBonus * stacks);
    }
    if (teamSpirit.modifiers.attackSpeedBonus) {
      addBonus('attackSpeedBonus', teamSpirit.modifiers.attackSpeedBonus * stacks);
    }
    if (teamSpirit.modifiers.maxHpBonus) {
      addBonus('maxHpBonus', teamSpirit.modifiers.maxHpBonus * stacks);
    }
  }

  const harmonicResonance = getSynergyRelic('harmonic-resonance');
  if (harmonicResonance && hasFullSynergy) {
    if (harmonicResonance.modifiers.damageBonus) {
      addBonus('damageBonus', harmonicResonance.modifiers.damageBonus);
    }
    if (harmonicResonance.modifiers.cooldownReduction) {
      addBonus('cooldownReduction', harmonicResonance.modifiers.cooldownReduction);
    }
  }

  const hasUnityCrystal = !!getSynergyRelic('unity-crystal');
  if (hasUnityCrystal) {
    // Unity crystal amplifies all synergy bonuses by 50%
    const effectiveness = 1.5;

    if (bonuses.damageBonus !== undefined) {
      bonuses.damageBonus *= effectiveness;
    }
    if (bonuses.attackSpeedBonus !== undefined) {
      bonuses.attackSpeedBonus *= effectiveness;
    }
    if (bonuses.cooldownReduction !== undefined) {
      bonuses.cooldownReduction *= effectiveness;
    }
    if (bonuses.maxHpBonus !== undefined) {
      bonuses.maxHpBonus *= effectiveness;
    }
    if (bonuses.critChance !== undefined) {
      bonuses.critChance *= effectiveness;
    }
  }

  return bonuses;
}

/**
 * Calculate pillar class modifiers
 * Returns additive damage bonus based on pillar-class interaction
 */
export function calculatePillarModifiers(state: GameState): Partial<ModifierSet> {
  const pillar = getPillarForWave(state.wave);
  if (!pillar) return {};

  const damageMultiplier = calculatePillarDamageMultiplier(pillar.id, state.fortressClass);

  // Convert from fixed-point (16384 = 1.0) to additive bonus
  // If multiplier is 1.5x (24576), bonus should be 0.5
  return {
    damageBonus: (damageMultiplier / 16384) - 1,
  };
}
