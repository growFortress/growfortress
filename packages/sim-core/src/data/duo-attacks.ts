/**
 * Duo-Attack Definitions
 *
 * Special synchronized attacks triggered when two specific heroes
 * are within activation range of each other.
 *
 * Based on combo system patterns from combos.ts
 */

import { FP } from '../fixed.js';
import type { DuoAttackDefinition } from '../types.js';

// ============================================================================
// DUO-ATTACK DEFINITIONS
// ============================================================================

/**
 * Thunder Guard - Storm + Vanguard
 * Lightning meets tactical defense for devastating area control
 */
const THUNDER_GUARD: DuoAttackDefinition = {
  id: 'thunder_guard',
  name: 'Thunder Guard',
  description: 'Storm i Vanguard łączą błyskawice z tarczą taktyczną dla niszczycielskiej kontroli obszaru.',
  heroes: ['storm', 'vanguard'],
  activationRange: FP.fromInt(5),
  cooldownTicks: 900, // 30 seconds at 30Hz
  effects: [
    {
      type: 'damage',
      damage: 150,
      radius: FP.fromInt(6),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'stun', duration: 60 }, // 2s stun
    },
    {
      type: 'buff',
      buffStat: 'incomingDamageReduction',
      buffAmount: 0.3,
      duration: 180, // 6s
    },
  ],
  visualEffect: 'thunder_shield_burst',
  audioEffect: 'duo_thunder_guard',
};

/**
 * Void Storm - Titan + Storm
 * Dimensional rifts charged with lightning
 */
const VOID_STORM: DuoAttackDefinition = {
  id: 'void_storm',
  name: 'Void Storm',
  description: 'Titan i Storm otwierają wymiarowe szczeliny naładowane błyskawicami.',
  heroes: ['titan', 'storm'],
  activationRange: FP.fromInt(4),
  cooldownTicks: 1200, // 40 seconds
  effects: [
    {
      type: 'damage',
      damage: 250,
      radius: FP.fromInt(8),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'slow', percent: 50, duration: 150 }, // 5s slow
    },
  ],
  visualEffect: 'void_lightning_rift',
  audioEffect: 'duo_void_storm',
};

/**
 * Frozen Inferno - Frost + Inferno
 * Thermal shock that shatters enemies
 */
const FROZEN_INFERNO: DuoAttackDefinition = {
  id: 'frozen_inferno',
  name: 'Frozen Inferno',
  description: 'Frost i Inferno tworzą szok termiczny, który roztrzaskuje wrogów.',
  heroes: ['frost', 'inferno'],
  activationRange: FP.fromInt(5),
  cooldownTicks: 720, // 24 seconds
  effects: [
    {
      type: 'damage',
      damage: 200,
      radius: FP.fromInt(5),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'freeze', duration: 90 }, // 3s freeze
    },
  ],
  visualEffect: 'thermal_shock_wave',
  audioEffect: 'duo_frozen_inferno',
};

/**
 * Phase Strike - Spectre + Omega
 * Coordinated assassination from multiple dimensions
 */
const PHASE_STRIKE: DuoAttackDefinition = {
  id: 'phase_strike',
  name: 'Phase Strike',
  description: 'Spectre i Omega wykonują skoordynowane zabójstwo z wielu wymiarów.',
  heroes: ['spectre', 'omega'],
  activationRange: FP.fromInt(3),
  cooldownTicks: 600, // 20 seconds
  effects: [
    {
      type: 'damage',
      damage: 400, // High single-target focus
      radius: FP.fromInt(2), // Small radius = focused
    },
    {
      type: 'buff',
      buffStat: 'critChance',
      buffAmount: 0.5,
      duration: 120, // 4s
    },
  ],
  visualEffect: 'phase_assassination',
  audioEffect: 'duo_phase_strike',
};

/**
 * Cryo Artillery - Forge + Glacier
 * Orbital cryo-missiles guided by targeting system
 */
const CRYO_ARTILLERY: DuoAttackDefinition = {
  id: 'cryo_artillery',
  name: 'Cryo Artillery',
  description: 'Forge wystrzeliwuje orbitalne kryo-pociski naprowadzane przez Glacier.',
  heroes: ['forge', 'glacier'],
  activationRange: FP.fromInt(6),
  cooldownTicks: 1080, // 36 seconds
  effects: [
    {
      type: 'damage',
      damage: 180,
      radius: FP.fromInt(10), // Large area
    },
    {
      type: 'debuff',
      statusEffect: { type: 'slow', percent: 60, duration: 180 }, // 6s heavy slow
    },
  ],
  visualEffect: 'cryo_orbital_strike',
  audioEffect: 'duo_cryo_artillery',
};

