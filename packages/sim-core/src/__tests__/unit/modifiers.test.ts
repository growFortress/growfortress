import { describe, it, expect } from 'vitest';
import {
  computeModifiers,
  calculateDamage,
  shouldCrit,
  shouldChain,
} from '../../modifiers.js';
import { DEFAULT_MODIFIERS } from '../../data/relics.js';
import {
  createActiveRelic,
  createGameState,
  createEnemy,
  createModifiers,
} from '../helpers/factories.js';

describe('computeModifiers', () => {
  it('returns defaults for empty relics array', () => {
    const result = computeModifiers([]);
    expect(result).toEqual(DEFAULT_MODIFIERS);
  });

  it('applies single relic modifiers', () => {
    const relics = [createActiveRelic('sharpened-blades')];
    const result = computeModifiers(relics);
    expect(result.damageMultiplier).toBe(1.2); // +20% damage
  });

  it('stacks multiplicative modifiers correctly', () => {
    const relics = [
      createActiveRelic('sharpened-blades'), // 1.2x
      createActiveRelic('sharpened-blades'), // 1.2x again (if allowed)
    ];
    // Note: In practice, same relic might not be allowed twice
    // but the computation would stack: 1.0 * 1.2 * 1.2 = 1.44
    const result = computeModifiers(relics);
    expect(result.damageMultiplier).toBeCloseTo(1.44, 5);
  });

  it('stacks additive modifiers correctly (attackSpeedMultiplier)', () => {
    const relics = [createActiveRelic('swift-strikes')];
    const result = computeModifiers(relics);
    expect(result.attackSpeedMultiplier).toBe(1.15); // +15% attack speed
  });

  it('caps chainChance at 1.0', () => {
    // Multiple chain lightning relics would exceed 1.0
    const relics = [
      createActiveRelic('chain-lightning'),
      createActiveRelic('chain-lightning'),
      createActiveRelic('chain-lightning'),
      createActiveRelic('chain-lightning'),
    ];
    const result = computeModifiers(relics);
    expect(result.chainChance).toBeLessThanOrEqual(1.0);
  });

  it('caps critChance at 1.0', () => {
    const relics = [
      createActiveRelic('critical-eye'),
      createActiveRelic('critical-eye'),
      createActiveRelic('critical-eye'),
      createActiveRelic('critical-eye'),
      createActiveRelic('critical-eye'),
      createActiveRelic('critical-eye'),
      createActiveRelic('critical-eye'),
    ];
    const result = computeModifiers(relics);
    expect(result.critChance).toBeLessThanOrEqual(1.0);
  });

  it('takes max for splash/pierce effects', () => {
    const relics = [createActiveRelic('splash-master')];
    const result = computeModifiers(relics);
    expect(result.splashRadius).toBeGreaterThan(0);
    expect(result.splashDamage).toBe(0.35); // rebalanced from 0.5
  });

  it('handles unknown relic ID gracefully', () => {
    const relics = [createActiveRelic('nonexistent-relic')];
    const result = computeModifiers(relics);
    expect(result).toEqual(DEFAULT_MODIFIERS);
  });

  it('applies gold multiplier relic', () => {
    const relics = [createActiveRelic('gold-rush')];
    const result = computeModifiers(relics);
    expect(result.goldMultiplier).toBe(1.5);
  });

  it('applies max HP relic', () => {
    const relics = [createActiveRelic('iron-hide')];
    const result = computeModifiers(relics);
    expect(result.maxHpMultiplier).toBe(1.25);
  });

  it('applies attack speed relic', () => {
    const relics = [createActiveRelic('swift-strikes')];
    const result = computeModifiers(relics);
    expect(result.attackSpeedMultiplier).toBe(1.15);
  });

  it('applies elite hunter relic', () => {
    const relics = [createActiveRelic('elite-hunter')];
    const result = computeModifiers(relics);
    expect(result.eliteDamageMultiplier).toBe(1.5);
  });

  it('applies executioner relic', () => {
    const relics = [createActiveRelic('executioner')];
    const result = computeModifiers(relics);
    expect(result.executeThreshold).toBe(0.15);
    expect(result.executeDamage).toBe(3);
  });

  it('applies crit chance relic', () => {
    const relics = [createActiveRelic('critical-eye')];
    const result = computeModifiers(relics);
    expect(result.critChance).toBe(0.10);
  });

  it('combines multiple relics correctly', () => {
    const relics = [
      createActiveRelic('sharpened-blades'),
      createActiveRelic('gold-rush'),
      createActiveRelic('critical-eye'),
    ];
    const result = computeModifiers(relics);
    expect(result.damageMultiplier).toBe(1.2);
    expect(result.goldMultiplier).toBe(1.5);
    expect(result.critChance).toBe(0.10);
  });
});

