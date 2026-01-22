/**
 * Synergy System
 *
 * Calculates synergy bonuses based on hero/turret class matching
 * and pillar damage modifiers.
 *
 * Uses additive bonus system: base × (1 + sum of bonuses)
 */

import type { GameState, ModifierSet, ActiveHero } from '../types.js';
import { FP } from '../fixed.js';
import { getHeroById } from '../data/heroes.js';
import { calculatePillarDamageMultiplier } from '../data/pillars.js';
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
  const damageMultiplier = calculatePillarDamageMultiplier(state.currentPillar, state.fortressClass);

  // Convert from fixed-point (16384 = 1.0) to additive bonus
  // If multiplier is 1.5x (24576), bonus should be 0.5
  return {
    damageBonus: (damageMultiplier / 16384) - 1,
  };
}

// ============================================================================
// TURRET ADJACENCY SYNERGY SYSTEM
// ============================================================================

/**
 * Slot adjacency map - defines which slots are adjacent to each other
 * Based on layout:
 * [SLOT 0] [SLOT 1] [SLOT 2]
 *     |________|________|
 *          FORTRESS
 *     |________|________|
 * [SLOT 3] [SLOT 4] [SLOT 5]
 */
const TURRET_ADJACENCY: Record<number, number[]> = {
  0: [1, 3],      // Top-left: adjacent to top-center and bottom-left
  1: [0, 2, 4],   // Top-center: adjacent to top-left, top-right, bottom-center
  2: [1, 5],      // Top-right: adjacent to top-center and bottom-right
  3: [0, 4],      // Bottom-left: adjacent to top-left and bottom-center
  4: [1, 3, 5],   // Bottom-center: adjacent to top-center, bottom-left, bottom-right
  5: [2, 4],      // Bottom-right: adjacent to top-right and bottom-center
};

/**
 * Synergy bonuses for adjacent same-type turrets
 */
const TURRET_ADJACENCY_BONUS = {
  damageBonus: 0.15,       // +15% damage per adjacent same-type
  attackSpeedBonus: 0.10,  // +10% attack speed per adjacent same-type
};

export interface TurretSynergyBonus {
  slotIndex: number;
  adjacentSameType: number;
  damageBonus: number;
  attackSpeedBonus: number;
}

/**
 * Calculate turret adjacency synergy bonuses
 * Returns bonuses per turret based on adjacent same-type turrets
 */
export function calculateTurretAdjacencyBonuses(
  state: GameState
): TurretSynergyBonus[] {
  const bonuses: TurretSynergyBonus[] = [];

  // Create map of slot -> turret type
  const slotToType = new Map<number, string>();
  for (const turret of state.turrets) {
    slotToType.set(turret.slotIndex, turret.definitionId);
  }

  // Calculate bonuses for each turret
  for (const turret of state.turrets) {
    const adjacentSlots = TURRET_ADJACENCY[turret.slotIndex] || [];
    let adjacentSameType = 0;

    for (const adjSlot of adjacentSlots) {
      const adjType = slotToType.get(adjSlot);
      if (adjType === turret.definitionId) {
        adjacentSameType++;
      }
    }

    bonuses.push({
      slotIndex: turret.slotIndex,
      adjacentSameType,
      damageBonus: adjacentSameType * TURRET_ADJACENCY_BONUS.damageBonus,
      attackSpeedBonus: adjacentSameType * TURRET_ADJACENCY_BONUS.attackSpeedBonus,
    });
  }

  return bonuses;
}

/**
 * Get synergy bonus for a specific turret slot
 */
export function getTurretSynergyBonus(
  state: GameState,
  slotIndex: number
): TurretSynergyBonus | undefined {
  const bonuses = calculateTurretAdjacencyBonuses(state);
  return bonuses.find(b => b.slotIndex === slotIndex);
}

// ============================================================================
// HERO ADJACENCY SYNERGY SYSTEM
// ============================================================================

