/**
 * Pillars (Filary) System - Comprehensive Tests
 *
 * Tests for the 6 thematic chapters:
 * 1. Streets (Ulice) - Gangsters, street-level villains
 * 2. Science (Nauka i Technologia) - Robots, AI, drones
 * 3. Mutants (Mutanci) - Sentinels, mutant hunters
 * 4. Cosmos (Kosmos) - Skrulls, Kree, cosmic beings
 * 5. Magic (Magia) - Demons, dimensional beings
 * 6. Gods (Bogowie) - Einherjar, titans, gods
 */
import { describe, it, expect } from 'vitest';
import {
  PILLAR_DEFINITIONS,
  getPillarById,
  getPillarForWave,
  isPillarUnlocked,
  getPillarClassModifier,
  calculatePillarDamageMultiplier,
  getNaturalHeroesForPillar,
  isHeroNaturalForPillar,
  getUnlockedPillars,
  getNextPillarToUnlock,
  getEndlessCycle,
  getEffectiveWaveInCycle,
  NATURAL_HERO_PILLAR_BONUS,
} from '../../../data/pillars.js';
import type { PillarId, FortressClass } from '../../../types.js';

// ============================================================================
// TEST 1: PILLAR DEFINITIONS - DATA INTEGRITY
// ============================================================================

describe('Pillar Definitions - Data Integrity', () => {
  it('should have exactly 6 pillars', () => {
    expect(PILLAR_DEFINITIONS).toHaveLength(6);
  });

  it('should have all expected pillar IDs in correct order', () => {
    const pillarIds = PILLAR_DEFINITIONS.map(p => p.id);
    expect(pillarIds).toEqual(['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods']);
  });

  it('each pillar should have a unique ID', () => {
    const ids = PILLAR_DEFINITIONS.map(p => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it.each(PILLAR_DEFINITIONS)('pillar "$id" should have all required fields', (pillar) => {
    // Basic info
    expect(pillar.id).toBeDefined();
    expect(pillar.name).toBeDefined();
    expect(pillar.subtitle).toBeDefined();
    expect(pillar.description).toBeDefined();
    expect(pillar.description.length).toBeGreaterThan(10);

    // Wave range
    expect(pillar.waveRange).toBeDefined();
    expect(pillar.waveRange.start).toBeGreaterThan(0);
    expect(pillar.waveRange.end).toBeGreaterThanOrEqual(pillar.waveRange.start);

    // Unlock requirement
    expect(pillar.unlockRequirement).toBeDefined();
    expect(pillar.unlockRequirement.fortressLevel).toBeGreaterThanOrEqual(1);

    // Scenery
    expect(pillar.scenery).toBeDefined();
    expect(pillar.scenery.background).toBeDefined();
    expect(pillar.scenery.ambiance).toBeDefined();
    expect(pillar.scenery.colors).toBeDefined();
    expect(pillar.scenery.colors.primary).toBeDefined();
    expect(pillar.scenery.colors.secondary).toBeDefined();
    expect(pillar.scenery.colors.accent).toBeDefined();

    // Class modifiers
    expect(pillar.classModifiers).toBeDefined();
    expect(pillar.classModifiers.length).toBe(5); // All 5 fortress classes

    // Enemies
    expect(pillar.enemies).toBeDefined();
    expect(pillar.enemies.length).toBeGreaterThanOrEqual(3);

    // Bosses
    expect(pillar.bosses).toBeDefined();
    expect(pillar.bosses.length).toBeGreaterThanOrEqual(1);

    // Natural heroes
    expect(pillar.naturalHeroes).toBeDefined();
    expect(pillar.naturalHeroes.length).toBeGreaterThanOrEqual(1);

    // Rewards
    expect(pillar.rewards).toBeDefined();
    expect(pillar.rewards.firstCompletion).toBeDefined();
    expect(pillar.rewards.regularCompletion).toBeDefined();
  });

  it('first pillar (Streets) should be unlocked at level 1', () => {
    const streets = PILLAR_DEFINITIONS[0];
    expect(streets.id).toBe('streets');
    expect(streets.unlockRequirement.fortressLevel).toBe(1);
  });

  it('last pillar (Gods) should require highest fortress level', () => {
    const gods = PILLAR_DEFINITIONS[5];
    expect(gods.id).toBe('gods');
    expect(gods.unlockRequirement.fortressLevel).toBe(50);
  });
});

// ============================================================================
// TEST 2: WAVE RANGES - COMPLETE COVERAGE
// ============================================================================

describe('Wave Ranges - Complete Coverage', () => {
  it('should cover waves 1-100 without gaps', () => {
    const ranges = PILLAR_DEFINITIONS.map(p => p.waveRange);

    // First pillar starts at wave 1
    expect(ranges[0].start).toBe(1);

    // Last pillar ends at wave 100
    expect(ranges[ranges.length - 1].end).toBe(100);

    // Check no gaps between pillars
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i].start).toBe(ranges[i - 1].end + 1);
    }
  });

  it('should have correct wave ranges per pillar', () => {
    expect(getPillarById('streets')?.waveRange).toEqual({ start: 1, end: 10 });
    expect(getPillarById('science')?.waveRange).toEqual({ start: 11, end: 25 });
    expect(getPillarById('mutants')?.waveRange).toEqual({ start: 26, end: 40 });
    expect(getPillarById('cosmos')?.waveRange).toEqual({ start: 41, end: 60 });
    expect(getPillarById('magic')?.waveRange).toEqual({ start: 61, end: 80 });
    expect(getPillarById('gods')?.waveRange).toEqual({ start: 81, end: 100 });
  });

  it('each pillar should have at least 10 waves', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      const waveCount = pillar.waveRange.end - pillar.waveRange.start + 1;
      expect(waveCount).toBeGreaterThanOrEqual(10);
    }
  });
});

