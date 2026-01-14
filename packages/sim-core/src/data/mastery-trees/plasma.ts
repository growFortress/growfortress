/**
 * Plasma Class Mastery Tree
 *
 * Focus: Hybrid damage, energy beams, versatility
 * Theme: Plasma energy, beams, adaptive power
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const PLASMA_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'plasma',
  name: 'Mistrzostwo Plazmowe',
  description: 'Opanuj wszechstronną moc plazmy i wiązek energii',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'plasma_t1_damage',
      name: 'Energia Plazmowa',
      description: '+10% obrażeń',
      class: 'plasma',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { damageBonus: 0.1 },
      },
      icon: 'plasma',
    },
    {
      id: 'plasma_t1_speed',
      name: 'Akcelerator',
      description: '+8% szybkości ataku',
      class: 'plasma',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { attackSpeedBonus: 0.08 },
      },
      icon: 'accelerator',
    },
    {
      id: 'plasma_t1_crit',
      name: 'Skupienie Wiązki',
      description: '+6% szansy na krytyka',
      class: 'plasma',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { critChance: 0.06 },
      },
      icon: 'beam',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'plasma_t2_synergy_hero',
      name: 'Powinowactwo Plazmy',
      description: 'Bohaterowie Plazmy +15% bonus z synergii',
      class: 'plasma',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['plasma_t1_damage'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_plasma',
    },
    {
      id: 'plasma_t2_power',
      name: 'Moc Wiązki',
      description: '+12% obrażeń, +8% szybkości ataku',
      class: 'plasma',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['plasma_t1_damage', 'plasma_t1_speed'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { damageBonus: 0.12, attackSpeedBonus: 0.08 },
      },
      icon: 'power',
    },
    {
      id: 'plasma_t2_precision',
      name: 'Precyzja Plazmowa',
      description: '+8% krytyka, +15% obrażeń krytycznych',
      class: 'plasma',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['plasma_t1_speed', 'plasma_t1_crit'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { critChance: 0.08, critDamageBonus: 0.15 },
      },
      icon: 'precision',
    },
    {
      id: 'plasma_t2_synergy_turret',
      name: 'Wieżyczki Plazmowe',
      description: 'Wieżyczki Plazmy +15% bonus z synergii',
      class: 'plasma',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['plasma_t1_crit'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_plasma',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'plasma_t3_hero_mastery',
      name: 'Mistrz Plazmy',
      description: 'Bohaterowie Plazmy: +20% obrażeń, +15% szybkości ataku',
      class: 'plasma',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['plasma_t2_synergy_hero', 'plasma_t2_power'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'plasma_master',
          description: 'Bohaterowie Plazmy władają potężnymi wiązkami',
        },
        modifiers: { damageBonus: 0.2, attackSpeedBonus: 0.15 },
      },
      icon: 'plasma_master',
    },
    {
      id: 'plasma_t3_overload',
      name: 'Przeciążenie',
      description: '+18% obrażeń, +10% krytyka, +10% szybkości ataku',
      class: 'plasma',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['plasma_t2_power', 'plasma_t2_precision'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { damageBonus: 0.18, critChance: 0.1, attackSpeedBonus: 0.1 },
      },
      icon: 'overload',
    },
    {
      id: 'plasma_t3_turret_mastery',
      name: 'Działa Plazmowe',
      description: 'Wieżyczki Plazmy: +22% obrażeń, +12% szybkości ataku',
      class: 'plasma',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['plasma_t2_precision', 'plasma_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'plasma_cannons',
          description: 'Wieżyczki Plazmy strzelają szybkimi wiązkami',
        },
        modifiers: { damageBonus: 0.22, attackSpeedBonus: 0.12 },
      },
      icon: 'cannon',
    },
    {
      id: 'plasma_t3_full_synergy',
      name: 'Plazmowa Harmonia',
      description: 'Bonus pełnej synergii +25% przy Plazmie',
      class: 'plasma',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['plasma_t2_synergy_hero', 'plasma_t2_synergy_turret'],
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
      id: 'plasma_t4_beam_cannon',
      name: 'Działo Wiązkowe',
      description: '+1 przebicie, +25% obrażeń, wiązki nie tracą mocy',
      class: 'plasma',
      tier: 4,
      type: 'class_perk',
      cost: 6,
      requires: ['plasma_t3_overload'],
      position: { x: 1.5, y: 3 },
      effects: {
        classPerk: {
          id: 'beam_cannon',
          description: 'Wiązki plazmy przebijają wrogów z pełną mocą',
        },
        modifiers: { pierceCount: 1, damageBonus: 0.25 },
      },
      icon: 'beam_cannon',
    },
    {
      id: 'plasma_t4_supercharge',
      name: 'Superdoładowanie',
      description: '+30% obrażeń, +15% szybkości ataku, +12% krytyka',
      class: 'plasma',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['plasma_t3_hero_mastery', 'plasma_t3_overload'],
      position: { x: 2, y: 3 },
      effects: {
        modifiers: { damageBonus: 0.3, attackSpeedBonus: 0.15, critChance: 0.12 },
      },
      icon: 'supercharge',
    },
    {
      id: 'plasma_t4_rapid_fire',
      name: 'Szybki Ogień',
      description: '+25% szybkości ataku, +10% redukcji cooldownu',
      class: 'plasma',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['plasma_t3_turret_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        modifiers: { attackSpeedBonus: 0.25, cooldownReduction: 0.1 },
      },
      icon: 'rapid',
    },
    {
      id: 'plasma_t4_synergy_mastery',
      name: 'Plazmowa Jedność',
      description: 'Wszystkie bonusy synergii +20% przy Plazmie',
      class: 'plasma',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['plasma_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'plasma_unity',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each)
    // ========================================================================
    {
      id: 'plasma_t5_nova',
      name: 'Supernowa',
      description: 'CAPSTONE: +50% obrażeń. Każde 5 ataków wywołuje eksplozję plazmy wokół celu.',
      class: 'plasma',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['plasma_t4_supercharge'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'supernova',
          description: 'Periodyczne eksplozje plazmy zadają obrażenia obszarowe',
        },
        modifiers: { damageBonus: 0.5 },
      },
      icon: 'nova',
    },
    {
      id: 'plasma_t5_fusion',
      name: 'Fuzja',
      description: 'CAPSTONE: +40% obrażeń, +20% szybkości ataku. Trafienia zwiększają obrażenia o 2% (max 50%).',
      class: 'plasma',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['plasma_t4_beam_cannon', 'plasma_t4_rapid_fire'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'fusion',
          description: 'Ciągłe ataki zwiększają obrażenia',
        },
        modifiers: { damageBonus: 0.4, attackSpeedBonus: 0.2 },
      },
      icon: 'fusion',
    },
    {
      id: 'plasma_t5_plasma_unity',
      name: 'Plazmowa Perfekcja',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'plasma',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['plasma_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'plasma_perfect_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
