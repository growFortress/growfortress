/**
 * SimConfig service tests
 */
import { describe, it, expect, vi } from 'vitest';
import type { PillarId } from '@arcade/sim-core';
import {
  buildSimConfigSnapshot,
  applySimConfigSnapshot,
} from '../../../services/simConfig.js';

// Mock sim-core
vi.mock('@arcade/sim-core', async () => {
  const actual = await vi.importActual('@arcade/sim-core');
  return {
    ...actual,
    getMaxHeroSlots: vi.fn((level: number) => Math.min(4, 1 + Math.floor(level / 10))),
    getMaxTurretSlots: vi.fn((level: number) => Math.min(6, 2 + Math.floor(level / 10))),
    isClassUnlockedAtLevel: vi.fn((classId: string, level: number) => {
      if (classId === 'natural') return true;
      if (classId === 'ice') return level >= 5;
      if (classId === 'fire') return level >= 10;
      return level >= 20;
    }),
  };
});

describe('SimConfig Service', () => {
  describe('buildSimConfigSnapshot', () => {
    const baseParams = {
      commanderLevel: 10,
      progressionBonuses: {
        damageMultiplier: 1.5,
        goldMultiplier: 1.2,
        startingGold: 100,
        maxHeroSlots: 2,
        maxTurretSlots: 3,
      },
      unlockedHeroes: ['vanguard', 'storm', 'rift'],
      unlockedTurrets: ['railgun', 'cannon', 'laser'],
    };

    it('builds config with default fortress class', () => {
      const result = buildSimConfigSnapshot(baseParams);

      expect(result.simConfig.fortressClass).toBe('natural');
    });

    it('uses requested fortress class if unlocked', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        requested: { fortressClass: 'fire' },
      });

      expect(result.simConfig.fortressClass).toBe('fire');
    });

    it('falls back to natural if requested class not unlocked', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        commanderLevel: 1,
        requested: { fortressClass: 'fire' },
      });

      expect(result.simConfig.fortressClass).toBe('natural');
    });

    it('uses defaults if no requested loadout', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        defaults: {
          fortressClass: 'ice',
          heroId: 'storm',
          turretType: 'cannon',
        },
      });

      expect(result.resolvedLoadout.startingHeroes).toContain('storm');
      expect(result.resolvedLoadout.startingTurrets).toContain('cannon');
    });

    it('filters out heroes not in unlocked list', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        requested: {
          startingHeroes: ['vanguard', 'locked_hero', 'storm'],
        },
      });

      expect(result.resolvedLoadout.startingHeroes).toContain('vanguard');
      expect(result.resolvedLoadout.startingHeroes).toContain('storm');
      expect(result.resolvedLoadout.startingHeroes).not.toContain('locked_hero');
    });

    it('filters out turrets not in unlocked list', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        requested: {
          startingTurrets: ['railgun', 'locked_turret', 'cannon'],
        },
      });

      expect(result.resolvedLoadout.startingTurrets).toContain('railgun');
      expect(result.resolvedLoadout.startingTurrets).toContain('cannon');
      expect(result.resolvedLoadout.startingTurrets).not.toContain('locked_turret');
    });

    it('limits heroes to max slots', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        progressionBonuses: {
          ...baseParams.progressionBonuses,
          maxHeroSlots: 1,
        },
        requested: {
          startingHeroes: ['vanguard', 'storm', 'rift'],
        },
      });

      expect(result.resolvedLoadout.startingHeroes.length).toBe(1);
    });

    it('limits turrets to max slots', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        progressionBonuses: {
          ...baseParams.progressionBonuses,
          maxTurretSlots: 2,
        },
        requested: {
          startingTurrets: ['railgun', 'cannon', 'laser'],
        },
      });

      expect(result.resolvedLoadout.startingTurrets.length).toBe(2);
    });

    it('normalizes legacy hero IDs', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        progressionBonuses: {
          ...baseParams.progressionBonuses,
          maxHeroSlots: 3, // Allow 3 heroes for this test
        },
        unlockedHeroes: ['vanguard', 'storm', 'forge'],
        requested: {
          startingHeroes: ['shield_captain', 'thunderlord', 'iron_sentinel'],
        },
      });

      // Legacy IDs should be normalized to canonical versions
      expect(result.resolvedLoadout.startingHeroes).toContain('vanguard');
      expect(result.resolvedLoadout.startingHeroes).toContain('storm');
      expect(result.resolvedLoadout.startingHeroes).toContain('forge');
    });

    it('preserves commander level in config', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        commanderLevel: 25,
      });

      expect(result.simConfig.commanderLevel).toBe(25);
    });

    it('applies progression bonuses to config', () => {
      const result = buildSimConfigSnapshot(baseParams);

      expect(result.simConfig.progressionDamageBonus).toBe(1.5);
      expect(result.simConfig.progressionGoldBonus).toBe(1.2);
      expect(result.simConfig.startingGold).toBe(100);
    });

    it('uses remote config values when provided', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        remoteConfig: {
          fortressBaseHp: 200,
          fortressBaseDamage: 25,
          waveIntervalTicks: 120,
        },
      });

      expect(result.simConfig.fortressBaseHp).toBe(200);
      expect(result.simConfig.fortressBaseDamage).toBe(25);
      expect(result.simConfig.waveIntervalTicks).toBe(120);
    });

    it('uses default values when no remote config', () => {
      const result = buildSimConfigSnapshot(baseParams);

      expect(result.simConfig.fortressBaseHp).toBe(200);
      expect(result.simConfig.fortressBaseDamage).toBe(10);
      expect(result.simConfig.waveIntervalTicks).toBe(90);
    });

    it('ensures minimum of 1 hero slot', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        progressionBonuses: {
          ...baseParams.progressionBonuses,
          maxHeroSlots: 0,
        },
      });

      expect(result.simConfig.maxHeroSlots).toBeGreaterThanOrEqual(1);
    });

    it('assigns turret slot indices correctly', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        requested: {
          startingTurrets: ['railgun', 'cannon'],
        },
      });

      expect(result.simConfig.startingTurrets[0].slotIndex).toBe(1);
      expect(result.simConfig.startingTurrets[1].slotIndex).toBe(2);
    });

    it('assigns fortress class to turrets', () => {
      const result = buildSimConfigSnapshot({
        ...baseParams,
        requested: {
          fortressClass: 'fire',
          startingTurrets: ['railgun'],
        },
      });

      expect(result.simConfig.startingTurrets[0].class).toBe('fire');
    });
  });

  describe('applySimConfigSnapshot', () => {
    it('applies all snapshot values to config', () => {
      const config = {
        commanderLevel: 1,
        progressionDamageBonus: 1,
        progressionGoldBonus: 1,
        startingGold: 0,
        maxHeroSlots: 1,
        fortressClass: 'natural',
        startingHeroes: [],
        startingTurrets: [],
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 90,
      } as any;

      const snapshot = {
        commanderLevel: 25,
        progressionDamageBonus: 2.0,
        progressionGoldBonus: 1.5,
        startingGold: 500,
        maxHeroSlots: 3,
        fortressClass: 'fire' as const,
        startingHeroes: ['vanguard', 'storm'],
        startingTurrets: [
          { definitionId: 'railgun', slotIndex: 1, class: 'fire' as const },
        ],
        fortressBaseHp: 150,
        fortressBaseDamage: 20,
        waveIntervalTicks: 100,
        currentPillar: 'streets' as PillarId,
        pillarRotation: false,
      };

      const result = applySimConfigSnapshot(config, snapshot);

      expect(result.commanderLevel).toBe(25);
      expect(result.progressionDamageBonus).toBe(2.0);
      expect(result.progressionGoldBonus).toBe(1.5);
      expect(result.startingGold).toBe(500);
      expect(result.maxHeroSlots).toBe(3);
      expect(result.fortressClass).toBe('fire');
      expect(result.startingHeroes).toEqual(['vanguard', 'storm']);
      expect(result.startingTurrets.length).toBe(1);
      expect(result.fortressBaseHp).toBe(150);
      expect(result.fortressBaseDamage).toBe(20);
      expect(result.waveIntervalTicks).toBe(100);
    });

    it('creates copies of arrays to avoid mutation', () => {
      const config = {
        commanderLevel: 1,
        progressionDamageBonus: 1,
        progressionGoldBonus: 1,
        startingGold: 0,
        maxHeroSlots: 1,
        fortressClass: 'natural',
        startingHeroes: [],
        startingTurrets: [],
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 90,
      } as any;

      const snapshot = {
        commanderLevel: 10,
        progressionDamageBonus: 1,
        progressionGoldBonus: 1,
        startingGold: 0,
        maxHeroSlots: 2,
        fortressClass: 'natural' as const,
        startingHeroes: ['vanguard'],
        startingTurrets: [
          { definitionId: 'railgun', slotIndex: 1, class: 'natural' as const },
        ],
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 90,
        currentPillar: 'streets' as PillarId,
        pillarRotation: false,
      };

      const result = applySimConfigSnapshot(config, snapshot);

      // Modifying result arrays should not affect snapshot
      result.startingHeroes.push('new_hero');
      result.startingTurrets.push({ definitionId: 'new', slotIndex: 2, class: 'natural' } as any);

      expect(snapshot.startingHeroes).toEqual(['vanguard']);
      expect(snapshot.startingTurrets.length).toBe(1);
    });

    it('returns the modified config object', () => {
      const config = {
        commanderLevel: 1,
      } as any;

      const snapshot = {
        commanderLevel: 50,
        progressionDamageBonus: 1,
        progressionGoldBonus: 1,
        startingGold: 0,
        maxHeroSlots: 1,
        fortressClass: 'natural' as const,
        startingHeroes: [],
        startingTurrets: [],
        fortressBaseHp: 100,
        fortressBaseDamage: 10,
        waveIntervalTicks: 90,
        currentPillar: 'streets' as PillarId,
        pillarRotation: false,
      };

      const result = applySimConfigSnapshot(config, snapshot);

      expect(result).toBe(config);
    });
  });
});