// ============================================================================
// TEST 3: getPillarForWave FUNCTION
// ============================================================================

describe('getPillarForWave', () => {
  describe('Streets Pillar (waves 1-10)', () => {
    it.each([1, 5, 10])('wave %i should be in Streets pillar', (wave) => {
      expect(getPillarForWave(wave)?.id).toBe('streets');
    });
  });

  describe('Science Pillar (waves 11-25)', () => {
    it.each([11, 18, 25])('wave %i should be in Science pillar', (wave) => {
      expect(getPillarForWave(wave)?.id).toBe('science');
    });
  });

  describe('Mutants Pillar (waves 26-40)', () => {
    it.each([26, 33, 40])('wave %i should be in Mutants pillar', (wave) => {
      expect(getPillarForWave(wave)?.id).toBe('mutants');
    });
  });

  describe('Cosmos Pillar (waves 41-60)', () => {
    it.each([41, 50, 60])('wave %i should be in Cosmos pillar', (wave) => {
      expect(getPillarForWave(wave)?.id).toBe('cosmos');
    });
  });

  describe('Magic Pillar (waves 61-80)', () => {
    it.each([61, 70, 80])('wave %i should be in Magic pillar', (wave) => {
      expect(getPillarForWave(wave)?.id).toBe('magic');
    });
  });

  describe('Gods Pillar (waves 81-100)', () => {
    it.each([81, 90, 100])('wave %i should be in Gods pillar', (wave) => {
      expect(getPillarForWave(wave)?.id).toBe('gods');
    });
  });

  describe('Edge cases', () => {
    it('wave 0 should return undefined', () => {
      expect(getPillarForWave(0)).toBeUndefined();
    });

    it('wave 101+ cycles back through pillars (Endless mode)', () => {
      // Wave 101 = effective wave 1 (cycle 1) = Streets
      expect(getPillarForWave(101)?.id).toBe('streets');
      // Wave 111 = effective wave 11 (cycle 1) = Science
      expect(getPillarForWave(111)?.id).toBe('science');
      // Wave 200 = effective wave 100 (cycle 1) = Gods
      expect(getPillarForWave(200)?.id).toBe('gods');
      // Wave 201 = effective wave 1 (cycle 2) = Streets
      expect(getPillarForWave(201)?.id).toBe('streets');
    });

    it('negative waves should return undefined', () => {
      expect(getPillarForWave(-1)).toBeUndefined();
    });
  });

  describe('Pillar transitions', () => {
    it('wave 10 -> 11 transitions from Streets to Science', () => {
      expect(getPillarForWave(10)?.id).toBe('streets');
      expect(getPillarForWave(11)?.id).toBe('science');
    });

    it('wave 25 -> 26 transitions from Science to Mutants', () => {
      expect(getPillarForWave(25)?.id).toBe('science');
      expect(getPillarForWave(26)?.id).toBe('mutants');
    });

    it('wave 40 -> 41 transitions from Mutants to Cosmos', () => {
      expect(getPillarForWave(40)?.id).toBe('mutants');
      expect(getPillarForWave(41)?.id).toBe('cosmos');
    });

    it('wave 60 -> 61 transitions from Cosmos to Magic', () => {
      expect(getPillarForWave(60)?.id).toBe('cosmos');
      expect(getPillarForWave(61)?.id).toBe('magic');
    });

    it('wave 80 -> 81 transitions from Magic to Gods', () => {
      expect(getPillarForWave(80)?.id).toBe('magic');
      expect(getPillarForWave(81)?.id).toBe('gods');
    });
  });
});

// ============================================================================
// TEST 4: UNLOCK REQUIREMENTS
// ============================================================================

describe('Unlock Requirements (Pure Endless Mode)', () => {
  describe('isPillarUnlocked', () => {
    it('all pillars are always unlocked (Endless mode)', () => {
      // In Pure Endless mode, all pillars are always available
      const allPillars: PillarId[] = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'];
      for (const pillarId of allPillars) {
        expect(isPillarUnlocked(pillarId, 1)).toBe(true);
        expect(isPillarUnlocked(pillarId, 10)).toBe(true);
        expect(isPillarUnlocked(pillarId, 50)).toBe(true);
      }
    });

    it('fortressLevel parameter is ignored (backward compatibility)', () => {
      // Level parameter doesn't matter in Endless mode
      expect(isPillarUnlocked('gods', 1)).toBe(true);
      expect(isPillarUnlocked('magic', 1)).toBe(true);
      expect(isPillarUnlocked('cosmos', 1)).toBe(true);
    });

    it('returns false for invalid pillar ID', () => {
      expect(isPillarUnlocked('invalid' as PillarId, 50)).toBe(false);
    });
  });

  describe('getUnlockedPillars', () => {
    it('always returns all 6 pillars (Endless mode)', () => {
      // All pillars are always unlocked regardless of level
      const unlocked1 = getUnlockedPillars(1);
      expect(unlocked1).toHaveLength(6);
      expect(unlocked1.map(p => p.id)).toEqual(['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods']);

      const unlocked25 = getUnlockedPillars(25);
      expect(unlocked25).toHaveLength(6);

      const unlocked50 = getUnlockedPillars(50);
      expect(unlocked50).toHaveLength(6);
    });

    it('works without level parameter', () => {
      const unlocked = getUnlockedPillars();
      expect(unlocked).toHaveLength(6);
    });
  });

  describe('getNextPillarToUnlock', () => {
    it('always returns undefined (all pillars already unlocked)', () => {
      // In Endless mode, there's nothing to unlock
      expect(getNextPillarToUnlock(1)).toBeUndefined();
      expect(getNextPillarToUnlock(24)).toBeUndefined();
      expect(getNextPillarToUnlock(25)).toBeUndefined();
      expect(getNextPillarToUnlock(50)).toBeUndefined();
    });
  });
});

