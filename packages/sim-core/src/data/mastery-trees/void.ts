/**
 * Void Class Mastery Tree
 *
 * Focus: Balanced offense/defense, cooldown reduction, chaos
 * Theme: Dimensional energy, void power, unpredictability
 */

import type { MasteryTreeDefinition } from '../mastery.js';

export const VOID_MASTERY_TREE: MasteryTreeDefinition = {
  class: 'void',
  name: 'Mistrzostwo Próżni',
  description: 'Opanuj chaotyczną moc wymiarów i próżni',
  totalNodes: 18,
  maxPointsToComplete: 100,
  nodes: [
    // ========================================================================
    // TIER 1: Foundation (3 nodes, 1 MP each)
    // ========================================================================
    {
      id: 'void_t1_damage',
      name: 'Moc Próżni',
      description: '+10% obrażeń',
      class: 'void',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 1, y: 0 },
      effects: {
        modifiers: { damageBonus: 0.1 },
      },
      icon: 'void_power',
    },
    {
      id: 'void_t1_cdr',
      name: 'Zakrzywienie Czasu',
      description: '+8% redukcji cooldownu',
      class: 'void',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 2, y: 0 },
      effects: {
        modifiers: { cooldownReduction: 0.08 },
      },
      icon: 'time',
    },
    {
      id: 'void_t1_hp',
      name: 'Wymiarowa Tarcza',
      description: '+8% HP',
      class: 'void',
      tier: 1,
      type: 'stat_bonus',
      cost: 1,
      requires: [],
      position: { x: 3, y: 0 },
      effects: {
        modifiers: { maxHpBonus: 0.08 },
      },
      icon: 'shield',
    },

    // ========================================================================
    // TIER 2: Specialization (4 nodes, 2 MP each)
    // ========================================================================
    {
      id: 'void_t2_synergy_hero',
      name: 'Powinowactwo Próżni',
      description: 'Bohaterowie Próżni +15% bonus z synergii',
      class: 'void',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['void_t1_damage'],
      position: { x: 0.5, y: 1 },
      effects: {
        synergyAmplifier: { heroSynergyBonus: 0.15 },
      },
      icon: 'hero_void',
    },
    {
      id: 'void_t2_chaos',
      name: 'Chaos',
      description: '+12% obrażeń, +5% krytyka, +5% szybkości ataku',
      class: 'void',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['void_t1_damage', 'void_t1_cdr'],
      position: { x: 1.5, y: 1 },
      effects: {
        modifiers: { damageBonus: 0.12, critChance: 0.05, attackSpeedBonus: 0.05 },
      },
      icon: 'chaos',
    },
    {
      id: 'void_t2_temporal',
      name: 'Temporal',
      description: '+10% redukcji cooldownu, +8% HP',
      class: 'void',
      tier: 2,
      type: 'stat_bonus',
      cost: 2,
      requires: ['void_t1_cdr', 'void_t1_hp'],
      position: { x: 2.5, y: 1 },
      effects: {
        modifiers: { cooldownReduction: 0.1, maxHpBonus: 0.08 },
      },
      icon: 'temporal',
    },
    {
      id: 'void_t2_synergy_turret',
      name: 'Wieżyczki Wymiarowe',
      description: 'Wieżyczki Próżni +15% bonus z synergii',
      class: 'void',
      tier: 2,
      type: 'synergy_amplifier',
      cost: 2,
      requires: ['void_t1_hp'],
      position: { x: 3.5, y: 1 },
      effects: {
        synergyAmplifier: { turretSynergyBonus: 0.15 },
      },
      icon: 'turret_void',
    },

    // ========================================================================
    // TIER 3: Major Power (4 nodes, 4 MP each)
    // ========================================================================
    {
      id: 'void_t3_hero_mastery',
      name: 'Władca Próżni',
      description: 'Bohaterowie Próżni: +20% obrażeń, +15% redukcji cooldownu',
      class: 'void',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['void_t2_synergy_hero', 'void_t2_chaos'],
      position: { x: 1, y: 2 },
      effects: {
        classPerk: {
          id: 'void_lord',
          description: 'Bohaterowie Próżni władają mocą wymiarów',
        },
        modifiers: { damageBonus: 0.2, cooldownReduction: 0.15 },
      },
      icon: 'void_lord',
    },
    {
      id: 'void_t3_entropy',
      name: 'Entropia',
      description: '+20% obrażeń, +10% krytyka, +10% obrażeń krytycznych',
      class: 'void',
      tier: 3,
      type: 'stat_bonus',
      cost: 4,
      requires: ['void_t2_chaos'],
      position: { x: 2, y: 2 },
      effects: {
        modifiers: { damageBonus: 0.2, critChance: 0.1, critDamageBonus: 0.1 },
      },
      icon: 'entropy',
    },
    {
      id: 'void_t3_turret_mastery',
      name: 'Portale Wymiarowe',
      description: 'Wieżyczki Próżni: +20% obrażeń, +20% redukcji cooldownu',
      class: 'void',
      tier: 3,
      type: 'class_perk',
      cost: 4,
      requires: ['void_t2_temporal', 'void_t2_synergy_turret'],
      position: { x: 3, y: 2 },
      effects: {
        classPerk: {
          id: 'dimensional_portals',
          description: 'Wieżyczki Próżni otwierają niszczycielskie portale',
        },
        modifiers: { damageBonus: 0.2, cooldownReduction: 0.2 },
      },
      icon: 'portal',
    },
    {
      id: 'void_t3_full_synergy',
      name: 'Harmonia Chaosu',
      description: 'Bonus pełnej synergii +25% przy Próżni',
      class: 'void',
      tier: 3,
      type: 'synergy_amplifier',
      cost: 4,
      requires: ['void_t2_synergy_hero', 'void_t2_synergy_turret'],
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
      id: 'void_t4_singularity',
      name: 'Osobliwość',
      description: '+35% obrażeń, +5% obrażeń za każdą falę (max 50%)',
      class: 'void',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['void_t3_entropy'],
      position: { x: 1.5, y: 3 },
      effects: {
        modifiers: { damageBonus: 0.35, waveDamageBonus: 0.05 },
      },
      icon: 'singularity',
    },
    {
      id: 'void_t4_reality_warp',
      name: 'Zakrzywienie Rzeczywistości',
      description: '+30% obrażeń, +15% krytyka, +25% redukcji cooldownu',
      class: 'void',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['void_t3_hero_mastery', 'void_t3_entropy'],
      position: { x: 2, y: 3 },
      effects: {
        modifiers: { damageBonus: 0.3, critChance: 0.15, cooldownReduction: 0.25 },
      },
      icon: 'warp',
    },
    {
      id: 'void_t4_dimension_shift',
      name: 'Przesunięcie Wymiarowe',
      description: '+20% HP, +15% redukcji obrażeń, +10% odporności na CC',
      class: 'void',
      tier: 4,
      type: 'stat_bonus',
      cost: 6,
      requires: ['void_t3_turret_mastery'],
      position: { x: 2.5, y: 3 },
      effects: {
        modifiers: { maxHpBonus: 0.2, incomingDamageReduction: 0.15, ccResistance: 0.1 },
      },
      icon: 'shift',
    },
    {
      id: 'void_t4_synergy_mastery',
      name: 'Jedność Wymiarów',
      description: 'Wszystkie bonusy synergii +20% przy Próżni',
      class: 'void',
      tier: 4,
      type: 'synergy_amplifier',
      cost: 6,
      requires: ['void_t3_full_synergy'],
      position: { x: 3, y: 3 },
      effects: {
        synergyAmplifier: {
          heroSynergyBonus: 0.2,
          turretSynergyBonus: 0.2,
          fullSynergyBonus: 0.2,
        },
      },
      icon: 'dimension_unity',
    },

    // ========================================================================
    // TIER 5: Capstones (3 nodes, 10 MP each)
    // ========================================================================
    {
      id: 'void_t5_oblivion',
      name: 'Unicestwienie',
      description: 'CAPSTONE: +50% obrażeń. 10% szansy na natychmiastowe zabicie wrogów poniżej 20% HP.',
      class: 'void',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['void_t4_singularity'],
      position: { x: 1, y: 4 },
      effects: {
        classPerk: {
          id: 'oblivion',
          description: 'Szansa na natychmiastowe unicestwienie osłabionych wrogów',
        },
        modifiers: { damageBonus: 0.5, executeThreshold: 0.2 },
      },
      icon: 'oblivion',
    },
    {
      id: 'void_t5_event_horizon',
      name: 'Horyzont Zdarzeń',
      description: 'CAPSTONE: +40% obrażeń, +20% krytyka. Umiejętności mają 50% szansy na reset cooldownu.',
      class: 'void',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['void_t4_reality_warp', 'void_t4_dimension_shift'],
      position: { x: 2, y: 4 },
      effects: {
        classPerk: {
          id: 'event_horizon',
          description: 'Cooldowny mogą się resetować po użyciu umiejętności',
        },
        modifiers: { damageBonus: 0.4, critChance: 0.2 },
      },
      icon: 'horizon',
    },
    {
      id: 'void_t5_void_unity',
      name: 'Próżniowa Jedność',
      description: 'CAPSTONE: Wymagania pełnej synergii zmniejszone (1 bohater + 2 wieżyczki). Synergia +50%.',
      class: 'void',
      tier: 5,
      type: 'capstone',
      cost: 10,
      requires: ['void_t4_synergy_mastery'],
      position: { x: 3, y: 4 },
      effects: {
        classPerk: {
          id: 'void_perfect_unity',
          description: 'Łatwiejsza aktywacja pełnej synergii z ogromnym bonusem',
        },
        synergyAmplifier: { fullSynergyBonus: 0.5 },
      },
      icon: 'unity',
    },
  ],
};