describe('calculateDamage', () => {
  it('applies base damage multiplier', () => {
    const state = createGameState({
      modifiers: createModifiers({ damageMultiplier: 2.0 }),
    });
    const enemy = createEnemy();
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(20);
  });

  it('applies wave damage bonus', () => {
    const state = createGameState({
      wavesCleared: 5,
      modifiers: createModifiers({ waveDamageBonus: 0.1 }), // 10% per wave
    });
    const enemy = createEnemy();
    // Base 10 * (1 + 0.1 * 5) = 10 * 1.5 = 15
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(15);
  });

  it('applies elite damage bonus when target is elite', () => {
    const state = createGameState({
      modifiers: createModifiers({ eliteDamageMultiplier: 1.5 }),
    });
    const enemy = createEnemy({ isElite: true });
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(15);
  });

  it('does not apply elite damage bonus to non-elite', () => {
    const state = createGameState({
      modifiers: createModifiers({ eliteDamageMultiplier: 1.5 }),
    });
    const enemy = createEnemy({ isElite: false });
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(10);
  });

  it('applies execute damage when target below threshold', () => {
    const state = createGameState({
      modifiers: createModifiers({
        executeThreshold: 0.2,
        executeDamage: 3.0,
      }),
    });
    const enemy = createEnemy({ hp: 10, maxHp: 100 }); // 10% HP
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(30);
  });

  it('does not apply execute damage when target above threshold', () => {
    const state = createGameState({
      modifiers: createModifiers({
        executeThreshold: 0.2,
        executeDamage: 3.0,
      }),
    });
    const enemy = createEnemy({ hp: 50, maxHp: 100 }); // 50% HP
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(10);
  });

  it('applies low HP fortress bonus', () => {
    const state = createGameState({
      fortressHp: 20,
      fortressMaxHp: 100, // 20% HP
      modifiers: createModifiers({
        lowHpThreshold: 0.3,
        lowHpDamageMultiplier: 2.0,
      }),
    });
    const enemy = createEnemy();
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(20);
  });

  it('does not apply low HP bonus when fortress above threshold', () => {
    const state = createGameState({
      fortressHp: 80,
      fortressMaxHp: 100, // 80% HP
      modifiers: createModifiers({
        lowHpThreshold: 0.3,
        lowHpDamageMultiplier: 2.0,
      }),
    });
    const enemy = createEnemy();
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(10);
  });

  it('applies critical hit multiplier', () => {
    const state = createGameState({
      modifiers: createModifiers({ critDamage: 2.0 }),
    });
    const enemy = createEnemy();
    const damage = calculateDamage(10, state, enemy, true);
    expect(damage).toBe(20);
  });

  it('does not apply crit multiplier when not critting', () => {
    const state = createGameState({
      modifiers: createModifiers({ critDamage: 2.0 }),
    });
    const enemy = createEnemy();
    const damage = calculateDamage(10, state, enemy, false);
    expect(damage).toBe(10);
  });

  it('returns floor of final damage', () => {
    const state = createGameState({
      modifiers: createModifiers({ damageMultiplier: 1.5 }),
    });
    const enemy = createEnemy();
    const damage = calculateDamage(7, state, enemy, false);
    // 7 * 1.5 = 10.5, floored to 10
    expect(damage).toBe(10);
  });

  it('combines all modifiers correctly', () => {
    const state = createGameState({
      fortressHp: 20,
      fortressMaxHp: 100,
      wavesCleared: 2,
      modifiers: createModifiers({
        damageMultiplier: 1.5,
        waveDamageBonus: 0.1,
        eliteDamageMultiplier: 1.5,
        lowHpThreshold: 0.3,
        lowHpDamageMultiplier: 1.5,
        critDamage: 2.0,
      }),
    });
    const enemy = createEnemy({ isElite: true });
    // Base: 10
    // * damageMultiplier: 10 * 1.5 = 15
    // * waveDamageBonus: 15 * (1 + 0.1 * 2) = 15 * 1.2 = 18
    // * eliteDamage: 18 * 1.5 = 27
    // * lowHpDamage: 27 * 1.5 = 40.5
    // * critDamage: 40.5 * 2 = 81
    const damage = calculateDamage(10, state, enemy, true);
    expect(damage).toBe(81);
  });
});