// ============================================================================
// TEST 5: ENDLESS MODE HELPERS
// ============================================================================

describe('Endless Mode Helpers', () => {
  describe('getEndlessCycle', () => {
    it('returns 0 for waves 1-100 (cycle 0)', () => {
      expect(getEndlessCycle(1)).toBe(0);
      expect(getEndlessCycle(50)).toBe(0);
      expect(getEndlessCycle(100)).toBe(0);
    });

    it('returns 1 for waves 101-200 (cycle 1)', () => {
      expect(getEndlessCycle(101)).toBe(1);
      expect(getEndlessCycle(150)).toBe(1);
      expect(getEndlessCycle(200)).toBe(1);
    });

    it('returns 2 for waves 201-300 (cycle 2)', () => {
      expect(getEndlessCycle(201)).toBe(2);
      expect(getEndlessCycle(250)).toBe(2);
      expect(getEndlessCycle(300)).toBe(2);
    });

    it('handles high wave counts correctly', () => {
      expect(getEndlessCycle(500)).toBe(4);
      expect(getEndlessCycle(1000)).toBe(9);
    });

    it('returns 0 for invalid waves', () => {
      expect(getEndlessCycle(0)).toBe(0);
      expect(getEndlessCycle(-1)).toBe(0);
    });
  });

  describe('getEffectiveWaveInCycle', () => {
    it('returns correct effective wave for cycle 0 (waves 1-100)', () => {
      expect(getEffectiveWaveInCycle(1)).toBe(1);
      expect(getEffectiveWaveInCycle(50)).toBe(50);
      expect(getEffectiveWaveInCycle(100)).toBe(100);
    });

    it('returns correct effective wave for cycle 1 (waves 101-200)', () => {
      expect(getEffectiveWaveInCycle(101)).toBe(1);
      expect(getEffectiveWaveInCycle(150)).toBe(50);
      expect(getEffectiveWaveInCycle(200)).toBe(100);
    });

    it('returns correct effective wave for cycle 2 (waves 201-300)', () => {
      expect(getEffectiveWaveInCycle(201)).toBe(1);
      expect(getEffectiveWaveInCycle(250)).toBe(50);
      expect(getEffectiveWaveInCycle(300)).toBe(100);
    });

    it('pillar mapping stays consistent across cycles', () => {
      // Wave 1, 101, 201 should all be effective wave 1 (Streets)
      expect(getEffectiveWaveInCycle(1)).toBe(1);
      expect(getEffectiveWaveInCycle(101)).toBe(1);
      expect(getEffectiveWaveInCycle(201)).toBe(1);

      // Wave 81, 181, 281 should all be effective wave 81 (Gods)
      expect(getEffectiveWaveInCycle(81)).toBe(81);
      expect(getEffectiveWaveInCycle(181)).toBe(81);
      expect(getEffectiveWaveInCycle(281)).toBe(81);
    });

    it('returns 0 for invalid waves', () => {
      expect(getEffectiveWaveInCycle(0)).toBe(0);
      expect(getEffectiveWaveInCycle(-1)).toBe(0);
    });
  });

  describe('Cycle and pillar integration', () => {
    it('getPillarForWave uses effective wave correctly', () => {
      // Cycle 0
      expect(getPillarForWave(1)?.id).toBe('streets');  // Effective wave 1
      expect(getPillarForWave(11)?.id).toBe('science'); // Effective wave 11
      expect(getPillarForWave(100)?.id).toBe('gods');   // Effective wave 100

      // Cycle 1
      expect(getPillarForWave(101)?.id).toBe('streets'); // Effective wave 1
      expect(getPillarForWave(111)?.id).toBe('science'); // Effective wave 11
      expect(getPillarForWave(200)?.id).toBe('gods');    // Effective wave 100

      // Cycle 2
      expect(getPillarForWave(201)?.id).toBe('streets'); // Effective wave 1
      expect(getPillarForWave(281)?.id).toBe('gods');    // Effective wave 81
    });
  });
});

// ============================================================================
// TEST 6: CLASS MODIFIERS PER PILLAR
// ============================================================================

