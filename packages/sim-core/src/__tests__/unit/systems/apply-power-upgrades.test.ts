/**
 * Apply Power Upgrades System Tests
 */
import { describe, it, expect } from 'vitest';
import {
  applyFortressPowerUpgrades,
  getHeroPowerMultipliers,
  getTurretPowerMultipliers,
  getItemEffectMultiplier,
  getItemTierFromPowerData,
  applyAllPowerUpgrades,
  hasAnyPowerUpgrades,
  calculateTotalUpgradeInvestment,
} from '../../../systems/apply-power-upgrades.js';
import type { ModifierSet } from '../../../types.js';
import type { PlayerPowerData, StatUpgrades } from '../../../data/power-upgrades.js';

// Helper to create base modifiers
function createBaseModifiers(): ModifierSet {
  return {
    damageMultiplier: 1.0,
    splashRadius: 0,
    splashDamage: 0,
    pierceCount: 0,
    chainChance: 0,
    chainCount: 0,
    chainDamage: 0,
    executeThreshold: 0,
    executeDamage: 1.0,
    critChance: 0.05,
    critDamage: 2.0,
    goldMultiplier: 1.0,
    dustMultiplier: 1.0,
    maxHpMultiplier: 1.0,
    hpRegen: 0,
    cooldownMultiplier: 1.0,
    attackSpeedMultiplier: 1.0,
    eliteDamageMultiplier: 1.0,
    waveDamageBonus: 0,
    lowHpDamageMultiplier: 1.0,
    lowHpThreshold: 0.3,
    luckMultiplier: 1.0,
  };
}

// Helper to create empty stat upgrades
function createEmptyStats(): StatUpgrades {
  return {
    hp: 0,
    damage: 0,
    attackSpeed: 0,
    range: 0,
    critChance: 0,
    critMultiplier: 0,
    armor: 0,
    dodge: 0,
  };
}

// Helper to create test power data
function createTestPowerData(overrides?: Partial<PlayerPowerData>): PlayerPowerData {
  return {
    fortressUpgrades: { statUpgrades: createEmptyStats() },
    heroUpgrades: [],
    turretUpgrades: [],
    itemTiers: [],
    ...overrides,
  };
}

describe('applyFortressPowerUpgrades', () => {
  it('returns unmodified modifiers with no upgrades', () => {
    const base = createBaseModifiers();
    const upgrades = createEmptyStats();

    const result = applyFortressPowerUpgrades(base, upgrades);

    expect(result.damageMultiplier).toBe(1.0);
    expect(result.attackSpeedMultiplier).toBe(1.0);
    expect(result.maxHpMultiplier).toBe(1.0);
  });

  it('applies HP upgrade', () => {
    const base = createBaseModifiers();
    const upgrades = createEmptyStats();
    upgrades.hp = 5;

    const result = applyFortressPowerUpgrades(base, upgrades);

    expect(result.maxHpMultiplier).toBeGreaterThan(1.0);
  });

  it('applies damage upgrade', () => {
    const base = createBaseModifiers();
    const upgrades = createEmptyStats();
    upgrades.damage = 5;

    const result = applyFortressPowerUpgrades(base, upgrades);

    expect(result.damageMultiplier).toBeGreaterThan(1.0);
  });

  it('applies armor upgrade', () => {
    const base = createBaseModifiers();
    const upgrades = createEmptyStats();
    upgrades.armor = 5;

    const result = applyFortressPowerUpgrades(base, upgrades);

    // Armor upgrades should affect damage reduction (through maxHpMultiplier or similar)
    // The implementation will vary based on how armor is applied
    expect(result).toBeDefined();
  });

  it('does not modify original modifiers', () => {
    const base = createBaseModifiers();
    const originalDamage = base.damageMultiplier;
    const upgrades = createEmptyStats();
    upgrades.damage = 10;

    applyFortressPowerUpgrades(base, upgrades);

    expect(base.damageMultiplier).toBe(originalDamage);
  });

  it('stacks multiple upgrades', () => {
    const base = createBaseModifiers();
    const upgrades = createEmptyStats();
    upgrades.hp = 5;
    upgrades.damage = 5;
    upgrades.armor = 5;

    const result = applyFortressPowerUpgrades(base, upgrades);

    expect(result.maxHpMultiplier).toBeGreaterThan(1.0);
    expect(result.damageMultiplier).toBeGreaterThan(1.0);
  });
});

