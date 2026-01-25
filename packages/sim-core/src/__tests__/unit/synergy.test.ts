import { describe, it, expect } from 'vitest';
import { FP } from '../../fixed.js';
import {
  calculateSynergyBonuses,
  initializeHeroes,
  initializeTurrets,
  getHeroSynergies,
  getActiveSynergiesForHeroes,
  HERO_PAIR_SYNERGIES,
  HERO_TRIO_SYNERGIES,
} from '../../systems.js';
import { createActiveRelic, createGameState } from '../helpers/factories.js';

const fortressX = FP.fromInt(2);

describe('calculateSynergyBonuses', () => {
  it('stacks hero and turret synergy bonuses', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: initializeHeroes(['forge'], fortressX),
      turrets: initializeTurrets([
        { definitionId: 'arrow', slotIndex: 1, class: 'tech' },
      ]),
    });

    const bonuses = calculateSynergyBonuses(state);

    // 1 tech hero: +30% DMG, +15% AS
    // 1 tech turret: +15% DMG, +25% AS
    // Total: 0.45 DMG bonus, 0.40 AS bonus
    expect(bonuses.damageBonus).toBeCloseTo(0.45, 5);
    expect(bonuses.attackSpeedBonus).toBeCloseTo(0.40, 5);
  });

  it('applies full synergy when minimum units are present', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: initializeHeroes(['forge', 'forge', 'forge'], fortressX),
      turrets: initializeTurrets([
        { definitionId: 'arrow', slotIndex: 1, class: 'tech' },
        { definitionId: 'cannon', slotIndex: 2, class: 'tech' },
        { definitionId: 'frost', slotIndex: 3, class: 'tech' },
        { definitionId: 'arrow', slotIndex: 4, class: 'tech' },
      ]),
    });

    const bonuses = calculateSynergyBonuses(state);

    // Full synergy (3+ heroes, 4+ turrets) adds +50% DMG, +15% crit
    expect(bonuses.damageBonus).toBeGreaterThan(1.0);
    expect(bonuses.critChance).toBeCloseTo(0.15, 5);
  });

  it('applies harmonic resonance bonuses with full synergy', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: initializeHeroes(['forge', 'forge', 'forge'], fortressX),
      turrets: initializeTurrets([
        { definitionId: 'arrow', slotIndex: 1, class: 'tech' },
        { definitionId: 'cannon', slotIndex: 2, class: 'tech' },
        { definitionId: 'frost', slotIndex: 3, class: 'tech' },
        { definitionId: 'arrow', slotIndex: 4, class: 'tech' },
      ]),
      relics: [createActiveRelic('harmonic-resonance')],
    });

    const bonuses = calculateSynergyBonuses(state);

    // Harmonic resonance adds cooldown reduction and crit when full synergy
    expect(bonuses.cooldownReduction).toBeDefined();
    expect(bonuses.critChance).toBeGreaterThanOrEqual(0.15);
  });

  it('scales bonuses per matching hero with team spirit', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: initializeHeroes(['forge'], fortressX),
      turrets: [],
      relics: [createActiveRelic('team-spirit')],
    });

    const bonuses = calculateSynergyBonuses(state);

    // With 1 tech hero:
    // Base synergy: damageBonus = 0.30, attackSpeedBonus = 0.15
    // Team-spirit adds: +0.15 damage per hero, +0.05 maxHp per hero
    // Total: damageBonus = 0.30 + 0.15 = 0.45, attackSpeedBonus = 0.15, maxHpBonus = 0.05
    expect(bonuses.damageBonus).toBeCloseTo(0.45, 5);
    expect(bonuses.attackSpeedBonus).toBeCloseTo(0.15, 5);
    expect(bonuses.maxHpBonus).toBeCloseTo(0.05, 5);
  });

  it('returns no bonuses without matching units', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: [],
      turrets: [],
    });

    const bonuses = calculateSynergyBonuses(state);

    // No heroes or turrets means no synergy bonuses
    expect(bonuses.damageBonus).toBeUndefined();
    expect(bonuses.attackSpeedBonus).toBeUndefined();
  });

  it('applies Unity Crystal additively (not multiplicatively)', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: initializeHeroes(['forge'], fortressX),
      turrets: initializeTurrets([
        { definitionId: 'arrow', slotIndex: 1, class: 'tech' },
      ]),
      relics: [createActiveRelic('unity-crystal')],
    });

    const bonuses = calculateSynergyBonuses(state);

    // Base synergy: 1 hero (+30% DMG, +15% AS) + 1 turret (+15% DMG, +25% AS)
    // = 0.45 DMG, 0.40 AS
    // Unity Crystal adds +50% of base synergy bonuses (additive)
    // = 0.45 + (0.45 * 0.5) = 0.675 DMG
    // = 0.40 + (0.40 * 0.5) = 0.60 AS
    expect(bonuses.damageBonus).toBeCloseTo(0.675, 5); // 0.45 + 0.225
    expect(bonuses.attackSpeedBonus).toBeCloseTo(0.60, 5); // 0.40 + 0.20
  });
});

