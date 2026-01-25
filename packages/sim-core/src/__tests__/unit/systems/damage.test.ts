/**
 * Damage System Tests
 *
 * Tests for damage application to heroes and turrets,
 * CC duration, knockback mechanics, and fortress damage reduction.
 */
import { describe, it, expect } from 'vitest';
import {
  applyDamageToHero,
  applyDamageToTurret,
  applyCCToHero,
  isHeroCCd,
  applyKnockbackToHero,
  calculateFortressIncomingDamage,
} from '../../../systems/damage.js';
import {
  calculateCCDuration,
  applyKnockbackWithResistance,
} from '../../../physics.js';
import { FP } from '../../../fixed.js';
import { Xorshift32 } from '../../../rng.js';
import type { ActiveHero, ActiveTurret } from '../../../types.js';
import type { PhysicsBody } from '../../../physics.js';

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

// Helper to create a test turret
function createTestTurret(overrides: Partial<ActiveTurret> = {}): ActiveTurret {
  return {
    definitionId: 'test-turret',
    tier: 1,
    currentClass: 'natural',
    slotIndex: 0,
    lastAttackTick: 0,
    specialCooldown: 0,
    targetingMode: 'closest_to_fortress',
    currentHp: 50,
    maxHp: 50,
    ...overrides,
  };
}

// Helper to create a physics body for knockback tests
function createPhysicsBody(overrides: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    x: FP.fromInt(10),
    y: FP.fromInt(7),
    vx: 0,
    vy: 0,
    radius: FP.fromFloat(1.0),
    mass: FP.fromFloat(1.0),
    ...overrides,
  };
}

