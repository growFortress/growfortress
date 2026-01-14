/**
 * Natural Class Mastery Tree
 *
 * Focus: Balance, HP, regeneration, defense
 * Theme: Nature, earth, balanced approach
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const NATURAL_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'natural',
  name: 'Mistrzostwo Natury',
  description: 'Opanuj zrównoważoną moc natury i regeneracji',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'natural_t1_hp',
      name: 'Naturalna Witalność',
      description: '+10% maksymalnego HP',
      class: 'natural',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { maxHpBonus: 0.1 },
      },
      icon: 'heart',
    },
    {
      id: 'natural_t1_damage',
      name: 'Siła Natury',
      description: '+8% obrażeń',
      class: 'natural',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { damageBonus: 0.08 },
      },
      icon: 'leaf',
    },
    {
      id: 'natural_t1_regen',
      name: 'Regeneracja',
      description: '+3 regeneracji HP na sekundę',
      class: 'natural',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { hpRegen: 3 },
      },
      icon: 'regen',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'natural_t2_synergy_hero',
      name: 'Powinowactwo Natury',
      description: 'Bohaterowie Natury +15% bonus z synergii',
      class: 'natural',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['natural_t1_hp'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_natural',
    },
    {
      id: 'natural_t2_balance',
      name: 'Równowaga',
      description: '+8% HP, +8% obrażeń, +8% szybkości ataku',
      class: 'natural',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['natural_t1_hp', 'natural_t1_damage'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { maxHpBonus: 0.08, damageBonus: 0.08, attackSpeedBonus: 0.08 },
      },
      icon: 'balance',
    },
    {
      id: 'natural_t2_fortify',
      name: 'Fortyfikacja',
      description: '+5 regeneracji HP, +5% redukcji obrażeń',
      class: 'natural',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['natural_t1_damage', 'natural_t1_regen'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { hpRegen: 5, incomingDamageReduction: 0.05 },
      },
      icon: 'shield',
    },
    {
      id: 'natural_t2_synergy_turret',
      name: 'Wieżyczki Żywiołowe',
      description: 'Wieżyczki Natury +15% bonus z synergii',
      class: 'natural',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['natural_t1_regen'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_natural',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'natural_t3_hero_mastery',
      name: 'Strażnik Natury',
      description: 'Bohaterowie Natury: +20% HP, +15% obrażeń, +5 regeneracji',
      class: 'natural',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['natural_t2_synergy_hero', 'natural_t2_balance'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'nature_guardian',
          description: 'Bohaterowie Natury są wyjątkowo wytrzymali',
        },
        modifiers: { maxHpBonus: 0.2, damageBonus: 0.15, hpRegen: 5 },
      },
      icon: 'guardian',
    },
    {
      id: 'natural_t3_growth',
      name: 'Wzrost',
      description: '+15% HP, +15% obrażeń, +5% szybkości ataku',
      class: 'natural',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['natural_t2_balance'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { maxHpBonus: 0.15, damageBonus: 0.15, attackSpeedBonus: 0.05 },
      },
      icon: 'growth',
    },
    {
      id: 'natural_t3_turret_mastery',
      name: 'Bastiony Natury',
      description: 'Wieżyczki Natury: +20% obrażeń, +20% HP',
      class: 'natural',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['natural_t2_fortify', 'natural_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'nature_bastions',
          description: 'Wieżyczki Natury są wytrzymałe i silne',
        },
        modifiers: { damageBonus: 0.2, maxHpBonus: 0.2 },
      },
      icon: 'bastion',
    },
    {
      id: 'natural_t3_full_synergy',
      name: 'Harmonia Natury',
      description: 'Bonus pełnej synergii +25% przy Naturze',
      class: 'natural',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['natural_t2_synergy_hero', 'natural_t2_synergy_turret'],
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
      id: 'natural_t4_resilience',
      name: 'Odporność',
      description: '+25% HP, +15% redukcji obrażeń',
      class: 'natural',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['natural_t3_growth'],
      position: { x: 1.5, y: 3 },
      effects: {
        modifiers: { maxHpBonus: 0.25, incomingDamageReduction: 0.15 },
      },
      icon: 'resilience',
    },
    {
      id: 'natural_t4_primal_power',
      name: 'Pierwotna Moc',
      description: '+30% obrażeń, +10% szybkości ataku, +10% krytyka',
      class: 'natural',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['natural_t3_hero_mastery', 'natural_t3_growth'],
      position: { x: 2, y: 3 },
      effects: {
        modifiers: { damageBonus: 0.3, attackSpeedBonus: 0.1, critChance: 0.1 },
      },
      icon: 'primal',
    },
    {
      id: 'natural_t4_overgrowth',
      name: 'Przerośnięcie',
      description: '+10 regeneracji HP, +30% maksymalnego HP',
      class: 'natural',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['natural_t3_turret_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        modifiers: { hpRegen: 10, maxHpBonus: 0.3 },
      },
      icon: 'overgrowth',
    },
    {
      id: 'natural_t4_synergy_mastery',
      name: 'Naturalna Jedność',
      description: 'Wszystkie bonusy synergii +20% przy Naturze',
      class: 'natural',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['natural_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'nature_unity',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each)
    // ========================================================================
    {
      id: 'natural_t5_world_tree',
      name: 'Drzewo Świata',
      description: 'CAPSTONE: +50% HP. Gdy HP spadnie poniżej 30%, regeneruj 5% HP na sekundę przez 10s.',
      class: 'natural',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['natural_t4_resilience'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'world_tree',
          description: 'Potężna regeneracja w krytycznych momentach',
        },
        modifiers: { maxHpBonus: 0.5 },
      },
      icon: 'yggdrasil',
    },
    {
      id: 'natural_t5_gaia',
      name: 'Gniew Gai',
      description: 'CAPSTONE: +40% obrażeń. Każde 10% brakującego HP daje +5% obrażeń.',
      class: 'natural',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['natural_t4_primal_power', 'natural_t4_overgrowth'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'gaia_wrath',
          description: 'Im więcej brakuje HP, tym większe obrażenia',
        },
        modifiers: { damageBonus: 0.4, lowHpDamageBonus: 0.05, lowHpThreshold: 0.9 },
      },
      icon: 'gaia',
    },
    {
      id: 'natural_t5_nature_unity',
      name: 'Jedność z Naturą',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'natural',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['natural_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'nature_perfect_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