// ============================================================================
// HERO SYNERGY DATA EXPORT TESTS
// ============================================================================

describe('HERO_PAIR_SYNERGIES', () => {
  it('contains all defined pair synergies', () => {
    expect(HERO_PAIR_SYNERGIES.length).toBeGreaterThan(0);

    // Verify structure of each synergy
    for (const synergy of HERO_PAIR_SYNERGIES) {
      expect(synergy.id).toBeDefined();
      expect(synergy.name).toBeDefined();
      expect(synergy.nameKey).toBeDefined();
      expect(synergy.heroes).toHaveLength(2);
      expect(synergy.description).toBeDefined();
      expect(synergy.descriptionKey).toBeDefined();
      expect(synergy.bonuses.length).toBeGreaterThan(0);
    }
  });

  it('has unique IDs for all synergies', () => {
    const ids = HERO_PAIR_SYNERGIES.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('contains storm-forge synergy', () => {
    const stormForge = HERO_PAIR_SYNERGIES.find(s => s.id === 'storm-forge');
    expect(stormForge).toBeDefined();
    expect(stormForge?.heroes).toContain('storm');
    expect(stormForge?.heroes).toContain('forge');
    expect(stormForge?.bonuses).toContain('+25% AS');
  });

  it('contains thermal shock (pyro-frost) synergy', () => {
    const thermalShock = HERO_PAIR_SYNERGIES.find(s => s.id === 'pyro-frost');
    expect(thermalShock).toBeDefined();
    expect(thermalShock?.heroes).toContain('pyro');
    expect(thermalShock?.heroes).toContain('frost');
    expect(thermalShock?.bonuses).toContain('+100% DMG');
  });
});

describe('HERO_TRIO_SYNERGIES', () => {
  it('contains all defined trio synergies', () => {
    expect(HERO_TRIO_SYNERGIES.length).toBeGreaterThan(0);

    // Verify structure of each synergy
    for (const synergy of HERO_TRIO_SYNERGIES) {
      expect(synergy.id).toBeDefined();
      expect(synergy.name).toBeDefined();
      expect(synergy.nameKey).toBeDefined();
      expect(synergy.heroes).toHaveLength(3);
      expect(synergy.description).toBeDefined();
      expect(synergy.descriptionKey).toBeDefined();
      expect(synergy.bonuses.length).toBeGreaterThan(0);
    }
  });

  it('contains balanced squad synergy', () => {
    const balancedSquad = HERO_TRIO_SYNERGIES.find(s => s.id === 'balanced-squad');
    expect(balancedSquad).toBeDefined();
    expect(balancedSquad?.heroes).toContain('medic');
    expect(balancedSquad?.heroes).toContain('pyro');
    expect(balancedSquad?.heroes).toContain('vanguard');
  });
});

describe('getHeroSynergies', () => {
  it('returns pair synergies for storm', () => {
    const result = getHeroSynergies('storm');

    expect(result.pairs.length).toBeGreaterThan(0);

    // Storm should have storm-forge and storm-frost synergies
    const stormForge = result.pairs.find(p => p.id === 'storm-forge');
    expect(stormForge).toBeDefined();
    expect(stormForge?.partner).toBe('forge');

    const superconductor = result.pairs.find(p => p.id === 'storm-frost');
    expect(superconductor).toBeDefined();
    expect(superconductor?.partner).toBe('frost');
  });

  it('returns trio synergies for medic', () => {
    const result = getHeroSynergies('medic');

    expect(result.trios.length).toBeGreaterThan(0);

    // Medic is in balanced squad
    const balancedSquad = result.trios.find(t => t.id === 'balanced-squad');
    expect(balancedSquad).toBeDefined();
    expect(balancedSquad?.partners).toContain('pyro');
    expect(balancedSquad?.partners).toContain('vanguard');
  });

  it('returns empty arrays for hero with no synergies', () => {
    // Using a hero ID that has no defined synergies
    const result = getHeroSynergies('nonexistent-hero');

    expect(result.pairs).toHaveLength(0);
    expect(result.trios).toHaveLength(0);
  });

  it('includes pair and trio partner info', () => {
    const result = getHeroSynergies('vanguard');

    // Vanguard has medic-vanguard pair
    const frontlineSupport = result.pairs.find(p => p.id === 'medic-vanguard');
    expect(frontlineSupport).toBeDefined();
    expect(frontlineSupport?.partner).toBe('medic');

    // Vanguard is in balanced squad trio
    const balancedSquad = result.trios.find(t => t.id === 'balanced-squad');
    expect(balancedSquad).toBeDefined();
    expect(balancedSquad?.partners).not.toContain('vanguard');
    expect(balancedSquad?.partners).toHaveLength(2);
  });
});

describe('getActiveSynergiesForHeroes', () => {
  it('returns empty arrays for empty hero list', () => {
    const result = getActiveSynergiesForHeroes([]);

    expect(result.active).toHaveLength(0);
    expect(result.almostActive).toHaveLength(0);
  });

  it('returns empty active for single hero', () => {
    const result = getActiveSynergiesForHeroes(['storm']);

    expect(result.active).toHaveLength(0);
    // Should have almost-active synergies (1 hero away)
    expect(result.almostActive.length).toBeGreaterThan(0);
  });

  it('detects active pair synergy when both heroes present', () => {
    const result = getActiveSynergiesForHeroes(['storm', 'forge']);

    const stormForge = result.active.find(s => s.id === 'storm-forge');
    expect(stormForge).toBeDefined();
  });

  it('detects active trio synergy when all three heroes present', () => {
    const result = getActiveSynergiesForHeroes(['medic', 'pyro', 'vanguard']);

    const balancedSquad = result.active.find(s => s.id === 'balanced-squad');
    expect(balancedSquad).toBeDefined();
  });

  it('detects almost-active pair synergy with 1 hero present', () => {
    const result = getActiveSynergiesForHeroes(['storm']);

    // Storm-forge should be almost active
    const stormForge = result.almostActive.find(a => a.synergy.id === 'storm-forge');
    expect(stormForge).toBeDefined();
    expect(stormForge?.missing).toContain('forge');
  });

  it('detects almost-active trio synergy with 2 heroes present', () => {
    const result = getActiveSynergiesForHeroes(['medic', 'pyro']);

    // Balanced squad should be almost active (missing vanguard)
    const balancedSquad = result.almostActive.find(a => a.synergy.id === 'balanced-squad');
    expect(balancedSquad).toBeDefined();
    expect(balancedSquad?.missing).toContain('vanguard');
  });

  it('handles multiple active synergies', () => {
    const result = getActiveSynergiesForHeroes(['storm', 'forge', 'frost']);

    // Should have storm-forge active
    const stormForge = result.active.find(s => s.id === 'storm-forge');
    expect(stormForge).toBeDefined();

    // Should have storm-frost (superconductor) active
    const superconductor = result.active.find(s => s.id === 'storm-frost');
    expect(superconductor).toBeDefined();

    expect(result.active.length).toBeGreaterThanOrEqual(2);
  });

  it('does not include pair synergy with 0 heroes as almost-active', () => {
    const result = getActiveSynergiesForHeroes(['some-unrelated-hero']);

    // Storm-forge requires at least 1 of storm or forge
    const stormForge = result.almostActive.find(a => a.synergy.id === 'storm-forge');
    expect(stormForge).toBeUndefined();
  });

  it('does not include trio synergy with 0-1 heroes as almost-active', () => {
    const result = getActiveSynergiesForHeroes(['medic']);

    // Balanced squad requires at least 2 of the 3 heroes
    const balancedSquad = result.almostActive.find(a => a.synergy.id === 'balanced-squad');
    expect(balancedSquad).toBeUndefined();
  });
});
