import { describe, it, expect } from 'vitest';
import { FP } from '../../fixed.js';
import { calculateSynergyBonuses, initializeHeroes, initializeTurrets } from '../../systems.js';
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
      heroes: initializeHeroes(['forge', 'forge'], fortressX),
      turrets: initializeTurrets([
        { definitionId: 'arrow', slotIndex: 1, class: 'tech' },
        { definitionId: 'cannon', slotIndex: 2, class: 'tech' },
        { definitionId: 'frost', slotIndex: 3, class: 'tech' },
      ]),
    });

    const bonuses = calculateSynergyBonuses(state);

    // Full synergy (2+ heroes, 3+ turrets) adds +50% DMG, +15% crit
    expect(bonuses.damageBonus).toBeGreaterThan(1.0);
    expect(bonuses.critChance).toBeCloseTo(0.15, 5);
  });

  it('applies harmonic resonance bonuses with full synergy', () => {
    const state = createGameState({
      fortressClass: 'tech',
      heroes: initializeHeroes(['forge', 'forge'], fortressX),
      turrets: initializeTurrets([
        { definitionId: 'arrow', slotIndex: 1, class: 'tech' },
        { definitionId: 'cannon', slotIndex: 2, class: 'tech' },
        { definitionId: 'frost', slotIndex: 3, class: 'tech' },
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
});