export const STORM_FORGE_SYNERGY_RANGE = FP.fromFloat(4.5);
export const STORM_FORGE_SYNERGY_RANGE_SQ = FP.mul(
  STORM_FORGE_SYNERGY_RANGE,
  STORM_FORGE_SYNERGY_RANGE
);
export const STORM_FORGE_ATTACK_SPEED_BONUS = 0.25; // +25% attack speed

function getStormForgeHeroes(state: GameState): { storm: ActiveHero; forge: ActiveHero } | null {
  let storm: ActiveHero | undefined;
  let forge: ActiveHero | undefined;

  for (const hero of state.heroes) {
    if (hero.definitionId === 'storm') storm = hero;
    if (hero.definitionId === 'forge') forge = hero;
    if (storm && forge) break;
  }

  if (!storm || !forge) return null;
  return { storm, forge };
}

export function getStormForgeSynergyPair(
  state: GameState
): { storm: ActiveHero; forge: ActiveHero } | null {
  const heroes = getStormForgeHeroes(state);
  if (!heroes) return null;

  const distSq = FP.distSq(
    heroes.storm.x,
    heroes.storm.y,
    heroes.forge.x,
    heroes.forge.y
  );

  if (distSq > STORM_FORGE_SYNERGY_RANGE_SQ) return null;
  return heroes;
}

export function getStormForgeAttackSpeedBonus(state: GameState, hero: ActiveHero): number {
  if (hero.definitionId !== 'storm' && hero.definitionId !== 'forge') {
    return 0;
  }

  return getStormForgeSynergyPair(state) ? STORM_FORGE_ATTACK_SPEED_BONUS : 0;
}

// ============================================================================
// HERO PAIR SYNERGIES (New synergies added in hero development update)
// ============================================================================

// MEDIC + VANGUARD: "Frontline Support"
// Medic heals Vanguard 50% faster, Vanguard gets +20% damage reduction
export const MEDIC_VANGUARD_SYNERGY_RANGE = FP.fromFloat(5.0);
export const MEDIC_VANGUARD_HEAL_BONUS = 0.50; // +50% heal speed to Vanguard
export const VANGUARD_DAMAGE_REDUCTION_BONUS = 0.20; // +20% DR when near Medic

function getMedicVanguardHeroes(state: GameState): { medic: ActiveHero; vanguard: ActiveHero } | null {
  let medic: ActiveHero | undefined;
  let vanguard: ActiveHero | undefined;

  for (const hero of state.heroes) {
    if (hero.definitionId === 'medic') medic = hero;
    if (hero.definitionId === 'vanguard') vanguard = hero;
    if (medic && vanguard) break;
  }

  if (!medic || !vanguard) return null;
  return { medic, vanguard };
}

export function getMedicVanguardSynergyPair(state: GameState): { medic: ActiveHero; vanguard: ActiveHero } | null {
  const heroes = getMedicVanguardHeroes(state);
  if (!heroes) return null;

  const distSq = FP.distSq(heroes.medic.x, heroes.medic.y, heroes.vanguard.x, heroes.vanguard.y);
  const rangeSq = FP.mul(MEDIC_VANGUARD_SYNERGY_RANGE, MEDIC_VANGUARD_SYNERGY_RANGE);

  if (distSq > rangeSq) return null;
  return heroes;
}

export function getVanguardDamageReductionBonus(state: GameState, hero: ActiveHero): number {
  if (hero.definitionId !== 'vanguard') return 0;
  return getMedicVanguardSynergyPair(state) ? VANGUARD_DAMAGE_REDUCTION_BONUS : 0;
}

export function getMedicHealBonusToVanguard(state: GameState, targetHero: ActiveHero): number {
  if (targetHero.definitionId !== 'vanguard') return 0;
  return getMedicVanguardSynergyPair(state) ? MEDIC_VANGUARD_HEAL_BONUS : 0;
}

// PYRO + FROST: "Thermal Shock"
// Enemies that are both burned AND frozen/slowed take +100% damage
export const THERMAL_SHOCK_DAMAGE_BONUS = 1.0; // +100% damage to burned+frozen enemies