describe('Class Modifiers Per Pillar', () => {
  const allClasses: FortressClass[] = ['natural', 'ice', 'fire', 'lightning', 'tech'];
  const FP_ONE = 16384; // Fixed-point 1.0

  it.each(PILLAR_DEFINITIONS)('pillar "$id" should have modifiers for all 5 classes', (pillar) => {
    const classes = pillar.classModifiers.map(m => m.class);
    for (const fortressClass of allClasses) {
      expect(classes).toContain(fortressClass);
    }
  });

  describe('Streets Pillar - Class Effectiveness', () => {
    it('Natural class is strongest (+20%)', () => {
      const modifier = getPillarClassModifier('streets', 'natural');
      expect(modifier?.damageMultiplier).toBe(19661); // 1.2 in FP
    });

    it('Tech class is strong (+15%)', () => {
      const modifier = getPillarClassModifier('streets', 'tech');
      expect(modifier?.damageMultiplier).toBe(18842); // 1.15 in FP
    });

    it('Fire class is weak (-10%)', () => {
      const modifier = getPillarClassModifier('streets', 'fire');
      expect(modifier?.damageMultiplier).toBe(14746); // 0.9 in FP
    });
  });

  describe('Science Pillar - Tech Dominance', () => {
    it('Tech class is strongest (+25%)', () => {
      const modifier = getPillarClassModifier('science', 'tech');
      expect(modifier?.damageMultiplier).toBe(20480); // 1.25 in FP
    });

    it('Lightning is effective (+15%)', () => {
      const modifier = getPillarClassModifier('science', 'lightning');
      expect(modifier?.damageMultiplier).toBe(18842);
    });

    it('Natural is weakest (-15%)', () => {
      const modifier = getPillarClassModifier('science', 'natural');
      expect(modifier?.damageMultiplier).toBe(13926);
    });
  });

  describe('Mutants Pillar - Sentinel Resistance', () => {
    it('Natural is strongest (+20%)', () => {
      expect(getPillarClassModifier('mutants', 'natural')?.damageMultiplier).toBe(19661);
    });

    it('Fire is effective (+10%)', () => {
      expect(getPillarClassModifier('mutants', 'fire')?.damageMultiplier).toBe(18022);
    });

    it('Tech is weak due to Sentinel adaptation (-10%)', () => {
      expect(getPillarClassModifier('mutants', 'tech')?.damageMultiplier).toBe(14746);
    });
  });

  describe('Cosmos Pillar - Space Combat', () => {
    it('Tech class is strongest (+20%)', () => {
      expect(getPillarClassModifier('cosmos', 'tech')?.damageMultiplier).toBe(19661);
    });

    it('Natural is weak (-20% cap)', () => {
      // Capped at -20% (was -25%)
      expect(getPillarClassModifier('cosmos', 'natural')?.damageMultiplier).toBe(13107);
    });
  });

  describe('Magic Pillar - Mystic Realm', () => {
    it('Fire class is strongest (+30%)', () => {
      expect(getPillarClassModifier('magic', 'fire')?.damageMultiplier).toBe(21299);
    });

    it('Tech is weak (-20% cap)', () => {
      // Capped at -20% (was -30%)
      expect(getPillarClassModifier('magic', 'tech')?.damageMultiplier).toBe(13107);
    });
  });

  describe('Gods Pillar - Divine Combat', () => {
    it('Lightning is strongest (+25%)', () => {
      expect(getPillarClassModifier('gods', 'lightning')?.damageMultiplier).toBe(20480);
    });

    it('Tech is weak (-20% cap)', () => {
      // Capped at -20% (was -40%)
      expect(getPillarClassModifier('gods', 'tech')?.damageMultiplier).toBe(13107);
    });
  });

  describe('calculatePillarDamageMultiplier', () => {
    it('returns default 1.0 (16384) for unknown pillar', () => {
      expect(calculatePillarDamageMultiplier('invalid' as PillarId, 'natural')).toBe(FP_ONE);
    });

    it('returns correct multiplier for valid pillar/class', () => {
      expect(calculatePillarDamageMultiplier('streets', 'natural')).toBe(19661);
    });

    it('multipliers should be between 0.5x and 1.5x', () => {
      for (const pillar of PILLAR_DEFINITIONS) {
        for (const modifier of pillar.classModifiers) {
          const ratio = modifier.damageMultiplier / FP_ONE;
          expect(ratio).toBeGreaterThanOrEqual(0.5);
          expect(ratio).toBeLessThanOrEqual(1.5);
        }
      }
    });
  });
});

// ============================================================================
// TEST 6: PILLAR-SPECIFIC ENEMIES
// ============================================================================