/**
 * Reality Tear - Rift + Titan
 * Chaos and void energy tear reality apart
 */
const REALITY_TEAR: DuoAttackDefinition = {
  id: 'reality_tear',
  name: 'Reality Tear',
  description: 'Rift i Titan łączą energię chaosu i próżni, rozdzierając samą rzeczywistość.',
  heroes: ['rift', 'titan'],
  activationRange: FP.fromInt(4),
  cooldownTicks: 1500, // 50 seconds
  effects: [
    {
      type: 'damage',
      damage: 300,
      radius: FP.fromInt(7),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'burn', damagePerTick: 10, duration: 150 }, // 5s burn
    },
  ],
  visualEffect: 'reality_rift_zone',
  audioEffect: 'duo_reality_tear',
};

/**
 * Inferno Storm - Storm + Inferno
 * Lightning ignites flames creating an electrical firestorm
 */
const INFERNO_STORM: DuoAttackDefinition = {
  id: 'inferno_storm',
  name: 'Inferno Storm',
  description: 'Storm i Inferno tworzą elektryczną burzę ogniową - błyskawice podpalają wszystko wokół.',
  heroes: ['storm', 'inferno'],
  activationRange: FP.fromInt(5),
  cooldownTicks: 840, // 28 seconds
  effects: [
    {
      type: 'damage',
      damage: 180,
      radius: FP.fromInt(7),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'burn', damagePerTick: 15, duration: 120 }, // 4s burn
    },
    {
      type: 'debuff',
      statusEffect: { type: 'stun', duration: 30 }, // 1s stun from shock
    },
  ],
  visualEffect: 'fire_lightning_storm',
  audioEffect: 'duo_inferno_storm',
};

/**
 * Glacier Shield - Vanguard + Glacier
 * Impenetrable ice fortress barrier
 */
const GLACIER_SHIELD: DuoAttackDefinition = {
  id: 'glacier_shield',
  name: 'Glacier Shield',
  description: 'Vanguard i Glacier tworzą nieprzeniknioną lodową fortecę chroniącą sojuszników.',
  heroes: ['vanguard', 'glacier'],
  activationRange: FP.fromInt(4),
  cooldownTicks: 1080, // 36 seconds
  effects: [
    {
      type: 'buff',
      buffStat: 'incomingDamageReduction',
      buffAmount: 0.5,
      duration: 240, // 8s
    },
    {
      type: 'buff',
      buffStat: 'maxHpBonus',
      buffAmount: 0.3, // +30% max HP
      duration: 240,
    },
    {
      type: 'damage',
      damage: 80,
      radius: FP.fromInt(4), // Damages enemies that get close
    },
  ],
  visualEffect: 'ice_fortress_barrier',
  audioEffect: 'duo_glacier_shield',
};

/**
 * Phantom Frost - Spectre + Frost
 * Ghostly ice shards that phase through armor
 */
const PHANTOM_FROST: DuoAttackDefinition = {
  id: 'phantom_frost',
  name: 'Phantom Frost',
  description: 'Spectre i Frost wystrzeliwują widmowe lodowe odłamki przechodzące przez pancerz.',
  heroes: ['spectre', 'frost'],
  activationRange: FP.fromInt(4),
  cooldownTicks: 660, // 22 seconds
  effects: [
    {
      type: 'damage',
      damage: 220,
      radius: FP.fromInt(5),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'freeze', duration: 60 }, // 2s freeze
    },
    {
      type: 'buff',
      buffStat: 'damageBonus',
      buffAmount: 0.4, // +40% damage (armor piercing effect)
      duration: 150, // 5s
    },
  ],
  visualEffect: 'ghost_ice_shards',
  audioEffect: 'duo_phantom_frost',
};

/**
 * Tech Void - Forge + Titan
 * Heavy orbital bombardment from dimensional cannons
 */
const TECH_VOID: DuoAttackDefinition = {
  id: 'tech_void',
  name: 'Tech Void',
  description: 'Forge i Titan łączą technologię z mocą wymiarową dla niszczycielskiego ostrzału orbitalnego.',
  heroes: ['forge', 'titan'],
  activationRange: FP.fromInt(5),
  cooldownTicks: 1320, // 44 seconds
  effects: [
    {
      type: 'damage',
      damage: 350,
      radius: FP.fromInt(6),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'slow', percent: 40, duration: 120 }, // 4s slow
    },
  ],
  visualEffect: 'orbital_void_strike',
  audioEffect: 'duo_tech_void',
};

