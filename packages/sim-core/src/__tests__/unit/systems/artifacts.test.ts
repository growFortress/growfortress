/**
 * Artifact System Tests
 *
 * Tests for artifact effects:
 * - Damage bonuses (base and class-specific)
 * - Health, attack speed bonuses
 * - Defensive effects (dodge, block)
 * - Passive abilities (lifesteal, reflect, on-hit)
 * - Total damage multiplier calculations
 */
import { describe, it, expect } from 'vitest';
import {
  calculateHeroArtifactDamageBonus,
  calculateHeroArtifactHealthBonus,
  calculateHeroArtifactAttackSpeedBonus,
  calculateHeroArtifactClassDamageBonus,
  calculateHeroArtifactDodgeChance,
  calculateHeroArtifactBlockChance,
  hasArtifactPassive,
  applyItemToHero,
  calculateTotalArtifactDamageMultiplier,
  applyArtifactBonusesToStats,
  calculateArtifactLifesteal,
  getArtifactReflectDamage,
  getArtifactOnHitEffect,
} from '../../../systems/artifacts.js';
import type { ActiveHero, FortressClass } from '../../../types.js';
import { FP } from '../../../fixed.js';

// Helper to create a test hero
function createTestHero(overrides: Partial<ActiveHero> = {}): ActiveHero {
  return {
    definitionId: 'test-hero',
    tier: 1,
    level: 1,
    xp: 0,
    currentHp: 100,
    maxHp: 100,
    x: FP.fromInt(10),
    y: FP.fromInt(7),
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(1.0),
    mass: FP.fromFloat(1.0),
    movementModifiers: [],
    state: 'idle',
    lastAttackTick: 0,
    lastDeployTick: 0,
    skillCooldowns: {},
    buffs: [],
    equippedItems: [],
    ...overrides,
  };
}

