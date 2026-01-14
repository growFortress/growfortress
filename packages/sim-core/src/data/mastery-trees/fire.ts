/**
 * Fire Class Mastery Tree
 *
 * Focus: Maximum damage, splash damage, critical hits, execute mechanics
 * Theme: Thermal energy, flames, explosions
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const FIRE_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'fire',
  name: 'Mistrzostwo Termiczne',
  description: 'Opanuj niszczycielską moc ognia i energii termicznej',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'fire_t1_damage',
      name: 'Wydajność Termiczna',
      description: '+10% obrażeń z klasą Ognia',
      class: 'fire',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { damageBonus: 0.1 },
      },
      icon: 'flame',
    },
    {
      id: 'fire_t1_crit',
      name: 'Punkt Zapłonu',
      description: '+5% szansy na krytyka',
      class: 'fire',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { critChance: 0.05 },
      },
      icon: 'spark',
    },
    {
      id: 'fire_t1_splash',
      name: 'Fala Gorąca',
      description: '+10% obrażeń obszarowych',
      class: 'fire',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { splashDamagePercent: 0.1 },
      },
      icon: 'wave',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'fire_t2_synergy_hero',
      name: 'Powinowactwo Ognia',
      description: 'Bohaterowie Ognia +15% bonus z synergii',
      class: 'fire',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['fire_t1_damage'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_fire',
    },
    {
      id: 'fire_t2_damage_boost',
      name: 'Piekło',
      description: '+15% obrażeń, +3% krytyka',
      class: 'fire',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['fire_t1_damage', 'fire_t1_crit'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { damageBonus: 0.15, critChance: 0.03 },
      },
      icon: 'inferno',
    },
    {
      id: 'fire_t2_splash_boost',
      name: 'Spalanie',
      description: '+2 zasięg obszarowy, +15% obrażeń obszarowych',
      class: 'fire',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['fire_t1_crit', 'fire_t1_splash'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { splashRadiusBonus: 2, splashDamagePercent: 0.15 },
      },
      icon: 'explosion',
    },
    {
      id: 'fire_t2_synergy_turret',
      name: 'Wieżyczki Termiczne',
      description: 'Wieżyczki Ognia +15% bonus z synergii',
      class: 'fire',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['fire_t1_splash'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_fire',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'fire_t3_hero_mastery',
      name: 'Mistrz Płomieni',
      description: 'Bohaterowie Ognia: +20% obrażeń, +10% szybkości ataku',
      class: 'fire',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['fire_t2_synergy_hero', 'fire_t2_damage_boost'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'flame_champion',
          description: 'Bohaterowie Ognia otrzymują znaczący bonus do statystyk',
        },
        modifiers: { damageBonus: 0.2, attackSpeedBonus: 0.1 },
      },
      icon: 'champion',
    },
    {
      id: 'fire_t3_crit_mastery',
      name: 'Masa Krytyczna',
      description: '+10% szansy na krytyka, +30% obrażeń krytycznych',
      class: 'fire',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['fire_t2_damage_boost'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { critChance: 0.1, critDamageBonus: 0.3 },
      },
      icon: 'critical',
    },
    {
      id: 'fire_t3_turret_mastery',
      name: 'Artyleria',
      description: 'Wieżyczki Ognia: +25% obrażeń, +3 zasięg obszarowy',
      class: 'fire',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['fire_t2_splash_boost', 'fire_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'artillery_barrage',
          description: 'Wieżyczki Ognia stają się niszczycielską artylerią',
        },
        modifiers: { damageBonus: 0.25, splashRadiusBonus: 3 },
      },
      icon: 'artillery',
    },
    {
      id: 'fire_t3_full_synergy',
      name: 'Harmonia Żywiołów',
      description: 'Bonus pełnej synergii +25% przy Ogniu',
      class: 'fire',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['fire_t2_synergy_hero', 'fire_t2_synergy_turret'],
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
      id: 'fire_t4_execute',
      name: 'Spopielenie',
      description: 'Egzekucja wrogów poniżej 10% HP za +150% obrażeń',
      class: 'fire',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['fire_t3_crit_mastery'],
      position: { x: 1.5, y: 3 },
      effects: {
        modifiers: { executeThreshold: 0.1, executeBonusDamage: 1.5 },
      },
      icon: 'execute',
    },
    {
      id: 'fire_t4_elite_slayer',
      name: 'Pogromca Smoków',
      description: '+40% obrażeń przeciwko elitom',
      class: 'fire',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['fire_t3_hero_mastery', 'fire_t3_crit_mastery'],
      position: { x: 2, y: 3 },
      effects: {
        modifiers: { eliteDamageBonus: 0.4 },
      },
      icon: 'dragon',
    },
    {
      id: 'fire_t4_aoe_master',
      name: 'Burza Ognia',
      description: '+50% obrażeń obszarowych',
      class: 'fire',
      tier: 4,
      type: 'class_perk',
      cost: 6,
      requires: ['fire_t3_turret_mastery', 'fire_t3_crit_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        classPerk: {
          id: 'firestorm',
          description: 'Ataki obszarowe trafiają wszystkich wrogów w zasięgu',
        },
        modifiers: { splashDamagePercent: 0.5 },
      },
      icon: 'storm',
    },
    {
      id: 'fire_t4_synergy_mastery',
      name: 'Rezonans Termiczny',
      description: 'Wszystkie bonusy synergii +20% przy Ogniu',
      class: 'fire',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['fire_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'resonance',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each - choose 1-2)
    // ========================================================================
    {
      id: 'fire_t5_phoenix',
      name: 'Protokół Feniksa',
      description: 'CAPSTONE: Gdy HP fortecy spadnie poniżej 20%, zyskujesz +100% obrażeń na 10s. Raz na rundę.',
      class: 'fire',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['fire_t4_elite_slayer'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'phoenix_protocol',
          description: 'Awaryjne wzmocnienie obrażeń na granicy śmierci',
        },
      },
      icon: 'phoenix',
    },
    {
      id: 'fire_t5_solar_flare',
      name: 'Rozbłysk Słoneczny',
      description: 'CAPSTONE: Wszystkie obrażenia ognia ignorują 30% odporności wroga. +25% obrażeń.',
      class: 'fire',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['fire_t4_execute', 'fire_t4_aoe_master'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'solar_flare',
          description: 'Obrażenia ognia przebijają obronę wrogów',
        },
        modifiers: { damageBonus: 0.25 },
      },
      icon: 'sun',
    },
    {
      id: 'fire_t5_infernal_unity',
      name: 'Piekielna Jedność',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'fire',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['fire_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'infernal_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