/**
 * Nature Fire - Glacier + Inferno
 * Extreme thermal differential creates devastating shockwave
 */
const NATURE_FIRE: DuoAttackDefinition = {
  id: 'nature_fire',
  name: 'Thermal Paradox',
  description: 'Glacier i Inferno tworzą ekstremalną różnicę temperatur - eksplozja termiczna niszczy wszystko.',
  heroes: ['glacier', 'inferno'],
  activationRange: FP.fromInt(5),
  cooldownTicks: 900, // 30 seconds
  effects: [
    {
      type: 'damage',
      damage: 280,
      radius: FP.fromInt(8),
    },
    {
      type: 'debuff',
      statusEffect: { type: 'slow', percent: 70, duration: 90 }, // 3s heavy slow
    },
    {
      type: 'debuff',
      statusEffect: { type: 'burn', damagePerTick: 8, duration: 120 }, // 4s burn
    },
  ],
  visualEffect: 'thermal_paradox_explosion',
  audioEffect: 'duo_nature_fire',
};

/**
 * Plasma Phase - Forge + Spectre
 * Cloaked drones deliver precision plasma strikes
 */
const PLASMA_PHASE: DuoAttackDefinition = {
  id: 'plasma_phase',
  name: 'Plasma Phase',
  description: 'Forge i Spectre wysyłają zamaskowane drony dostarczające precyzyjne uderzenia plazmowe.',
  heroes: ['forge', 'spectre'],
  activationRange: FP.fromInt(5),
  cooldownTicks: 780, // 26 seconds
  effects: [
    {
      type: 'damage',
      damage: 260,
      radius: FP.fromInt(4),
    },
    {
      type: 'buff',
      buffStat: 'attackSpeedBonus',
      buffAmount: 0.35, // +35% attack speed
      duration: 180, // 6s
    },
  ],
  visualEffect: 'cloaked_plasma_drones',
  audioEffect: 'duo_plasma_phase',
};

// ============================================================================
// EXPORTS
// ============================================================================

export const DUO_ATTACK_DEFINITIONS: DuoAttackDefinition[] = [
  THUNDER_GUARD,
  VOID_STORM,
  FROZEN_INFERNO,
  PHASE_STRIKE,
  CRYO_ARTILLERY,
  REALITY_TEAR,
  // New duo-attacks
  INFERNO_STORM,
  GLACIER_SHIELD,
  PHANTOM_FROST,
  TECH_VOID,
  NATURE_FIRE,
  PLASMA_PHASE,
];

/**
 * Get duo-attack definition by ID
 */
export function getDuoAttackById(id: string): DuoAttackDefinition | undefined {
  return DUO_ATTACK_DEFINITIONS.find((d) => d.id === id);
}

/**
 * Get all duo-attacks that include a specific hero
 */
export function getDuoAttacksForHero(heroId: string): DuoAttackDefinition[] {
  return DUO_ATTACK_DEFINITIONS.filter(
    (d) => d.heroes[0] === heroId || d.heroes[1] === heroId
  );
}

/**
 * Get duo-attack for a specific hero pair (order doesn't matter)
 */
export function getDuoAttackForPair(
  hero1Id: string,
  hero2Id: string
): DuoAttackDefinition | undefined {
  return DUO_ATTACK_DEFINITIONS.find(
    (d) =>
      (d.heroes[0] === hero1Id && d.heroes[1] === hero2Id) ||
      (d.heroes[0] === hero2Id && d.heroes[1] === hero1Id)
  );
}

/**
 * Check if two heroes can perform a duo-attack together
 */
export function canPerformDuoAttack(hero1Id: string, hero2Id: string): boolean {
  return getDuoAttackForPair(hero1Id, hero2Id) !== undefined;
}

/**
 * Get all duo-attacks available for the current hero composition
 */
export function getAvailableDuoAttacks(
  heroIds: string[]
): DuoAttackDefinition[] {
  return DUO_ATTACK_DEFINITIONS.filter((duoAttack) => {
    return (
      heroIds.includes(duoAttack.heroes[0]) &&
      heroIds.includes(duoAttack.heroes[1])
    );
  });
}