describe('Pillar-Specific Enemies', () => {
  describe('Streets Pillar Enemies', () => {
    const streets = getPillarById('streets')!;

    it('should have street-level enemy types', () => {
      const types = streets.enemies.map(e => e.type);
      expect(types).toContain('thug');
      expect(types).toContain('gunner');
      expect(types).toContain('gang_leader');
      expect(types).toContain('ninja');
    });

    it('enemies should have thematic descriptions', () => {
      const ninja = streets.enemies.find(e => e.type === 'ninja');
      expect(ninja?.name).toBe('Ninja Hand');
      expect(ninja?.description.toLowerCase()).toContain('zwinny');
    });
  });

  describe('Science Pillar Enemies', () => {
    const science = getPillarById('science')!;

    it('should have tech enemy types', () => {
      const types = science.enemies.map(e => e.type);
      expect(types).toContain('drone');
      expect(types).toContain('robot');
      expect(types).toContain('ai_unit');
    });
  });

  describe('Mutants Pillar - Sentinels', () => {
    const mutants = getPillarById('mutants')!;

    it('should include Sentinels as enemy type', () => {
      const types = mutants.enemies.map(e => e.type);
      expect(types).toContain('sentinel');
    });

    it('Sentinel should have description about hunting mutants', () => {
      const sentinel = mutants.enemies.find(e => e.type === 'sentinel');
      expect(sentinel?.name).toBe('Sentinel');
      expect(sentinel?.description).toContain('mutant');
    });

    it('should have Prime Sentinel variant', () => {
      const types = mutants.enemies.map(e => e.type);
      expect(types).toContain('prime_sentinel');
    });
  });

  describe('Cosmos Pillar - Alien Races', () => {
    const cosmos = getPillarById('cosmos')!;

    it('should include Skrulls', () => {
      const skrull = cosmos.enemies.find(e => e.type === 'skrull');
      expect(skrull).toBeDefined();
      expect(skrull?.name).toBe('Skrull');
      expect(skrull?.description.toLowerCase()).toContain('zmiennokształtny');
    });

    it('should include Kree soldiers', () => {
      const kree = cosmos.enemies.find(e => e.type === 'kree_soldier');
      expect(kree).toBeDefined();
      expect(kree?.description).toContain('imperium');
    });

    it('should include Chitauri', () => {
      const types = cosmos.enemies.map(e => e.type);
      expect(types).toContain('chitauri');
    });
  });

  describe('Magic Pillar - Demons and Dimensional Beings', () => {
    const magic = getPillarById('magic')!;

    it('should include demons', () => {
      const demon = magic.enemies.find(e => e.type === 'demon');
      expect(demon).toBeDefined();
      expect(demon?.description).toContain('Dark Dimension');
    });

    it('should include Mindless Ones', () => {
      const types = magic.enemies.map(e => e.type);
      expect(types).toContain('mindless_one');
    });

    it('should include dimensional beings', () => {
      const dimensional = magic.enemies.find(e => e.type === 'dimensional_being');
      expect(dimensional).toBeDefined();
    });
  });

  describe('Gods Pillar - Norse Mythology', () => {
    const gods = getPillarById('gods')!;

    it('should include Einherjar (Valhalla warriors)', () => {
      const einherjar = gods.enemies.find(e => e.type === 'einherjar');
      expect(einherjar).toBeDefined();
      expect(einherjar?.description).toContain('Valhall');
    });

    it('should include Dark Elves', () => {
      const darkElf = gods.enemies.find(e => e.type === 'dark_elf');
      expect(darkElf).toBeDefined();
      expect(darkElf?.description).toContain('Svartalfheim');
    });

    it('should include Fire Demons and Frost Giants', () => {
      const types = gods.enemies.map(e => e.type);
      expect(types).toContain('fire_demon');
      expect(types).toContain('frost_giant');
    });
  });

  it('each pillar should have at least 4 enemy types', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      expect(pillar.enemies.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('all enemies should have type, name, and description', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      for (const enemy of pillar.enemies) {
        expect(enemy.type).toBeDefined();
        expect(enemy.type.length).toBeGreaterThan(0);
        expect(enemy.name).toBeDefined();
        expect(enemy.description).toBeDefined();
      }
    }
  });
});

// ============================================================================
// TEST 7: BOSSES CONFIGURATION
// ============================================================================

