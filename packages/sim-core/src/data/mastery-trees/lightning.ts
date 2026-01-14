/**
 * Lightning Class Mastery Tree
 *
 * Focus: Attack speed, chain lightning, multi-target damage
 * Theme: Electric energy, storms, rapid strikes
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const LIGHTNING_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'lightning',
  name: 'Mistrzostwo Elektryczne',
  description: 'Opanuj błyskawiczną moc piorunów i łańcuchowych ataków',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'lightning_t1_speed',
      name: 'Elektryczny Impuls',
      description: '+10% szybkości ataku',
      class: 'lightning',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { attackSpeedBonus: 0.1 },
      },
      icon: 'bolt',
    },
    {
      id: 'lightning_t1_chain',
      name: 'Łańcuch Błyskawic',
      description: '+10% szansy na łańcuch',
      class: 'lightning',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { chainChance: 0.1 },
      },
      icon: 'chain',
    },
    {
      id: 'lightning_t1_damage',
      name: 'Napięcie',
      description: '+8% obrażeń',
      class: 'lightning',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { damageBonus: 0.08 },
      },
      icon: 'voltage',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'lightning_t2_synergy_hero',
      name: 'Powinowactwo Piorunów',
      description: 'Bohaterowie Piorunów +15% bonus z synergii',
      class: 'lightning',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['lightning_t1_speed'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_lightning',
    },
    {
      id: 'lightning_t2_speed_boost',
      name: 'Superprzewodnik',
      description: '+15% szybkości ataku, +5% obrażeń',
      class: 'lightning',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['lightning_t1_speed', 'lightning_t1_chain'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { attackSpeedBonus: 0.15, damageBonus: 0.05 },
      },
      icon: 'conductor',
    },
    {
      id: 'lightning_t2_chain_boost',
      name: 'Rozgałęzienie',
      description: '+1 cel łańcucha, +15% obrażeń łańcucha',
      class: 'lightning',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['lightning_t1_chain', 'lightning_t1_damage'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { chainCount: 1, chainDamagePercent: 0.15 },
      },
      icon: 'branch',
    },
    {
      id: 'lightning_t2_synergy_turret',
      name: 'Wieżyczki Burzowe',
      description: 'Wieżyczki Piorunów +15% bonus z synergii',
      class: 'lightning',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['lightning_t1_damage'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_lightning',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'lightning_t3_hero_mastery',
      name: 'Mistrz Burzy',
      description: 'Bohaterowie Piorunów: +25% szybkości ataku, +15% obrażeń',
      class: 'lightning',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['lightning_t2_synergy_hero', 'lightning_t2_speed_boost'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'storm_master',
          description: 'Bohaterowie Piorunów atakują z niezwykłą szybkością',
        },
        modifiers: { attackSpeedBonus: 0.25, damageBonus: 0.15 },
      },
      icon: 'storm_lord',
    },
    {
      id: 'lightning_t3_chain_mastery',
      name: 'Władca Łańcuchów',
      description: '+2 cele łańcucha, +20% szansy na łańcuch',
      class: 'lightning',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['lightning_t2_chain_boost'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { chainCount: 2, chainChance: 0.2 },
      },
      icon: 'multi_chain',
    },
    {
      id: 'lightning_t3_turret_mastery',
      name: 'Generatory Plazmowe',
      description: 'Wieżyczki Piorunów: +30% szybkości ataku, +20% obrażeń łańcucha',
      class: 'lightning',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['lightning_t2_chain_boost', 'lightning_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'plasma_generators',
          description: 'Wieżyczki Piorunów generują niszczycielską plazmę',
        },
        modifiers: { attackSpeedBonus: 0.3, chainDamagePercent: 0.2 },
      },
      icon: 'plasma',
    },
    {
      id: 'lightning_t3_full_synergy',
      name: 'Rezonans Burzowy',
      description: 'Bonus pełnej synergii +25% przy Piorunach',
      class: 'lightning',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['lightning_t2_synergy_hero', 'lightning_t2_synergy_turret'],
      position: { x: 2, y: 2.5 },
      effects: {
        synergyAmplifier: { fullSynergyBonus: 0.25 },
      },
      icon: 'resonance',
    },

    // ========================================================================
    // TIER 4: Advanced (4 nodes, 6 MP each)
    // ========================================================================
    {
      id: 'lightning_t4_overcharge',
      name: 'Przeciążenie',
      description: '+8% krytyka, +25% obrażeń krytycznych przy pełnym łańcuchu',
      class: 'lightning',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['lightning_t3_chain_mastery'],
      position: { x: 1.5, y: 3 },
      effects: {
        modifiers: { critChance: 0.08, critDamageBonus: 0.25 },
      },
      icon: 'overcharge',
    },
    {
      id: 'lightning_t4_storm_caller',
      name: 'Przywoływacz Burz',
      description: '+35% obrażeń, łańcuch zawsze aktywny (100%)',
      class: 'lightning',
      tier: 4,
      type: 'class_perk',
      cost: 6,
      requires: ['lightning_t3_hero_mastery', 'lightning_t3_chain_mastery'],
      position: { x: 2, y: 3 },
      effects: {
        classPerk: {
          id: 'storm_caller',
          description: 'Każdy atak tworzy łańcuch błyskawic',
        },
        modifiers: { damageBonus: 0.35, chainChance: 1.0 },
      },
      icon: 'caller',
    },
    {
      id: 'lightning_t4_speed_demon',
      name: 'Demon Prędkości',
      description: '+40% szybkości ataku, +15% redukcji cooldownu',
      class: 'lightning',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['lightning_t3_turret_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        modifiers: { attackSpeedBonus: 0.4, cooldownReduction: 0.15 },
      },
      icon: 'demon',
    },
    {
      id: 'lightning_t4_synergy_mastery',
      name: 'Elektryczna Harmonia',
      description: 'Wszystkie bonusy synergii +20% przy Piorunach',
      class: 'lightning',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['lightning_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'harmony',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each)
    // ========================================================================
    {
      id: 'lightning_t5_thunder_god',
      name: 'Bóg Gromu',
      description: 'CAPSTONE: +50% szybkości ataku, każdy atak ma 25% szansy na podwójne uderzenie.',
      class: 'lightning',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['lightning_t4_storm_caller'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'thunder_god',
          description: 'Błyskawiczna seria ataków z szansą na podwójne trafienie',
        },
        modifiers: { attackSpeedBonus: 0.5 },
      },
      icon: 'thor',
    },
    {
      id: 'lightning_t5_chain_reaction',
      name: 'Reakcja Łańcuchowa',
      description: 'CAPSTONE: Łańcuchy nie tracą obrażeń. +3 cele łańcucha. Zabici wrogowie eksplodują.',
      class: 'lightning',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['lightning_t4_overcharge', 'lightning_t4_speed_demon'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'chain_reaction',
          description: 'Łańcuchy zachowują pełną moc i powodują eksplozje',
        },
        modifiers: { chainCount: 3, chainDamagePercent: 1.0 },
      },
      icon: 'explosion',
    },
    {
      id: 'lightning_t5_electric_unity',
      name: 'Elektryczna Jedność',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'lightning',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['lightning_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'electric_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