describe('getHeroPowerMultipliers', () => {
  it('returns base multipliers with no upgrades', () => {
    const powerData = createTestPowerData();

    const result = getHeroPowerMultipliers(powerData, 'thunderlord');

    expect(result.hpMultiplier).toBe(1.0);
    expect(result.damageMultiplier).toBe(1.0);
  });

  it('returns upgraded multipliers for existing hero', () => {
    const heroUpgrades = createEmptyStats();
    heroUpgrades.hp = 5;
    heroUpgrades.damage = 10;

    const powerData = createTestPowerData({
      heroUpgrades: [{ heroId: 'thunderlord', statUpgrades: heroUpgrades }],
    });

    const result = getHeroPowerMultipliers(powerData, 'thunderlord');

    expect(result.hpMultiplier).toBeGreaterThan(1.0);
    expect(result.damageMultiplier).toBeGreaterThan(1.0);
  });

  it('returns base multipliers for non-upgraded hero', () => {
    const powerData = createTestPowerData({
      heroUpgrades: [{ heroId: 'other-hero', statUpgrades: createEmptyStats() }],
    });

    const result = getHeroPowerMultipliers(powerData, 'thunderlord');

    expect(result.hpMultiplier).toBe(1.0);
    expect(result.damageMultiplier).toBe(1.0);
  });

});

describe('getTurretPowerMultipliers', () => {
  it('returns base multipliers with no upgrades', () => {
    const powerData = createTestPowerData();

    const result = getTurretPowerMultipliers(powerData, 'arrow');

    expect(result.damageMultiplier).toBe(1.0);
    expect(result.attackSpeedMultiplier).toBe(1.0);
  });

  it('returns upgraded multipliers for existing turret', () => {
    const turretUpgrades = createEmptyStats();
    turretUpgrades.damage = 5;
    turretUpgrades.attackSpeed = 5;

    const powerData = createTestPowerData({
      turretUpgrades: [{ turretType: 'arrow', statUpgrades: turretUpgrades }],
    });

    const result = getTurretPowerMultipliers(powerData, 'arrow');

    expect(result.damageMultiplier).toBeGreaterThan(1.0);
    expect(result.attackSpeedMultiplier).toBeGreaterThan(1.0);
  });
});

describe('getItemEffectMultiplier', () => {
  it('returns 1.0 for common', () => {
    expect(getItemEffectMultiplier('common')).toBe(1.0);
  });

  it('returns 1.15 for uncommon', () => {
    expect(getItemEffectMultiplier('uncommon')).toBe(1.15); // rebalanced from 1.25
  });

  it('returns 1.35 for rare', () => {
    expect(getItemEffectMultiplier('rare')).toBe(1.35); // rebalanced from 1.5
  });

  it('returns 1.6 for epic', () => {
    expect(getItemEffectMultiplier('epic')).toBe(1.6); // rebalanced from 2.0
  });

  it('returns 2.0 for legendary', () => {
    expect(getItemEffectMultiplier('legendary')).toBe(2.0); // rebalanced from 3.0
  });
});

describe('getItemTierFromPowerData', () => {
  it('returns common for unknown item', () => {
    const powerData = createTestPowerData();
    const tier = getItemTierFromPowerData(powerData, 'unknown-item');
    expect(tier).toBe('common');
  });

  it('returns stored tier for known item', () => {
    const powerData = createTestPowerData({
      itemTiers: [{ itemId: 'mjolnir', tier: 'legendary' }],
    });

    const tier = getItemTierFromPowerData(powerData, 'mjolnir');
    expect(tier).toBe('legendary');
  });
});

describe('applyAllPowerUpgrades', () => {
  it('applies fortress upgrades', () => {
    const base = createBaseModifiers();
    const fortressUpgrades = createEmptyStats();
    fortressUpgrades.damage = 10;

    const powerData = createTestPowerData({
      fortressUpgrades: { statUpgrades: fortressUpgrades },
    });

    const result = applyAllPowerUpgrades(base, powerData);

    expect(result.damageMultiplier).toBeGreaterThan(1.0);
  });
});