describe('Bosses Configuration', () => {
  describe('Streets Pillar Bosses', () => {
    const streets = getPillarById('streets')!;

    it('should have Kingpin as boss', () => {
      const kingpin = streets.bosses.find(b => b.id === 'kingpin');
      expect(kingpin).toBeDefined();
      expect(kingpin?.inspiration).toBe('Wilson Fisk');
    });

    it('Kingpin should have multiple abilities', () => {
      const kingpin = streets.bosses.find(b => b.id === 'kingpin');
      expect(kingpin?.abilities).toContain('Crushing Blow');
      expect(kingpin?.abilities).toContain('Call Reinforcements');
    });

    it('should have Bullseye as boss', () => {
      const bullseye = streets.bosses.find(b => b.id === 'bullseye');
      expect(bullseye).toBeDefined();
      expect(bullseye?.abilities).toContain('Perfect Aim');
    });
  });

  describe('Science Pillar Bosses', () => {
    const science = getPillarById('science')!;

    it('should have Ultron Prime as boss', () => {
      const ultron = science.bosses.find(b => b.id === 'ultron');
      expect(ultron).toBeDefined();
      expect(ultron?.name).toBe('Ultron Prime');
      expect(ultron?.abilities).toContain('Self-Repair');
    });

    it('should have M.O.D.O.K. as boss', () => {
      const modok = science.bosses.find(b => b.id === 'modok');
      expect(modok).toBeDefined();
      expect(modok?.abilities).toContain('Psionic Blast');
    });
  });

  describe('Mutants Pillar Bosses', () => {
    const mutants = getPillarById('mutants')!;

    it('should have Master Mold as boss', () => {
      const masterMold = mutants.bosses.find(b => b.id === 'master_mold');
      expect(masterMold).toBeDefined();
      expect(masterMold?.abilities).toContain('Spawn Sentinels');
      expect(masterMold?.abilities).toContain('Adaptation');
    });

    it('should have Nimrod as boss', () => {
      const nimrod = mutants.bosses.find(b => b.id === 'nimrod');
      expect(nimrod).toBeDefined();
      expect(nimrod?.abilities).toContain('Time Displacement');
    });
  });

  describe('Cosmos Pillar Bosses', () => {
    const cosmos = getPillarById('cosmos')!;

    it('should have Corvus Glaive (Black Order) as boss', () => {
      const corvus = cosmos.bosses.find(b => b.id === 'thanos_lieutenant');
      expect(corvus).toBeDefined();
      expect(corvus?.name).toBe('Corvus Glaive');
      expect(corvus?.inspiration).toBe('Black Order');
    });

    it('should have Ronan the Accuser as boss', () => {
      const ronan = cosmos.bosses.find(b => b.id === 'ronan');
      expect(ronan).toBeDefined();
      expect(ronan?.abilities).toContain('Universal Weapon');
    });
  });

  describe('Magic Pillar Bosses', () => {
    const magic = getPillarById('magic')!;

    it('should have Dormammu as boss', () => {
      const dormammu = magic.bosses.find(b => b.id === 'dormammu');
      expect(dormammu).toBeDefined();
      expect(dormammu?.abilities).toContain('Dark Dimension Power');
      expect(dormammu?.abilities).toContain('Dimension Shift');
    });

    it('should have Baron Mordo as boss', () => {
      const mordo = magic.bosses.find(b => b.id === 'baron_mordo');
      expect(mordo).toBeDefined();
      expect(mordo?.abilities).toContain('Dark Magic');
    });
  });

  describe('Gods Pillar Bosses', () => {
    const gods = getPillarById('gods')!;

    it('should have Hela as boss', () => {
      const hela = gods.bosses.find(b => b.id === 'hela');
      expect(hela).toBeDefined();
      expect(hela?.abilities).toContain('Necrosword');
      expect(hela?.abilities).toContain('Goddess of Death');
    });

    it('should have Surtur as boss', () => {
      const surtur = gods.bosses.find(b => b.id === 'surtur');
      expect(surtur).toBeDefined();
      expect(surtur?.abilities).toContain('Twilight Sword');
      expect(surtur?.abilities).toContain('Ragnarok Flame');
    });
  });

  describe('Boss Drops', () => {
    it('all bosses should have drops defined', () => {
      for (const pillar of PILLAR_DEFINITIONS) {
        for (const boss of pillar.bosses) {
          expect(boss.drops).toBeDefined();
          expect(boss.drops.length).toBeGreaterThanOrEqual(2);
          expect(boss.drops).toContain('gold');
          expect(boss.drops).toContain('dust');
        }
      }
    });

    it('late-game bosses should drop rare materials', () => {
      const gods = getPillarById('gods')!;
      const surtur = gods.bosses.find(b => b.id === 'surtur');
      expect(surtur?.drops.some(d => d.includes('legendary'))).toBe(true);
    });

    it('cosmic bosses should drop stone fragments', () => {
      const cosmos = getPillarById('cosmos')!;
      const ronan = cosmos.bosses.find(b => b.id === 'ronan');
      expect(ronan?.drops.some(d => d.includes('stone_fragment'))).toBe(true);
    });
  });
});

// ============================================================================
// TEST 8: NATURAL HEROES SYSTEM
// ============================================================================