describe('Damage System', () => {
  // ============================================================================
  // BASE DAMAGE TO HERO
  // ============================================================================

  describe('applyDamageToHero', () => {
    it('should return zero damage for heroes (heroes are immortal in main gameplay)', () => {
      const hero = createTestHero();
      const rng = new Xorshift32(12345);
      const result = applyDamageToHero(hero, 50, rng);

      expect(result.damageTaken).toBe(0);
      expect(result.reflectDamage).toBe(0);
    });

    it('should not slow attacker by default', () => {
      const hero = createTestHero();
      const rng = new Xorshift32(12345);
      const result = applyDamageToHero(hero, 100, rng);

      expect(result.slowAttacker).toBeUndefined();
    });

    it('should handle zero damage input', () => {
      const hero = createTestHero();
      const rng = new Xorshift32(12345);
      const result = applyDamageToHero(hero, 0, rng);

      expect(result.damageTaken).toBe(0);
      expect(result.reflectDamage).toBe(0);
    });

    it('should handle negative damage input gracefully', () => {
      const hero = createTestHero();
      const rng = new Xorshift32(12345);
      const result = applyDamageToHero(hero, -10, rng);

      expect(result.damageTaken).toBe(0);
    });
  });

  // ============================================================================
  // DAMAGE TO TURRET
  // ============================================================================

  describe('applyDamageToTurret', () => {
    it('should apply full damage when turret has enough HP', () => {
      const turret = createTestTurret({ currentHp: 50 });
      const actualDamage = applyDamageToTurret(turret, 20);

      expect(actualDamage).toBe(20);
      expect(turret.currentHp).toBe(30);
    });

    it('should cap damage at remaining HP', () => {
      const turret = createTestTurret({ currentHp: 10 });
      const actualDamage = applyDamageToTurret(turret, 25);

      expect(actualDamage).toBe(10);
      expect(turret.currentHp).toBe(0);
    });

    it('should handle zero damage', () => {
      const turret = createTestTurret({ currentHp: 50 });
      const actualDamage = applyDamageToTurret(turret, 0);

      expect(actualDamage).toBe(0);
      expect(turret.currentHp).toBe(50);
    });

    it('should destroy turret when damage equals HP', () => {
      const turret = createTestTurret({ currentHp: 30 });
      const actualDamage = applyDamageToTurret(turret, 30);

      expect(actualDamage).toBe(30);
      expect(turret.currentHp).toBe(0);
    });

    it('should handle damage greater than turret HP', () => {
      const turret = createTestTurret({ currentHp: 15 });
      const actualDamage = applyDamageToTurret(turret, 100);

      expect(actualDamage).toBe(15);
      expect(turret.currentHp).toBe(0);
    });
  });

  // ============================================================================
  // CROWD CONTROL DURATION
  // ============================================================================

  describe('calculateCCDuration', () => {
    it('should return full duration with zero resistance', () => {
      const duration = calculateCCDuration(100, 0);
      expect(duration).toBe(100);
    });

    it('should reduce duration by resistance percentage', () => {
      const duration = calculateCCDuration(100, 0.5);
      expect(duration).toBe(50);
    });

    it('should cap resistance at 0.9 (90%)', () => {
      const duration = calculateCCDuration(100, 1.0);
      // Clamped to 0.9 = 10% remaining, floored: 100 * 0.1 = 10, but floor(9.999...) = 9
      expect(duration).toBe(9);
    });

    it('should handle negative resistance as zero', () => {
      const duration = calculateCCDuration(100, -0.5);
      expect(duration).toBe(100);
    });

    it('should floor the result to integer', () => {
      const duration = calculateCCDuration(99, 0.5);
      expect(duration).toBe(49); // 99 * 0.5 = 49.5 -> 49
    });

    it('should return zero duration for very high resistance', () => {
      const duration = calculateCCDuration(5, 0.9);
      expect(duration).toBe(0); // 5 * 0.1 = 0.5 -> 0
    });
  });

  describe('applyCCToHero', () => {
    it('should add CC buff to hero with reduced duration', () => {
      const hero = createTestHero();
      const currentTick = 100;

      applyCCToHero(hero, 60, 0, 'stun', currentTick);

      expect(hero.buffs.length).toBe(1);
      expect(hero.buffs[0].id).toBe('stun');
      expect(hero.buffs[0].expirationTick).toBe(160); // 100 + 60
    });

    it('should apply CC resistance to duration', () => {
      const hero = createTestHero();
      const currentTick = 100;

      applyCCToHero(hero, 60, 0.5, 'freeze', currentTick);

      expect(hero.buffs.length).toBe(1);
      expect(hero.buffs[0].expirationTick).toBe(130); // 100 + 30 (60 * 0.5)
    });

    it('should not add buff if duration would be zero', () => {
      const hero = createTestHero();
      const currentTick = 100;

      applyCCToHero(hero, 5, 0.9, 'stun', currentTick);

      expect(hero.buffs.length).toBe(0); // 5 * 0.1 = 0.5 -> 0
    });

    it('should allow stacking multiple CC effects', () => {
      const hero = createTestHero();
      const currentTick = 100;

      applyCCToHero(hero, 60, 0, 'stun', currentTick);
      applyCCToHero(hero, 90, 0, 'freeze', currentTick);

      expect(hero.buffs.length).toBe(2);
      expect(hero.buffs.some(b => b.id === 'stun')).toBe(true);
      expect(hero.buffs.some(b => b.id === 'freeze')).toBe(true);
    });
  });

  describe('isHeroCCd', () => {
    it('should return true when hero has active CC effect', () => {
      const hero = createTestHero({
        buffs: [{ id: 'stun', stat: 'hpRegen', amount: 0, expirationTick: 150 }],
      });

      expect(isHeroCCd(hero, 'stun', 100)).toBe(true);
    });

    it('should return false when CC effect has expired', () => {
      const hero = createTestHero({
        buffs: [{ id: 'stun', stat: 'hpRegen', amount: 0, expirationTick: 90 }],
      });

      expect(isHeroCCd(hero, 'stun', 100)).toBe(false);
    });

    it('should return false for different effect type', () => {
      const hero = createTestHero({
        buffs: [{ id: 'stun', stat: 'hpRegen', amount: 0, expirationTick: 150 }],
      });

      expect(isHeroCCd(hero, 'freeze', 100)).toBe(false);
    });

    it('should return false for hero with no buffs', () => {
      const hero = createTestHero();

      expect(isHeroCCd(hero, 'stun', 100)).toBe(false);
    });
  });

  // ============================================================================
  // KNOCKBACK MECHANICS
  // ============================================================================

  describe('applyKnockbackWithResistance', () => {
    it('should apply full knockback with zero resistance', () => {
      const body = createPhysicsBody({ vx: 0, vy: 0 });
      const kbX = FP.fromFloat(5.0);
      const kbY = FP.fromFloat(3.0);

      applyKnockbackWithResistance(body, kbX, kbY, 0);

      expect(body.vx).toBe(kbX);
      expect(body.vy).toBe(kbY);
    });

    it('should reduce knockback by resistance percentage', () => {
      const body = createPhysicsBody({ vx: 0, vy: 0 });
      const kbX = FP.fromFloat(10.0);
      const kbY = FP.fromFloat(0);

      applyKnockbackWithResistance(body, kbX, kbY, 0.5);

      // 50% resistance = 50% of knockback applied
      expect(FP.toFloat(body.vx)).toBeCloseTo(5.0, 1);
    });

    it('should cap resistance at 0.9', () => {
      const body = createPhysicsBody({ vx: 0, vy: 0 });
      const kbX = FP.fromFloat(100.0);
      const kbY = FP.fromFloat(0);

      applyKnockbackWithResistance(body, kbX, kbY, 1.0);

      // Clamped to 0.9 = 10% of knockback
      expect(FP.toFloat(body.vx)).toBeCloseTo(10.0, 1);
    });

    it('should add knockback to existing velocity', () => {
      const initialVx = FP.fromFloat(2.0);
      const body = createPhysicsBody({ vx: initialVx, vy: 0 });
      const kbX = FP.fromFloat(5.0);

      applyKnockbackWithResistance(body, kbX, 0, 0);

      expect(FP.toFloat(body.vx)).toBeCloseTo(7.0, 1);
    });

    it('should handle negative knockback values', () => {
      const body = createPhysicsBody({ vx: 0, vy: 0 });
      const kbX = FP.fromFloat(-5.0);
      const kbY = FP.fromFloat(-3.0);

      applyKnockbackWithResistance(body, kbX, kbY, 0);

      expect(FP.toFloat(body.vx)).toBeCloseTo(-5.0, 1);
      expect(FP.toFloat(body.vy)).toBeCloseTo(-3.0, 1);
    });
  });

  describe('applyKnockbackToHero', () => {
    it('should apply knockback to hero with resistance', () => {
      const hero = createTestHero() as ActiveHero & PhysicsBody;
      hero.vx = 0;
      hero.vy = 0;

      const kbX = FP.fromFloat(8.0);
      const kbY = FP.fromFloat(4.0);

      applyKnockbackToHero(hero, kbX, kbY, 0.25);

      // 25% resistance = 75% of knockback
      expect(FP.toFloat(hero.vx)).toBeCloseTo(6.0, 1);
      expect(FP.toFloat(hero.vy)).toBeCloseTo(3.0, 1);
    });
  });

  // ============================================================================
  // FORTRESS DAMAGE REDUCTION
  // ============================================================================

  describe('calculateFortressIncomingDamage', () => {
    it('should return full damage with zero reduction', () => {
      const damage = calculateFortressIncomingDamage(100, 0);
      expect(damage).toBe(100);
    });

    it('should reduce damage by reduction percentage', () => {
      const damage = calculateFortressIncomingDamage(100, 0.3);
      expect(damage).toBe(70);
    });

    it('should cap reduction at 0.9 (90%)', () => {
      const damage = calculateFortressIncomingDamage(100, 0.95);
      // Clamped to 0.9, floor(100 * 0.1) = floor(10.0) but can be 9 due to precision
      expect(damage).toBe(9);
    });

    it('should increase damage with negative reduction', () => {
      const damage = calculateFortressIncomingDamage(100, -0.5);
      expect(damage).toBe(150);
    });

    it('should clamp negative reduction at -1.0', () => {
      const damage = calculateFortressIncomingDamage(100, -2.0);
      expect(damage).toBe(200); // Clamped to -1.0 = 2x damage
    });

    it('should floor the result', () => {
      const damage = calculateFortressIncomingDamage(99, 0.3);
      expect(damage).toBe(69); // 99 * 0.7 = 69.3 -> 69
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle turret at exactly 1 HP', () => {
      const turret = createTestTurret({ currentHp: 1 });
      const actualDamage = applyDamageToTurret(turret, 1);

      expect(actualDamage).toBe(1);
      expect(turret.currentHp).toBe(0);
    });

    it('should handle turret already at 0 HP', () => {
      const turret = createTestTurret({ currentHp: 0 });
      const actualDamage = applyDamageToTurret(turret, 10);

      expect(actualDamage).toBe(0);
      expect(turret.currentHp).toBe(0);
    });

    it('should handle very large damage values', () => {
      const turret = createTestTurret({ currentHp: 50 });
      const actualDamage = applyDamageToTurret(turret, 999999);

      expect(actualDamage).toBe(50);
      expect(turret.currentHp).toBe(0);
    });

    it('should handle very small CC duration', () => {
      const duration = calculateCCDuration(1, 0);
      expect(duration).toBe(1);
    });

    it('should handle fortress damage with very small base damage', () => {
      const damage = calculateFortressIncomingDamage(1, 0.5);
      expect(damage).toBe(0); // 1 * 0.5 = 0.5 -> 0
    });

    it('should handle zero knockback values', () => {
      const body = createPhysicsBody({ vx: FP.fromFloat(5.0), vy: 0 });

      applyKnockbackWithResistance(body, 0, 0, 0);

      expect(FP.toFloat(body.vx)).toBeCloseTo(5.0, 1); // Unchanged
      expect(body.vy).toBe(0);
    });
  });
});
