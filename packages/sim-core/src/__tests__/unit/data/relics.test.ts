import { describe, it, expect } from 'vitest';
import {
  RELICS,
  DEFAULT_MODIFIERS,
  getRelicById,
  getAllRelicIds,
  getAvailableRelics,
  getRelicsByCategory,
  getRelicsByRarity,
  getBuildDefiningRelics,
  getCursedRelics,
  detectBuildType,
} from '../../../data/relics.js';

describe('RELICS data', () => {
  it('all relics have unique IDs', () => {
    const ids = RELICS.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all relics have required fields', () => {
    for (const relic of RELICS) {
      expect(relic.id).toBeDefined();
      expect(typeof relic.id).toBe('string');
      expect(relic.id.length).toBeGreaterThan(0);

      expect(relic.name).toBeDefined();
      expect(typeof relic.name).toBe('string');
      expect(relic.name.length).toBeGreaterThan(0);

      expect(relic.description).toBeDefined();
      expect(typeof relic.description).toBe('string');

      expect(relic.modifiers).toBeDefined();
      expect(typeof relic.modifiers).toBe('object');

      expect(typeof relic.isBuildDefining).toBe('boolean');
      expect(relic.category).toBeDefined();
      expect(relic.rarity).toBeDefined();
      expect(Array.isArray(relic.synergies)).toBe(true);
    }
  });

  it('has 25 total relics', () => {
    expect(RELICS.length).toBe(25);
  });

  it('has correct number of relics per category', () => {
    expect(getRelicsByCategory('build_defining').length).toBe(4);
    expect(getRelicsByCategory('standard').length).toBe(5);
    expect(getRelicsByCategory('class').length).toBe(5);
    expect(getRelicsByCategory('pillar').length).toBe(3);
    expect(getRelicsByCategory('synergy').length).toBe(2);
    expect(getRelicsByCategory('economy').length).toBe(3);
    expect(getRelicsByCategory('cursed').length).toBe(3);
  });

  it('relic modifiers contain valid keys', () => {
    const validKeys = Object.keys(DEFAULT_MODIFIERS);

    for (const relic of RELICS) {
      const modifierKeys = Object.keys(relic.modifiers);
      for (const key of modifierKeys) {
        expect(validKeys).toContain(key);
      }
    }
  });

  it('relic modifiers have valid values', () => {
    for (const relic of RELICS) {
      for (const [_key, value] of Object.entries(relic.modifiers)) {
        expect(typeof value).toBe('number');
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

describe('DEFAULT_MODIFIERS', () => {
  it('has all modifier keys', () => {
    expect(DEFAULT_MODIFIERS.damageMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.splashRadius).toBeDefined();
    expect(DEFAULT_MODIFIERS.splashDamage).toBeDefined();
    expect(DEFAULT_MODIFIERS.pierceCount).toBeDefined();
    expect(DEFAULT_MODIFIERS.chainChance).toBeDefined();
    expect(DEFAULT_MODIFIERS.chainCount).toBeDefined();
    expect(DEFAULT_MODIFIERS.chainDamage).toBeDefined();
    expect(DEFAULT_MODIFIERS.executeThreshold).toBeDefined();
    expect(DEFAULT_MODIFIERS.executeDamage).toBeDefined();
    expect(DEFAULT_MODIFIERS.critChance).toBeDefined();
    expect(DEFAULT_MODIFIERS.critDamage).toBeDefined();
    expect(DEFAULT_MODIFIERS.goldMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.dustMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.maxHpMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.hpRegen).toBeDefined();
    expect(DEFAULT_MODIFIERS.cooldownMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.attackSpeedMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.eliteDamageMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.waveDamageBonus).toBeDefined();
    expect(DEFAULT_MODIFIERS.lowHpDamageMultiplier).toBeDefined();
    expect(DEFAULT_MODIFIERS.lowHpThreshold).toBeDefined();
    expect(DEFAULT_MODIFIERS.luckMultiplier).toBeDefined();
  });

  it('has neutral values for multipliers', () => {
    expect(DEFAULT_MODIFIERS.damageMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.goldMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.dustMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.maxHpMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.cooldownMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.attackSpeedMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.eliteDamageMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.lowHpDamageMultiplier).toBe(1.0);
    expect(DEFAULT_MODIFIERS.luckMultiplier).toBe(1.0);
  });

  it('has zero for additive bonuses', () => {
    expect(DEFAULT_MODIFIERS.splashRadius).toBe(0);
    expect(DEFAULT_MODIFIERS.splashDamage).toBe(0);
    expect(DEFAULT_MODIFIERS.pierceCount).toBe(0);
    expect(DEFAULT_MODIFIERS.chainChance).toBe(0);
    expect(DEFAULT_MODIFIERS.chainCount).toBe(0);
    expect(DEFAULT_MODIFIERS.chainDamage).toBe(0);
    expect(DEFAULT_MODIFIERS.executeThreshold).toBe(0);
    expect(DEFAULT_MODIFIERS.critChance).toBe(0);
    expect(DEFAULT_MODIFIERS.hpRegen).toBe(0);
    expect(DEFAULT_MODIFIERS.waveDamageBonus).toBe(0);
  });

  it('has sensible default values for special modifiers', () => {
    expect(DEFAULT_MODIFIERS.executeDamage).toBe(1.0);
    expect(DEFAULT_MODIFIERS.critDamage).toBe(1.5);
    expect(DEFAULT_MODIFIERS.lowHpThreshold).toBe(0.3);
  });
});

describe('getRelicById', () => {
  it('returns relic for valid ID', () => {
    const relic = getRelicById('splash-master');
    expect(relic).toBeDefined();
    expect(relic?.id).toBe('splash-master');
    expect(relic?.name).toBe('Splash Master');
  });

  it('returns undefined for invalid ID', () => {
    const relic = getRelicById('nonexistent-relic');
    expect(relic).toBeUndefined();
  });

  it('returns correct relic data', () => {
    const splashMaster = getRelicById('splash-master');
    expect(splashMaster).toBeDefined();
    expect(splashMaster?.isBuildDefining).toBe(true);
    expect(splashMaster?.modifiers.splashDamage).toBe(0.35);

    const ironHide = getRelicById('iron-hide');
    expect(ironHide).toBeDefined();
    expect(ironHide?.isBuildDefining).toBe(false);
    expect(ironHide?.modifiers.maxHpMultiplier).toBe(1.25);
  });

  it('handles empty string', () => {
    const relic = getRelicById('');
    expect(relic).toBeUndefined();
  });
});

describe('getAllRelicIds', () => {
  it('returns array of all relic IDs', () => {
    const ids = getAllRelicIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBe(RELICS.length);
  });

  it('matches RELICS array length', () => {
    const ids = getAllRelicIds();
    expect(ids.length).toBe(RELICS.length);
  });

  it('contains all expected IDs', () => {
    const ids = getAllRelicIds();
    expect(ids).toContain('splash-master');
    expect(ids).toContain('chain-lightning');
    expect(ids).toContain('gold-rush');
    expect(ids).toContain('iron-hide');
  });

  it('returns strings only', () => {
    const ids = getAllRelicIds();
    for (const id of ids) {
      expect(typeof id).toBe('string');
    }
  });
});

describe('getAvailableRelics', () => {
  it('returns universally available relics when no filters', () => {
    const available = getAvailableRelics();
    // When no filters specified, returns only relics without class/pillar requirements
    expect(available.length).toBeGreaterThan(0);
    // All returned relics should have no class requirement
    for (const relic of available) {
      expect(relic.requirements?.fortressClass).toBeUndefined();
      expect(relic.requirements?.pillarId).toBeUndefined();
    }
  });

  it('filters by fortress class', () => {
    const natural = getAvailableRelics('natural');
    // Should include general relics + natural-specific
    expect(natural.length).toBeGreaterThan(0);
    // Should not include other class-specific relics
    const hasIceOnly = natural.some(r => r.requirements?.fortressClass === 'ice');
    expect(hasIceOnly).toBe(false);
  });

  it('filters by pillar', () => {
    const cosmos = getAvailableRelics(undefined, 'cosmos');
    expect(cosmos.length).toBeGreaterThan(0);
    // Should not include other pillar-specific relics
    const hasScienceOnly = cosmos.some(r => r.requirements?.pillarId === 'science');
    expect(hasScienceOnly).toBe(false);
  });

  it('returns full relic objects', () => {
    const available = getAvailableRelics();
    expect(available[0].id).toBeDefined();
    expect(available[0].name).toBeDefined();
    expect(available[0].description).toBeDefined();
    expect(available[0].modifiers).toBeDefined();
  });
});

describe('getRelicsByRarity', () => {
  it('filters by common rarity', () => {
    const common = getRelicsByRarity('common');
    expect(common.length).toBeGreaterThan(0);
    for (const relic of common) {
      expect(relic.rarity).toBe('common');
    }
  });

  it('filters by legendary rarity', () => {
    const legendary = getRelicsByRarity('legendary');
    expect(legendary.length).toBeGreaterThan(0);
    for (const relic of legendary) {
      expect(relic.rarity).toBe('legendary');
    }
  });
});

describe('getBuildDefiningRelics', () => {
  it('returns only build-defining relics', () => {
    const buildDefining = getBuildDefiningRelics();
    expect(buildDefining.length).toBeGreaterThan(0);
    for (const relic of buildDefining) {
      expect(relic.isBuildDefining).toBe(true);
    }
  });
});

describe('getCursedRelics', () => {
  it('returns only cursed relics', () => {
    const cursed = getCursedRelics();
    expect(cursed.length).toBe(3);
    for (const relic of cursed) {
      expect(relic.category).toBe('cursed');
      expect(relic.curse).toBeDefined();
    }
  });
});

describe('detectBuildType', () => {
  it('detects splash build', () => {
    expect(detectBuildType(['splash-master'])).toBe('splash');
  });

  it('detects chain build', () => {
    expect(detectBuildType(['chain-lightning'])).toBe('chain');
  });

  it('detects execute build', () => {
    expect(detectBuildType(['executioner'])).toBe('execute');
  });

  it('detects crit build', () => {
    expect(detectBuildType(['critical-eye'])).toBe('crit');
  });

  it('detects tank build', () => {
    expect(detectBuildType(['iron-hide'])).toBe('tank');
  });

  it('detects economy build', () => {
    expect(detectBuildType(['gold-rush'])).toBe('economy');
    expect(detectBuildType(['dust-collector'])).toBe('economy');
  });

  it('returns balanced for no defining relics', () => {
    expect(detectBuildType([])).toBe('balanced');
    expect(detectBuildType(['swift-strikes'])).toBe('balanced');
  });
});