describe('Natural Heroes System', () => {
  describe('getNaturalHeroesForPillar', () => {
    it('Streets pillar has vanguard', () => {
      const heroes = getNaturalHeroesForPillar('streets');
      expect(heroes).toContain('vanguard');
    });

    it('Science pillar has forge', () => {
      const heroes = getNaturalHeroesForPillar('science');
      expect(heroes).toContain('forge');
    });

    it('Mutants pillar has titan and rift', () => {
      const heroes = getNaturalHeroesForPillar('mutants');
      expect(heroes).toContain('titan');
      expect(heroes).toContain('rift');
    });

    it('Cosmos pillar has storm', () => {
      const heroes = getNaturalHeroesForPillar('cosmos');
      expect(heroes).toContain('storm');
    });

    it('Magic pillar has rift', () => {
      const heroes = getNaturalHeroesForPillar('magic');
      expect(heroes).toContain('rift');
    });

    it('Gods pillar has storm and frost', () => {
      const heroes = getNaturalHeroesForPillar('gods');
      expect(heroes).toContain('storm');
      expect(heroes).toContain('frost');
    });

    it('returns empty array for invalid pillar', () => {
      expect(getNaturalHeroesForPillar('invalid' as PillarId)).toEqual([]);
    });
  });

  describe('isHeroNaturalForPillar', () => {
    it('vanguard is natural for Streets', () => {
      expect(isHeroNaturalForPillar('streets', 'vanguard')).toBe(true);
    });

    it('vanguard is NOT natural for Gods', () => {
      expect(isHeroNaturalForPillar('gods', 'vanguard')).toBe(false);
    });

    it('storm is natural for multiple pillars (Cosmos, Gods)', () => {
      expect(isHeroNaturalForPillar('cosmos', 'storm')).toBe(true);
      expect(isHeroNaturalForPillar('gods', 'storm')).toBe(true);
    });

    it('rift is natural for Mutants and Magic', () => {
      expect(isHeroNaturalForPillar('mutants', 'rift')).toBe(true);
      expect(isHeroNaturalForPillar('magic', 'rift')).toBe(true);
    });
  });

  describe('NATURAL_HERO_PILLAR_BONUS', () => {
    it('provides +20% damage bonus', () => {
      // 19661 / 16384 ≈ 1.2
      const damageRatio = NATURAL_HERO_PILLAR_BONUS.damageMultiplier / 16384;
      expect(damageRatio).toBeCloseTo(1.2, 2);
    });

    it('provides +50% XP bonus', () => {
      // 24576 / 16384 = 1.5
      const xpRatio = NATURAL_HERO_PILLAR_BONUS.xpMultiplier / 16384;
      expect(xpRatio).toBeCloseTo(1.5, 2);
    });
  });

  it('each pillar should have at least 1 natural hero', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      expect(pillar.naturalHeroes.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// TEST 9: SPECIAL MECHANICS
// ============================================================================

describe('Special Mechanics', () => {
  describe('Science Pillar Mechanics', () => {
    const science = getPillarById('science')!;

    it('has EMP vulnerability mechanic', () => {
      const emp = science.specialMechanics?.find(m => m.id === 'emp_vulnerability');
      expect(emp).toBeDefined();
      expect(emp?.description).toContain('Lightning');
    });

    it('has Self-repair mechanic', () => {
      const selfRepair = science.specialMechanics?.find(m => m.id === 'self_repair');
      expect(selfRepair).toBeDefined();
      expect(selfRepair?.description).toContain('regenerują');
    });
  });

  describe('Mutants Pillar Mechanics', () => {
    const mutants = getPillarById('mutants')!;

    it('has Sentinel adaptation mechanic', () => {
      const adaptation = mutants.specialMechanics?.find(m => m.id === 'sentinel_adaptation');
      expect(adaptation).toBeDefined();
      expect(adaptation?.description).toContain('odporności');
    });

    it('has Mutant detection mechanic', () => {
      const detection = mutants.specialMechanics?.find(m => m.id === 'mutant_detection');
      expect(detection).toBeDefined();
    });
  });

  describe('Cosmos Pillar Mechanics', () => {
    const cosmos = getPillarById('cosmos')!;

    it('has Zero gravity mechanic', () => {
      const zeroG = cosmos.specialMechanics?.find(m => m.id === 'zero_gravity');
      expect(zeroG).toBeDefined();
      expect(zeroG?.description).toContain('grawitacji');
    });

    it('has Cosmic radiation mechanic', () => {
      const radiation = cosmos.specialMechanics?.find(m => m.id === 'cosmic_radiation');
      expect(radiation).toBeDefined();
      expect(radiation?.description).toContain('+10% DMG');
    });
  });

  describe('Magic Pillar Mechanics', () => {
    const magic = getPillarById('magic')!;

    it('has Reality flux mechanic', () => {
      const flux = magic.specialMechanics?.find(m => m.id === 'reality_flux');
      expect(flux).toBeDefined();
    });

    it('has Dimension shift mechanic', () => {
      const shift = magic.specialMechanics?.find(m => m.id === 'dimension_shift');
      expect(shift).toBeDefined();
      expect(shift?.description).toContain('teleportować');
    });
  });

  describe('Gods Pillar Mechanics', () => {
    const gods = getPillarById('gods')!;

    it('has Divine intervention mechanic', () => {
      const divine = gods.specialMechanics?.find(m => m.id === 'divine_intervention');
      expect(divine).toBeDefined();
    });

    it('has Ragnarok building mechanic', () => {
      const ragnarok = gods.specialMechanics?.find(m => m.id === 'ragnarok_building');
      expect(ragnarok).toBeDefined();
      expect(ragnarok?.description).toContain('Fire');
    });
  });

  it('Streets pillar has no special mechanics (basic intro)', () => {
    const streets = getPillarById('streets')!;
    expect(streets.specialMechanics).toBeUndefined();
  });

  it('all mechanics should have id, name, and description', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      if (pillar.specialMechanics) {
        for (const mechanic of pillar.specialMechanics) {
          expect(mechanic.id).toBeDefined();
          expect(mechanic.name).toBeDefined();
          expect(mechanic.description).toBeDefined();
        }
      }
    }
  });
});

// ============================================================================
// TEST 10: REWARDS SYSTEM
// ============================================================================

describe('Rewards System', () => {
  describe('First Completion Rewards', () => {
    it('first completion gives more rewards than regular', () => {
      for (const pillar of PILLAR_DEFINITIONS) {
        expect(pillar.rewards.firstCompletion.dust).toBeGreaterThan(
          pillar.rewards.regularCompletion.dust
        );
        expect(pillar.rewards.firstCompletion.fortressXp).toBeGreaterThan(
          pillar.rewards.regularCompletion.fortressXp
        );
      }
    });

    it('first completion ratio is approximately 4x regular', () => {
      for (const pillar of PILLAR_DEFINITIONS) {
        const dustRatio = pillar.rewards.firstCompletion.dust / pillar.rewards.regularCompletion.dust;
        expect(dustRatio).toBeGreaterThanOrEqual(3.5);
        expect(dustRatio).toBeLessThanOrEqual(5);
      }
    });
  });

  describe('Reward Progression', () => {
    it('later pillars give more rewards', () => {
      const pillars = PILLAR_DEFINITIONS;
      for (let i = 1; i < pillars.length; i++) {
        expect(pillars[i].rewards.firstCompletion.dust).toBeGreaterThanOrEqual(
          pillars[i - 1].rewards.firstCompletion.dust
        );
        expect(pillars[i].rewards.firstCompletion.fortressXp).toBeGreaterThanOrEqual(
          pillars[i - 1].rewards.firstCompletion.fortressXp
        );
      }
    });

    it('Streets gives 50 dust on first completion', () => {
      expect(getPillarById('streets')?.rewards.firstCompletion.dust).toBe(50);
    });

    it('Gods gives 375 dust on first completion', () => {
      expect(getPillarById('gods')?.rewards.firstCompletion.dust).toBe(375);
    });
  });

  describe('Unlock Rewards', () => {
    it('Streets completion unlocks Science pillar', () => {
      const streets = getPillarById('streets')!;
      expect(streets.rewards.firstCompletion.unlocks).toContain('pillar_science');
    });

    it('Science completion unlocks Mutants pillar', () => {
      const science = getPillarById('science')!;
      expect(science.rewards.firstCompletion.unlocks).toContain('pillar_mutants');
    });

    it('Cosmos completion unlocks both Magic and Gods', () => {
      const cosmos = getPillarById('cosmos')!;
      expect(cosmos.rewards.firstCompletion.unlocks).toContain('pillar_magic');
      expect(cosmos.rewards.firstCompletion.unlocks).toContain('pillar_gods');
    });

    it('Gods completion unlocks true ending', () => {
      const gods = getPillarById('gods')!;
      expect(gods.rewards.firstCompletion.unlocks).toContain('true_ending');
    });
  });

  describe('XP Rewards', () => {
    it('Streets gives 1000 XP on first completion', () => {
      expect(getPillarById('streets')?.rewards.firstCompletion.fortressXp).toBe(1000);
    });

    it('Gods gives 7500 XP on first completion', () => {
      expect(getPillarById('gods')?.rewards.firstCompletion.fortressXp).toBe(7500);
    });

    it('total first-completion XP exceeds 20000', () => {
      const totalXp = PILLAR_DEFINITIONS.reduce(
        (sum, p) => sum + p.rewards.firstCompletion.fortressXp,
        0
      );
      expect(totalXp).toBeGreaterThan(20000);
    });
  });
});

// ============================================================================
// TEST 11: getPillarById FUNCTION
// ============================================================================

describe('getPillarById', () => {
  it.each(['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'] as PillarId[])(
    'returns pillar for valid ID: %s',
    (id) => {
      const pillar = getPillarById(id);
      expect(pillar).toBeDefined();
      expect(pillar?.id).toBe(id);
    }
  );

  it('returns undefined for invalid ID', () => {
    expect(getPillarById('invalid' as PillarId)).toBeUndefined();
    expect(getPillarById('' as PillarId)).toBeUndefined();
  });
});

// ============================================================================
// TEST 12: SCENERY AND VISUAL CONFIGURATION
// ============================================================================

describe('Scenery and Visual Configuration', () => {
  it.each(PILLAR_DEFINITIONS)('pillar "$id" has valid hex colors', (pillar) => {
    const { primary, secondary, accent } = pillar.scenery.colors;

    // Check colors are valid hex values (0x000000 to 0xFFFFFF)
    expect(primary).toBeGreaterThanOrEqual(0);
    expect(primary).toBeLessThanOrEqual(0xFFFFFF);
    expect(secondary).toBeGreaterThanOrEqual(0);
    expect(secondary).toBeLessThanOrEqual(0xFFFFFF);
    expect(accent).toBeGreaterThanOrEqual(0);
    expect(accent).toBeLessThanOrEqual(0xFFFFFF);
  });

  it('each pillar has unique color scheme', () => {
    const primaryColors = PILLAR_DEFINITIONS.map(p => p.scenery.colors.primary);
    const uniqueColors = new Set(primaryColors);
    expect(uniqueColors.size).toBe(primaryColors.length);
  });

  it('all pillars have background and ambiance descriptions', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      expect(pillar.scenery.background.length).toBeGreaterThan(10);
      expect(pillar.scenery.ambiance.length).toBeGreaterThan(10);
    }
  });
});