describe('shouldCrit', () => {
  it('returns true when rngValue < effective chance', () => {
    expect(shouldCrit(0.5, 1.0, 0.3)).toBe(true);
    expect(shouldCrit(0.5, 1.0, 0.49)).toBe(true);
  });

  it('returns false when rngValue >= effective chance', () => {
    expect(shouldCrit(0.5, 1.0, 0.5)).toBe(false);
    expect(shouldCrit(0.5, 1.0, 0.7)).toBe(false);
  });

  it('respects luck multiplier', () => {
    // 0.3 * 1.5 = 0.45 effective chance
    expect(shouldCrit(0.3, 1.5, 0.4)).toBe(true);
    expect(shouldCrit(0.3, 1.5, 0.5)).toBe(false);
  });

  it('caps effective chance at 1.0', () => {
    // 0.8 * 2.0 = 1.6, capped at 1.0
    expect(shouldCrit(0.8, 2.0, 0.99)).toBe(true);
  });

  it('returns false when critChance is 0', () => {
    expect(shouldCrit(0, 1.0, 0.0)).toBe(false);
    expect(shouldCrit(0, 1.0, 0.001)).toBe(false);
  });

  it('always crits when chance is 1.0', () => {
    expect(shouldCrit(1.0, 1.0, 0.0)).toBe(true);
    expect(shouldCrit(1.0, 1.0, 0.99)).toBe(true);
  });
});

describe('shouldChain', () => {
  it('returns true when rngValue < effective chance', () => {
    expect(shouldChain(0.5, 1.0, 0.3)).toBe(true);
    expect(shouldChain(0.5, 1.0, 0.49)).toBe(true);
  });

  it('returns false when rngValue >= effective chance', () => {
    expect(shouldChain(0.5, 1.0, 0.5)).toBe(false);
    expect(shouldChain(0.5, 1.0, 0.7)).toBe(false);
  });

  it('respects luck multiplier', () => {
    // 0.3 * 1.5 = 0.45 effective chance
    expect(shouldChain(0.3, 1.5, 0.4)).toBe(true);
    expect(shouldChain(0.3, 1.5, 0.5)).toBe(false);
  });

  it('caps effective chance at 1.0', () => {
    // 0.8 * 2.0 = 1.6, capped at 1.0
    expect(shouldChain(0.8, 2.0, 0.99)).toBe(true);
  });

  it('returns false when chainChance is 0', () => {
    expect(shouldChain(0, 1.0, 0.0)).toBe(false);
  });

  it('always chains when chance is 1.0', () => {
    expect(shouldChain(1.0, 1.0, 0.99)).toBe(true);
  });
});