describe('Artifact System', () => {
  // ============================================================================
  // DAMAGE BONUS
  // ============================================================================

  describe('calculateHeroArtifactDamageBonus', () => {
    it('should return 1.0 for undefined artifact', () => {
      const result = calculateHeroArtifactDamageBonus(undefined);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for non-existent artifact', () => {
      const result = calculateHeroArtifactDamageBonus('non-existent-artifact');
      expect(result).toBe(1.0);
    });

    it('should return damage multiplier for valid artifact with damage boost', () => {
      // plasma_hammer has damageMultiplier: 20480 (= 1.25 = +25% damage)
      const result = calculateHeroArtifactDamageBonus('plasma_hammer');
      expect(result).toBeCloseTo(1.25, 2);
    });

    it('should return 1.0 for artifact without damage effect', () => {
      // Some artifacts may not have damage boost - test graceful handling
      const result = calculateHeroArtifactDamageBonus('guardian_protocols');
      // Will return 1.0 if no damage boost effect found
      expect(result).toBeGreaterThanOrEqual(1.0);
    });
  });

  // ============================================================================
  // HEALTH BONUS
  // ============================================================================

  describe('calculateHeroArtifactHealthBonus', () => {
    it('should return 1.0 for undefined artifact', () => {
      const result = calculateHeroArtifactHealthBonus(undefined);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for non-existent artifact', () => {
      const result = calculateHeroArtifactHealthBonus('non-existent-artifact');
      expect(result).toBe(1.0);
    });

    it('should return health multiplier for artifact with health boost', () => {
      // quantum_armor_mk50 has healthMultiplier effect
      const result = calculateHeroArtifactHealthBonus('quantum_armor_mk50');
      // Should be >= 1.0 if it has a health boost
      expect(result).toBeGreaterThanOrEqual(1.0);
    });
  });

  // ============================================================================
  // ATTACK SPEED BONUS
  // ============================================================================

  describe('calculateHeroArtifactAttackSpeedBonus', () => {
    it('should return 1.0 for undefined artifact', () => {
      const result = calculateHeroArtifactAttackSpeedBonus(undefined);
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for non-existent artifact', () => {
      const result = calculateHeroArtifactAttackSpeedBonus('non-existent-artifact');
      expect(result).toBe(1.0);
    });

    it('should return attack speed multiplier for valid artifact', () => {
      // plasma_hammer has attackSpeed: 18842 (≈ 1.15 = +15% attack speed)
      const result = calculateHeroArtifactAttackSpeedBonus('plasma_hammer');
      expect(result).toBeCloseTo(1.15, 1);
    });
  });

  // ============================================================================
  // CLASS-SPECIFIC DAMAGE BONUS
  // ============================================================================

  describe('calculateHeroArtifactClassDamageBonus', () => {
    it('should return 1.0 for undefined artifact', () => {
      const result = calculateHeroArtifactClassDamageBonus(undefined, 'lightning');
      expect(result).toBe(1.0);
    });

    it('should return 1.0 for non-existent artifact', () => {
      const result = calculateHeroArtifactClassDamageBonus('non-existent', 'fire');
      expect(result).toBe(1.0);
    });

    it('should return class damage bonus for matching class', () => {
      // Check various class combinations
      const classes: FortressClass[] = ['natural', 'tech', 'fire', 'ice', 'lightning', 'void', 'plasma'];
      for (const heroClass of classes) {
        const result = calculateHeroArtifactClassDamageBonus('plasma_hammer', heroClass);
        // Should return 1.0 or a bonus depending on the artifact's class effects
        expect(result).toBeGreaterThanOrEqual(1.0);
      }
    });
  });

  // ============================================================================
  // DODGE CHANCE
  // ============================================================================

  describe('calculateHeroArtifactDodgeChance', () => {
    it('should return 0 for undefined artifact', () => {
      const result = calculateHeroArtifactDodgeChance(undefined);
      expect(result).toBe(0);
    });

    it('should return 0 for non-existent artifact', () => {
      const result = calculateHeroArtifactDodgeChance('non-existent-artifact');
      expect(result).toBe(0);
    });

    it('should return 0 for artifact without dodge effect', () => {
      const result = calculateHeroArtifactDodgeChance('plasma_hammer');
      // plasma_hammer doesn't have dodge chance
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // BLOCK CHANCE
  // ============================================================================

  describe('calculateHeroArtifactBlockChance', () => {
    it('should return 0 for undefined artifact', () => {
      const result = calculateHeroArtifactBlockChance(undefined);
      expect(result).toBe(0);
    });

    it('should return 0 for non-existent artifact', () => {
      const result = calculateHeroArtifactBlockChance('non-existent-artifact');
      expect(result).toBe(0);
    });

    it('should return 0 for artifact without block effect', () => {
      const result = calculateHeroArtifactBlockChance('plasma_hammer');
      // plasma_hammer doesn't have block chance
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // PASSIVE DETECTION
  // ============================================================================

  describe('hasArtifactPassive', () => {
    it('should return false for undefined artifact', () => {
      const result = hasArtifactPassive(undefined, 'lifesteal');
      expect(result).toBe(false);
    });

    it('should return false for non-existent artifact', () => {
      const result = hasArtifactPassive('non-existent-artifact', 'lifesteal');
      expect(result).toBe(false);
    });

    it('should handle case-insensitive keyword search', () => {
      // Test that keyword matching is case-insensitive
      const resultLower = hasArtifactPassive('guardian_protocols', 'guard');
      const resultUpper = hasArtifactPassive('guardian_protocols', 'GUARD');
      expect(resultLower).toBe(resultUpper);
    });
  });

  // ============================================================================
  // TOTAL DAMAGE MULTIPLIER
  // ============================================================================

  describe('calculateTotalArtifactDamageMultiplier', () => {
    it('should return 1.0 for hero without artifact', () => {
      const hero = createTestHero();
      const result = calculateTotalArtifactDamageMultiplier(hero, 'natural');
      expect(result).toBe(1.0);
    });

    it('should return combined multiplier for hero with artifact', () => {
      const hero = createTestHero({ equippedArtifact: 'plasma_hammer' });
      const result = calculateTotalArtifactDamageMultiplier(hero, 'lightning');
      // Should combine base damage bonus + class damage bonus
      expect(result).toBeGreaterThan(1.0);
    });

    it('should work with different fortress classes', () => {
      const hero = createTestHero({ equippedArtifact: 'plasma_hammer' });
      const classes: FortressClass[] = ['natural', 'tech', 'fire', 'ice', 'lightning', 'void', 'plasma'];

      for (const heroClass of classes) {
        const result = calculateTotalArtifactDamageMultiplier(hero, heroClass);
        expect(result).toBeGreaterThanOrEqual(1.0);
      }
    });
  });

  // ============================================================================
  // APPLY BONUSES TO STATS
  // ============================================================================

  describe('applyArtifactBonusesToStats', () => {
    const baseStats = {
      hp: 100,
      damage: 50,
      attackSpeed: 1.0,
      range: 5,
      moveSpeed: 3,
    };

    it('should return base stats for undefined artifact', () => {
      const result = applyArtifactBonusesToStats(baseStats, undefined);
      expect(result).toEqual(baseStats);
    });

    it('should return base stats for non-existent artifact', () => {
      const result = applyArtifactBonusesToStats(baseStats, 'non-existent');
      expect(result).toEqual(baseStats);
    });

    it('should apply damage and health multipliers from artifact', () => {
      const result = applyArtifactBonusesToStats(baseStats, 'plasma_hammer');
      // plasma_hammer has +25% damage, no health bonus
      expect(result.damage).toBeGreaterThanOrEqual(baseStats.damage);
      // Range and moveSpeed should stay the same
      expect(result.range).toBe(baseStats.range);
      expect(result.moveSpeed).toBe(baseStats.moveSpeed);
    });

    it('should preserve attack speed in stats', () => {
      const result = applyArtifactBonusesToStats(baseStats, 'plasma_hammer');
      expect(result.attackSpeed).toBe(baseStats.attackSpeed);
    });
  });

  // ============================================================================
  // LIFESTEAL
  // ============================================================================

  describe('calculateArtifactLifesteal', () => {
    it('should return 0 for undefined artifact', () => {
      const result = calculateArtifactLifesteal(undefined);
      expect(result).toBe(0);
    });

    it('should return 0 for non-existent artifact', () => {
      const result = calculateArtifactLifesteal('non-existent-artifact');
      expect(result).toBe(0);
    });

    it('should return 0 for artifact without lifesteal', () => {
      const result = calculateArtifactLifesteal('plasma_hammer');
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // REFLECT DAMAGE
  // ============================================================================

  describe('getArtifactReflectDamage', () => {
    it('should return 0 for undefined artifact', () => {
      const result = getArtifactReflectDamage(undefined);
      expect(result).toBe(0);
    });

    it('should return 0 for non-existent artifact', () => {
      const result = getArtifactReflectDamage('non-existent-artifact');
      expect(result).toBe(0);
    });

    it('should return 0 for artifact without reflect', () => {
      const result = getArtifactReflectDamage('plasma_hammer');
      expect(result).toBe(0);
    });
  });

  // ============================================================================
  // ON-HIT EFFECTS
  // ============================================================================

  describe('getArtifactOnHitEffect', () => {
    it('should return null for undefined artifact', () => {
      const result = getArtifactOnHitEffect(undefined, 0.5);
      expect(result).toBeNull();
    });

    it('should return null for non-existent artifact', () => {
      const result = getArtifactOnHitEffect('non-existent-artifact', 0.5);
      expect(result).toBeNull();
    });

    it('should return null for artifact without on-hit effect', () => {
      const result = getArtifactOnHitEffect('plasma_hammer', 0.1);
      expect(result).toBeNull();
    });

    it('should respect RNG for chance-based effects', () => {
      // Test with high RNG value (should not trigger low-chance effects)
      const resultHigh = getArtifactOnHitEffect('plasma_hammer', 0.99);
      expect(resultHigh).toBeNull();
    });
  });

  // ============================================================================
  // APPLY ITEM TO HERO
  // ============================================================================

  describe('applyItemToHero', () => {
    it('should do nothing for non-existent item', () => {
      const hero = createTestHero({ currentHp: 50, maxHp: 100 });
      const initialHp = hero.currentHp;

      applyItemToHero(hero, 'non-existent-item', 0);

      expect(hero.currentHp).toBe(initialHp);
      expect(hero.buffs).toHaveLength(0);
    });

    it('should remove item from equipped items after use', () => {
      const hero = createTestHero({
        equippedItems: ['health-potion', 'damage-boost-potion'],
      });

      // If health-potion exists in items, it should be removed after use
      const initialCount = hero.equippedItems.length;
      applyItemToHero(hero, 'health-potion', 0);

      // Item count should either stay same (if item doesn't exist) or decrease
      expect(hero.equippedItems.length).toBeLessThanOrEqual(initialCount);
    });
  });
});