export function hasPyroFrostSynergy(state: GameState): boolean {
  let hasPyro = false;
  let hasFrost = false;

  for (const hero of state.heroes) {
    if (hero.definitionId === 'pyro') hasPyro = true;
    if (hero.definitionId === 'frost') hasFrost = true;
    if (hasPyro && hasFrost) return true;
  }

  return false;
}

// STORM + FROST: "Superconductor"
// Storm's chain lightning gains +2 extra targets when Frost is present
export const SUPERCONDUCTOR_CHAIN_BONUS = 2; // +2 chain targets

export function hasStormFrostSynergy(state: GameState): boolean {
  let hasStorm = false;
  let hasFrost = false;

  for (const hero of state.heroes) {
    if (hero.definitionId === 'storm') hasStorm = true;
    if (hero.definitionId === 'frost') hasFrost = true;
    if (hasStorm && hasFrost) return true;
  }

  return false;
}

export function getStormChainBonus(state: GameState): number {
  return hasStormFrostSynergy(state) ? SUPERCONDUCTOR_CHAIN_BONUS : 0;
}

// OMEGA + TITAN: "Void Resonance"
// Both get +25% damage, Omega execute threshold +5%
export const VOID_RESONANCE_DAMAGE_BONUS = 0.25; // +25% damage
export const OMEGA_EXECUTE_THRESHOLD_BONUS = 0.05; // +5% execute threshold

export function hasOmegaTitanSynergy(state: GameState): boolean {
  let hasOmega = false;
  let hasTitan = false;

  for (const hero of state.heroes) {
    if (hero.definitionId === 'omega') hasOmega = true;
    if (hero.definitionId === 'titan') hasTitan = true;
    if (hasOmega && hasTitan) return true;
  }

  return false;
}

export function getVoidResonanceDamageBonus(state: GameState, hero: ActiveHero): number {
  if (hero.definitionId !== 'omega' && hero.definitionId !== 'titan') return 0;
  return hasOmegaTitanSynergy(state) ? VOID_RESONANCE_DAMAGE_BONUS : 0;
}

export function getOmegaExecuteThresholdBonus(state: GameState): number {
  return hasOmegaTitanSynergy(state) ? OMEGA_EXECUTE_THRESHOLD_BONUS : 0;
}

// ============================================================================
// HERO TRIO SYNERGIES
// ============================================================================

// MEDIC + PYRO + VANGUARD: "Balanced Squad"
// All three get +20% damage, +20% heal effectiveness, +15% damage reduction
export const BALANCED_SQUAD_DAMAGE_BONUS = 0.20;
export const BALANCED_SQUAD_HEAL_BONUS = 0.20;
export const BALANCED_SQUAD_DR_BONUS = 0.15;

export function hasBalancedSquadSynergy(state: GameState): boolean {
  let hasMedic = false;
  let hasPyro = false;
  let hasVanguard = false;

  for (const hero of state.heroes) {
    if (hero.definitionId === 'medic') hasMedic = true;
    if (hero.definitionId === 'pyro') hasPyro = true;
    if (hero.definitionId === 'vanguard') hasVanguard = true;
    if (hasMedic && hasPyro && hasVanguard) return true;
  }

  return false;
}

export function getBalancedSquadBonus(state: GameState, hero: ActiveHero): { damage: number; heal: number; dr: number } {
  if (!hasBalancedSquadSynergy(state)) {
    return { damage: 0, heal: 0, dr: 0 };
  }

  // Only applies to squad members
  if (hero.definitionId === 'medic' || hero.definitionId === 'pyro' || hero.definitionId === 'vanguard') {
    return {
      damage: BALANCED_SQUAD_DAMAGE_BONUS,
      heal: BALANCED_SQUAD_HEAL_BONUS,
      dr: BALANCED_SQUAD_DR_BONUS
    };
  }

  return { damage: 0, heal: 0, dr: 0 };
}