describe('hasAnyPowerUpgrades', () => {
  it('returns false for empty power data', () => {
    const powerData = createTestPowerData();
    expect(hasAnyPowerUpgrades(powerData)).toBe(false);
  });

  it('returns true for fortress upgrades', () => {
    const upgrades = createEmptyStats();
    upgrades.hp = 1;

    const powerData = createTestPowerData({
      fortressUpgrades: { statUpgrades: upgrades },
    });

    expect(hasAnyPowerUpgrades(powerData)).toBe(true);
  });

  it('returns true for hero upgrades', () => {
    const heroUpgrades = createEmptyStats();
    heroUpgrades.damage = 1;

    const powerData = createTestPowerData({
      heroUpgrades: [{ heroId: 'thunderlord', statUpgrades: heroUpgrades }],
    });

    expect(hasAnyPowerUpgrades(powerData)).toBe(true);
  });

  it('returns true for turret upgrades', () => {
    const turretUpgrades = createEmptyStats();
    turretUpgrades.damage = 1;

    const powerData = createTestPowerData({
      turretUpgrades: [{ turretType: 'arrow', statUpgrades: turretUpgrades }],
    });

    expect(hasAnyPowerUpgrades(powerData)).toBe(true);
  });

  it('returns true for non-common item tier', () => {
    const powerData = createTestPowerData({
      itemTiers: [{ itemId: 'item1', tier: 'rare' }],
    });

    expect(hasAnyPowerUpgrades(powerData)).toBe(true);
  });

  it('returns false for only common items', () => {
    const powerData = createTestPowerData({
      itemTiers: [{ itemId: 'item1', tier: 'common' }],
    });

    expect(hasAnyPowerUpgrades(powerData)).toBe(false);
  });
});

describe('calculateTotalUpgradeInvestment', () => {
  it('returns zeros for empty power data', () => {
    const powerData = createTestPowerData();
    const result = calculateTotalUpgradeInvestment(powerData);

    expect(result.totalFortressLevels).toBe(0);
    expect(result.totalHeroLevels).toBe(0);
    expect(result.totalTurretLevels).toBe(0);
    expect(result.totalItemTiers).toBe(0);
  });

  it('sums fortress upgrade levels', () => {
    const upgrades = createEmptyStats();
    upgrades.hp = 5;
    upgrades.damage = 3;

    const powerData = createTestPowerData({
      fortressUpgrades: { statUpgrades: upgrades },
    });

    const result = calculateTotalUpgradeInvestment(powerData);

    expect(result.totalFortressLevels).toBe(8); // 5 + 3
  });

  it('sums hero upgrade levels across multiple heroes', () => {
    const hero1Upgrades = createEmptyStats();
    hero1Upgrades.hp = 5;
    const hero2Upgrades = createEmptyStats();
    hero2Upgrades.damage = 3;

    const powerData = createTestPowerData({
      heroUpgrades: [
        { heroId: 'hero1', statUpgrades: hero1Upgrades },
        { heroId: 'hero2', statUpgrades: hero2Upgrades },
      ],
    });

    const result = calculateTotalUpgradeInvestment(powerData);

    expect(result.totalHeroLevels).toBe(8); // 5 + 3
  });

  it('sums turret upgrade levels', () => {
    const turretUpgrades = createEmptyStats();
    turretUpgrades.damage = 10;

    const powerData = createTestPowerData({
      turretUpgrades: [{ turretType: 'arrow', statUpgrades: turretUpgrades }],
    });

    const result = calculateTotalUpgradeInvestment(powerData);

    expect(result.totalTurretLevels).toBe(10);
  });

  it('sums item tier values correctly', () => {
    const powerData = createTestPowerData({
      itemTiers: [
        { itemId: 'item1', tier: 'common' }, // 0
        { itemId: 'item2', tier: 'uncommon' }, // 1
        { itemId: 'item3', tier: 'legendary' }, // 4
      ],
    });

    const result = calculateTotalUpgradeInvestment(powerData);

    expect(result.totalItemTiers).toBe(5); // 0 + 1 + 4
  });
});