// ============================================================================
// TEST 13: CONSISTENCY CHECKS
// ============================================================================

describe('Consistency Checks', () => {
  it('unlock levels are in ascending order', () => {
    let prevLevel = 0;
    for (const pillar of PILLAR_DEFINITIONS) {
      expect(pillar.unlockRequirement.fortressLevel).toBeGreaterThanOrEqual(prevLevel);
      prevLevel = pillar.unlockRequirement.fortressLevel;
    }
  });

  it('wave ranges are in ascending order', () => {
    let prevEnd = 0;
    for (const pillar of PILLAR_DEFINITIONS) {
      expect(pillar.waveRange.start).toBe(prevEnd + 1);
      prevEnd = pillar.waveRange.end;
    }
  });

  it('all class modifiers have descriptions', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      for (const modifier of pillar.classModifiers) {
        expect(modifier.description).toBeDefined();
        expect(modifier.description.length).toBeGreaterThan(5);
      }
    }
  });

  it('boss abilities are non-empty arrays', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      for (const boss of pillar.bosses) {
        expect(boss.abilities.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('all bosses have lore inspiration', () => {
    for (const pillar of PILLAR_DEFINITIONS) {
      for (const boss of pillar.bosses) {
        expect(boss.inspiration).toBeDefined();
        expect(boss.inspiration.length).toBeGreaterThan(0);
      }
    }
  });
});
