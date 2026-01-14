/**
 * Ice Class Mastery Tree
 *
 * Focus: Critical damage, crowd control (slow/freeze), defensive bonuses
 * Theme: Cryo energy, frozen attacks, glass cannon
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const ICE_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'ice',
  name: 'Mistrzostwo Kriogeniczne',
  description: 'Opanuj lodową moc zamrażania i krytycznych obrażeń',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'ice_t1_crit_damage',
      name: 'Lodowe Ostrze',
      description: '+15% obrażeń krytycznych',
      class: 'ice',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { critDamageBonus: 0.15 },
      },
      icon: 'icicle',
    },
    {
      id: 'ice_t1_damage',
      name: 'Mroźna Siła',
      description: '+10% obrażeń',
      class: 'ice',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { damageBonus: 0.1 },
      },
      icon: 'frost',
    },
    {
      id: 'ice_t1_cdr',
      name: 'Zimna Kalkulacja',
      description: '+8% redukcji cooldownu',
      class: 'ice',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { cooldownReduction: 0.08 },
      },
      icon: 'snowflake',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'ice_t2_synergy_hero',
      name: 'Powinowactwo Lodu',
      description: 'Bohaterowie Lodu +15% bonus z synergii',
      class: 'ice',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['ice_t1_crit_damage'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_ice',
    },
    {
      id: 'ice_t2_crit_boost',
      name: 'Lodowy Impet',
      description: '+6% szansy na krytyka, +20% obrażeń krytycznych',
      class: 'ice',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['ice_t1_crit_damage', 'ice_t1_damage'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { critChance: 0.06, critDamageBonus: 0.2 },
      },
      icon: 'shatter',
    },
    {
      id: 'ice_t2_control',
      name: 'Mroźny Dotyk',
      description: '+12% obrażeń, +5% odporności na CC',
      class: 'ice',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['ice_t1_damage', 'ice_t1_cdr'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { damageBonus: 0.12, ccResistance: 0.05 },
      },
      icon: 'freeze',
    },
    {
      id: 'ice_t2_synergy_turret',
      name: 'Wieżyczki Kriogeniczne',
      description: 'Wieżyczki Lodu +15% bonus z synergii',
      class: 'ice',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['ice_t1_cdr'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_ice',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'ice_t3_hero_mastery',
      name: 'Mistrz Mrozu',
      description: 'Bohaterowie Lodu: +30% obrażeń krytycznych, +8% krytyka',
      class: 'ice',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['ice_t2_synergy_hero', 'ice_t2_crit_boost'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'frost_master',
          description: 'Bohaterowie Lodu zadają devastujące krytyczne obrażenia',
        },
        modifiers: { critDamageBonus: 0.3, critChance: 0.08 },
      },
      icon: 'master',
    },
    {
      id: 'ice_t3_glass_cannon',
      name: 'Szklana Armata',
      description: '+35% obrażeń, +15% obrażeń krytycznych',
      class: 'ice',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['ice_t2_crit_boost'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { damageBonus: 0.35, critDamageBonus: 0.15 },
      },
      icon: 'cannon',
    },
    {
      id: 'ice_t3_turret_mastery',
      name: 'Zamrażarki',
      description: 'Wieżyczki Lodu: +25% obrażeń, +15% redukcji cooldownu',
      class: 'ice',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['ice_t2_control', 'ice_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'freezers',
          description: 'Wieżyczki Lodu zamrażają i niszczą wrogów',
        },
        modifiers: { damageBonus: 0.25, cooldownReduction: 0.15 },
      },
      icon: 'freezer',
    },
    {
      id: 'ice_t3_full_synergy',
      name: 'Lodowa Harmonia',
      description: 'Bonus pełnej synergii +25% przy Lodzie',
      class: 'ice',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['ice_t2_synergy_hero', 'ice_t2_synergy_turret'],
      position: { x: 2, y: 2.5 },
      effects: {
        synergyAmplifier: { fullSynergyBonus: 0.25 },
      },
      icon: 'harmony',
    },

    // ========================================================================
    // TIER 4: Advanced (4 nodes, 6 MP each)
    // ========================================================================
    {
      id: 'ice_t4_shatter',
      name: 'Roztrzaskanie',
      description: 'Krytyki zadają +50% obrażeń zamrożonym wrogom',
      class: 'ice',
      tier: 4,
      type: 'class_perk',
      cost: 6,
      requires: ['ice_t3_glass_cannon'],
      position: { x: 1.5, y: 3 },
      effects: {
        classPerk: {
          id: 'shatter',
          description: 'Zamrożeni wrogowie otrzymują dodatkowe obrażenia od krytyków',
        },
        modifiers: { critDamageBonus: 0.5 },
      },
      icon: 'shatter',
    },
    {
      id: 'ice_t4_avalanche',
      name: 'Lawina',
      description: '+40% obrażeń, +10% szansy na krytyka',
      class: 'ice',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['ice_t3_hero_mastery', 'ice_t3_glass_cannon'],
      position: { x: 2, y: 3 },
      effects: {
        modifiers: { damageBonus: 0.4, critChance: 0.1 },
      },
      icon: 'avalanche',
    },
    {
      id: 'ice_t4_permafrost',
      name: 'Wieczna Zmarzlina',
      description: '+20% redukcji cooldownu, +10% odporności na obrażenia',
      class: 'ice',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['ice_t3_turret_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        modifiers: { cooldownReduction: 0.2, incomingDamageReduction: 0.1 },
      },
      icon: 'permafrost',
    },
    {
      id: 'ice_t4_synergy_mastery',
      name: 'Kriogeniczna Jedność',
      description: 'Wszystkie bonusy synergii +20% przy Lodzie',
      class: 'ice',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['ice_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'cryo_unity',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each)
    // ========================================================================
    {
      id: 'ice_t5_absolute_zero',
      name: 'Zero Absolutne',
      description: 'CAPSTONE: +75% obrażeń krytycznych. Krytyki mają 30% szansy na zamrożenie wroga.',
      class: 'ice',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['ice_t4_avalanche'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'absolute_zero',
          description: 'Devastujące krytyczne obrażenia z zamrażaniem',
        },
        modifiers: { critDamageBonus: 0.75 },
      },
      icon: 'zero',
    },
    {
      id: 'ice_t5_ice_age',
      name: 'Epoka Lodowcowa',
      description: 'CAPSTONE: +50% obrażeń. Zamrożeni wrogowie eksplodują przy śmierci zadając obrażenia wokół.',
      class: 'ice',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['ice_t4_shatter', 'ice_t4_permafrost'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'ice_age',
          description: 'Zamrożeni wrogowie eksplodują przy śmierci',
        },
        modifiers: { damageBonus: 0.5 },
      },
      icon: 'ice_age',
    },
    {
      id: 'ice_t5_frozen_unity',
      name: 'Lodowa Jedność',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'ice',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['ice_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'frozen_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
