/**
 * Tech Class Mastery Tree
 *
 * Focus: Precision, pierce, critical hits, gold bonus
 * Theme: Quantum technology, lasers, precision strikes
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const TECH_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'tech',
  name: 'Mistrzostwo Kwantowe',
  description: 'Opanuj precyzyjną technologię kwantową i przebijające ataki',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'tech_t1_pierce',
      name: 'Penetracja',
      description: '+1 przebicie (pierce)',
      class: 'tech',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { pierceCount: 1 },
      },
      icon: 'pierce',
    },
    {
      id: 'tech_t1_crit',
      name: 'Precyzja',
      description: '+8% szansy na krytyka',
      class: 'tech',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { critChance: 0.08 },
      },
      icon: 'target',
    },
    {
      id: 'tech_t1_gold',
      name: 'Efektywność',
      description: '+10% złota',
      class: 'tech',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { goldBonus: 0.1 },
      },
      icon: 'gold',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'tech_t2_synergy_hero',
      name: 'Powinowactwo Tech',
      description: 'Bohaterowie Tech +15% bonus z synergii',
      class: 'tech',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['tech_t1_pierce'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_tech',
    },
    {
      id: 'tech_t2_precision',
      name: 'Celność',
      description: '+1 przebicie, +5% krytyka, +10% obrażeń',
      class: 'tech',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['tech_t1_pierce', 'tech_t1_crit'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { pierceCount: 1, critChance: 0.05, damageBonus: 0.1 },
      },
      icon: 'precision',
    },
    {
      id: 'tech_t2_profit',
      name: 'Zysk',
      description: '+15% złota, +5% bonus do dropu',
      class: 'tech',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['tech_t1_crit', 'tech_t1_gold'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { goldBonus: 0.15, dropRateBonus: 0.05 },
      },
      icon: 'profit',
    },
    {
      id: 'tech_t2_synergy_turret',
      name: 'Wieżyczki Kwantowe',
      description: 'Wieżyczki Tech +15% bonus z synergii',
      class: 'tech',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['tech_t1_gold'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_tech',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'tech_t3_hero_mastery',
      name: 'Mistrz Technologii',
      description: 'Bohaterowie Tech: +2 przebicie, +20% obrażeń',
      class: 'tech',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['tech_t2_synergy_hero', 'tech_t2_precision'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'tech_master',
          description: 'Bohaterowie Tech przebijają wielu wrogów',
        },
        modifiers: { pierceCount: 2, damageBonus: 0.2 },
      },
      icon: 'tech_master',
    },
    {
      id: 'tech_t3_sniper',
      name: 'Snajper',
      description: '+12% krytyka, +25% obrażeń krytycznych',
      class: 'tech',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['tech_t2_precision'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { critChance: 0.12, critDamageBonus: 0.25 },
      },
      icon: 'sniper',
    },
    {
      id: 'tech_t3_turret_mastery',
      name: 'Lasery Precyzyjne',
      description: 'Wieżyczki Tech: +25% obrażeń, +10% krytyka',
      class: 'tech',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['tech_t2_profit', 'tech_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'precision_lasers',
          description: 'Wieżyczki Tech zadają precyzyjne obrażenia',
        },
        modifiers: { damageBonus: 0.25, critChance: 0.1 },
      },
      icon: 'laser',
    },
    {
      id: 'tech_t3_full_synergy',
      name: 'Kwantowa Harmonia',
      description: 'Bonus pełnej synergii +25% przy Tech',
      class: 'tech',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['tech_t2_synergy_hero', 'tech_t2_synergy_turret'],
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
      id: 'tech_t4_railgun',
      name: 'Railgun',
      description: '+3 przebicia, +20% obrażeń. Pociski nie tracą obrażeń przy przebijaniu.',
      class: 'tech',
      tier: 4,
      type: 'class_perk',
      cost: 6,
      requires: ['tech_t3_sniper'],
      position: { x: 1.5, y: 3 },
      effects: {
        classPerk: {
          id: 'railgun',
          description: 'Pociski przebijają wszystko z pełną mocą',
        },
        modifiers: { pierceCount: 3, damageBonus: 0.2 },
      },
      icon: 'railgun',
    },
    {
      id: 'tech_t4_headshot',
      name: 'Headshot',
      description: '+15% krytyka, +50% obrażeń krytycznych',
      class: 'tech',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['tech_t3_hero_mastery', 'tech_t3_sniper'],
      position: { x: 2, y: 3 },
      effects: {
        modifiers: { critChance: 0.15, critDamageBonus: 0.5 },
      },
      icon: 'headshot',
    },
    {
      id: 'tech_t4_economy',
      name: 'Ekonomia',
      description: '+30% złota, +15% bonus do dropu, +10% jakości reliktów',
      class: 'tech',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['tech_t3_turret_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        modifiers: { goldBonus: 0.3, dropRateBonus: 0.15, relicQualityBonus: 0.1 },
      },
      icon: 'economy',
    },
    {
      id: 'tech_t4_synergy_mastery',
      name: 'Kwantowa Jedność',
      description: 'Wszystkie bonusy synergii +20% przy Tech',
      class: 'tech',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['tech_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'quantum_unity',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each)
    // ========================================================================
    {
      id: 'tech_t5_singularity',
      name: 'Osobliwość',
      description: 'CAPSTONE: +5 przebicia. Każdy przebity wróg zwiększa obrażenia następnemu o 10%.',
      class: 'tech',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['tech_t4_railgun'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'singularity',
          description: 'Pociski nabierają mocy przebijając wrogów',
        },
        modifiers: { pierceCount: 5 },
      },
      icon: 'singularity',
    },
    {
      id: 'tech_t5_perfect_shot',
      name: 'Perfekcyjny Strzał',
      description: 'CAPSTONE: +20% krytyka, +75% obrażeń krytycznych. Krytyki gwarantowane na pierwszym wrogui.',
      class: 'tech',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['tech_t4_headshot', 'tech_t4_economy'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'perfect_shot',
          description: 'Pierwszy strzał zawsze krytyczny z ogromnymi obrażeniami',
        },
        modifiers: { critChance: 0.2, critDamageBonus: 0.75 },
      },
      icon: 'perfect',
    },
    {
      id: 'tech_t5_tech_unity',
      name: 'Technologiczna Jedność',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'tech',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['tech_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'tech_perfect_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
