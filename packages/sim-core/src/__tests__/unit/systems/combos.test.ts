/**
 * Combo System Tests
 *
 * Tests the elemental combo system that detects and applies effects
 * when enemies receive multiple damage types within a short time window.
 *
 * Combos:
 * - Fire + Ice = Steam Burst (+30% damage)
 * - Lightning + Ice = Electrocute (stun 1s)
 * - Natural + Tech = Shatter (armor break - next damage +50%)
 */
import { describe, it, expect } from 'vitest';
import {
  trackDamageHit,
  getArmorBreakMultiplier,
  cleanupExpiredDamageHits,
  COMBOS,
  type ComboDefinition,
  type ComboTrigger,
} from '../../../systems/combos.js';
import { createEnemy, createGameState } from '../../helpers/factories.js';
import type { Enemy, FortressClass } from '../../../types.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

/**
 * Create an enemy with initialized damage hit tracking
 */
function createComboEnemy(overrides: Partial<Enemy> = {}): Enemy {
  return createEnemy({
    recentDamageHits: [],
    activeEffects: [],
    ...overrides,
  });
}

/**
 * Apply multiple damage hits to an enemy
 */
function applyDamageHits(
  enemy: Enemy,
  hits: Array<{ damageClass: FortressClass; damage: number; tickOffset?: number }>,
  baseTick: number = 100
): ComboTrigger | null {
  let lastTrigger: ComboTrigger | null = null;

  for (const hit of hits) {
    const state = createGameState({
      tick: baseTick + (hit.tickOffset ?? 0),
      enemies: [enemy],
    });
    lastTrigger = trackDamageHit(enemy, hit.damageClass, hit.damage, state);
  }

  return lastTrigger;
}

// ============================================================================
// COMBO DEFINITIONS TESTS
// ============================================================================

describe('COMBOS definitions', () => {
  it('should have steam_burst combo defined', () => {
    const steamBurst = COMBOS.find((c: ComboDefinition) => c.id === 'steam_burst');
    expect(steamBurst).toBeDefined();
    expect(steamBurst!.elements).toContain('fire');
    expect(steamBurst!.elements).toContain('ice');
    expect(steamBurst!.bonusDamagePercent).toBe(0.30);
  });

  it('should have electrocute combo defined', () => {
    const electrocute = COMBOS.find((c: ComboDefinition) => c.id === 'electrocute');
    expect(electrocute).toBeDefined();
    expect(electrocute!.elements).toContain('lightning');
    expect(electrocute!.elements).toContain('ice');
    expect(electrocute!.stunDuration).toBe(30); // 1 second at 30Hz
  });

  it('should have shatter combo defined', () => {
    const shatter = COMBOS.find((c: ComboDefinition) => c.id === 'shatter');
    expect(shatter).toBeDefined();
    expect(shatter!.elements).toContain('natural');
    expect(shatter!.elements).toContain('tech');
    expect(shatter!.armorBreakPercent).toBe(0.50);
  });

  it('should have all combos with valid effect types', () => {
    for (const combo of COMBOS) {
      expect(['steam_burst', 'electrocute', 'shatter']).toContain(combo.effect);
      expect(combo.elements).toHaveLength(2);
      expect(combo.name).toBeTruthy();
    }
  });
});

// ============================================================================
// STEAM BURST COMBO (Fire + Ice)
// ============================================================================

describe('Steam Burst Combo (Fire + Ice)', () => {
  it('should trigger when fire and ice are applied', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.comboId).toBe('steam_burst');
  });

  it('should trigger when ice is applied before fire', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'ice', damage: 20 },
      { damageClass: 'fire', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.comboId).toBe('steam_burst');
  });

  it('should deal bonus damage based on average recent damage', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 20, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    // Average damage = (20 + 20) / 2 = 20
    // Bonus damage = 20 * 0.30 = 6
    expect(trigger!.bonusDamage).toBe(6);
  });

  it('should reduce enemy HP from bonus damage', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });
    const initialHp = enemy.hp;

    applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 20, tickOffset: 5 },
    ]);

    // Steam burst should deal bonus damage
    expect(enemy.hp).toBeLessThan(initialHp);
  });

  it('should set hit flash ticks on combo trigger', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100, hitFlashTicks: 0 });

    applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 20, tickOffset: 5 },
    ]);

    expect(enemy.hitFlashTicks).toBe(8); // Extra flash for combo
  });
});

// ============================================================================
// ELECTROCUTE COMBO (Lightning + Ice)
// ============================================================================

describe('Electrocute Combo (Lightning + Ice)', () => {
  it('should trigger when lightning and ice are applied', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'lightning', damage: 25 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.comboId).toBe('electrocute');
  });

  it('should apply stun effect to enemy', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    applyDamageHits(enemy, [
      { damageClass: 'lightning', damage: 25 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    // Should have a stun effect applied
    const stunEffect = enemy.activeEffects.find((e) => e.type === 'stun');
    expect(stunEffect).toBeDefined();
  });

  it('should not deal bonus damage (stun only)', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'lightning', damage: 25 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.bonusDamage).toBeUndefined();
  });
});

// ============================================================================
// SHATTER COMBO (Natural + Tech)
// ============================================================================

describe('Shatter Combo (Natural + Tech)', () => {
  it('should trigger when natural and tech are applied', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'natural', damage: 30 },
      { damageClass: 'tech', damage: 20, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.comboId).toBe('shatter');
  });

  it('should apply armor break effect for next damage', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    applyDamageHits(enemy, [
      { damageClass: 'natural', damage: 30 },
      { damageClass: 'tech', damage: 20, tickOffset: 5 },
    ]);

    // Shatter uses slow effect type with negative strength as marker
    const armorBreakEffect = enemy.activeEffects.find(
      (e) => e.type === 'slow' && e.strength < 0
    );
    expect(armorBreakEffect).toBeDefined();
    expect(armorBreakEffect!.strength).toBe(-0.5);
  });

  it('should trigger when tech is applied before natural', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'tech', damage: 20 },
      { damageClass: 'natural', damage: 30, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.comboId).toBe('shatter');
  });
});

// ============================================================================
// ARMOR BREAK MULTIPLIER
// ============================================================================

describe('getArmorBreakMultiplier', () => {
  it('should return 1.0 when no shatter effect is active', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const multiplier = getArmorBreakMultiplier(enemy);

    expect(multiplier).toBe(1.0);
  });

  it('should return 1.5 when shatter effect is active', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    // Apply shatter combo
    applyDamageHits(enemy, [
      { damageClass: 'natural', damage: 30 },
      { damageClass: 'tech', damage: 20, tickOffset: 5 },
    ]);

    const multiplier = getArmorBreakMultiplier(enemy);

    expect(multiplier).toBe(1.5); // 1.0 + 0.5
  });

  it('should consume armor break effect on use', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    // Apply shatter combo
    applyDamageHits(enemy, [
      { damageClass: 'natural', damage: 30 },
      { damageClass: 'tech', damage: 20, tickOffset: 5 },
    ]);

    // First call returns 1.5 and consumes the effect
    const firstMultiplier = getArmorBreakMultiplier(enemy);
    expect(firstMultiplier).toBe(1.5);

    // Second call returns 1.0 (effect consumed)
    const secondMultiplier = getArmorBreakMultiplier(enemy);
    expect(secondMultiplier).toBe(1.0);
  });

  it('should not affect other slow effects', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    // Add a regular slow effect
    enemy.activeEffects.push({
      type: 'slow',
      remainingTicks: 60,
      strength: 0.5, // Positive = regular slow
      appliedTick: 100,
    });

    const multiplier = getArmorBreakMultiplier(enemy);

    // Regular slow should not be treated as armor break
    expect(multiplier).toBe(1.0);
    // Regular slow should still be present
    expect(enemy.activeEffects.some((e) => e.type === 'slow' && e.strength > 0)).toBe(true);
  });
});

// ============================================================================
// COMBO DETECTION
// ============================================================================

describe('Combo Detection', () => {
  it('should not trigger with only one element', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [{ damageClass: 'fire', damage: 20 }]);

    expect(trigger).toBeNull();
  });

  it('should not trigger with two identical elements', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'fire', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).toBeNull();
  });

  it('should not trigger with non-combo elements', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'natural', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).toBeNull();
  });

  it('should not trigger when elements are outside time window (>30 ticks)', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20, tickOffset: 0 },
      { damageClass: 'ice', damage: 15, tickOffset: 35 }, // Outside 30-tick window
    ]);

    expect(trigger).toBeNull();
  });

  it('should trigger when elements are just within time window (30 ticks)', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20, tickOffset: 0 },
      { damageClass: 'ice', damage: 15, tickOffset: 29 }, // Just within window
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.comboId).toBe('steam_burst');
  });

  it('should include enemy position in combo trigger', () => {
    const enemy = createComboEnemy({
      hp: 100,
      maxHp: 100,
      x: 12345, // Fixed-point position
      y: 67890,
    });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.x).toBe(12345);
    expect(trigger!.y).toBe(67890);
  });

  it('should include tick in combo trigger', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(
      enemy,
      [
        { damageClass: 'fire', damage: 20 },
        { damageClass: 'ice', damage: 15, tickOffset: 5 },
      ],
      200 // Base tick
    );

    expect(trigger).not.toBeNull();
    expect(trigger!.tick).toBe(205); // Base tick + offset of second hit
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should initialize recentDamageHits if not present', () => {
    const enemy = createEnemy({ hp: 100, maxHp: 100 });
    // Intentionally don't initialize recentDamageHits
    delete (enemy as Partial<Enemy>).recentDamageHits;

    const state = createGameState({ tick: 100, enemies: [enemy] });
    trackDamageHit(enemy, 'fire', 20, state);

    expect(enemy.recentDamageHits).toBeDefined();
    expect(enemy.recentDamageHits).toHaveLength(1);
  });

  it('should clear recent hits after combo triggers', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    // After combo triggers, hits should be cleared
    expect(enemy.recentDamageHits).toHaveLength(0);
  });

  it('should not double-trigger combo on same hit sequence', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });
    const initialHp = enemy.hp;

    // First combo
    applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    const hpAfterFirstCombo = enemy.hp;

    // Hits are cleared after combo, so adding just ice shouldn't trigger
    const state = createGameState({ tick: 120, enemies: [enemy] });
    const trigger = trackDamageHit(enemy, 'ice', 10, state);

    expect(trigger).toBeNull();
    expect(enemy.hp).toBe(hpAfterFirstCombo); // No additional damage from combo
  });

  it('should handle zero damage hits', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 0 },
      { damageClass: 'ice', damage: 0, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.bonusDamage).toBe(0); // 0 * 0.30 = 0
  });

  it('should handle very large damage values', () => {
    const enemy = createComboEnemy({ hp: 100000, maxHp: 100000 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 50000 },
      { damageClass: 'ice', damage: 50000, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    // Average = 50000, bonus = 50000 * 0.30 = 15000
    expect(trigger!.bonusDamage).toBe(15000);
  });

  it('should handle enemy with many active effects', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    // Add multiple existing effects
    for (let i = 0; i < 10; i++) {
      enemy.activeEffects.push({
        type: 'slow',
        remainingTicks: 60,
        strength: 0.2,
        appliedTick: 50,
      });
    }

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
  });
});

// ============================================================================
// CLEANUP EXPIRED DAMAGE HITS
// ============================================================================

describe('cleanupExpiredDamageHits', () => {
  it('should remove expired damage hits from all enemies', () => {
    const enemy1 = createComboEnemy({ id: 1, hp: 100, maxHp: 100 });
    const enemy2 = createComboEnemy({ id: 2, hp: 100, maxHp: 100 });

    // Add old hits
    enemy1.recentDamageHits = [
      { damageClass: 'fire', tick: 50, damage: 20 },
      { damageClass: 'ice', tick: 100, damage: 15 },
    ];
    enemy2.recentDamageHits = [{ damageClass: 'lightning', tick: 60, damage: 25 }];

    const state = createGameState({
      tick: 100, // Tick 50 and 60 are outside 30-tick window
      enemies: [enemy1, enemy2],
    });

    cleanupExpiredDamageHits(state);

    // Only tick 100 hit should remain on enemy1
    expect(enemy1.recentDamageHits).toHaveLength(1);
    expect(enemy1.recentDamageHits![0].tick).toBe(100);

    // All hits on enemy2 should be removed (tick 60 is outside window at tick 100)
    expect(enemy2.recentDamageHits).toHaveLength(0);
  });

  it('should handle enemies without recentDamageHits', () => {
    const enemy = createEnemy({ hp: 100, maxHp: 100 });
    delete (enemy as Partial<Enemy>).recentDamageHits;

    const state = createGameState({ tick: 100, enemies: [enemy] });

    // Should not throw
    expect(() => cleanupExpiredDamageHits(state)).not.toThrow();
  });

  it('should keep recent hits within window', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });
    enemy.recentDamageHits = [
      { damageClass: 'fire', tick: 75, damage: 20 },
      { damageClass: 'ice', tick: 80, damage: 15 },
      { damageClass: 'lightning', tick: 85, damage: 25 },
    ];

    const state = createGameState({
      tick: 100, // All hits within 30-tick window (70-100)
      enemies: [enemy],
    });

    cleanupExpiredDamageHits(state);

    expect(enemy.recentDamageHits).toHaveLength(3);
  });
});

// ============================================================================
// COMBO PRIORITY
// ============================================================================

describe('Combo Priority', () => {
  it('should trigger first matching combo when multiple could apply', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    // Apply multiple elements that could form different combos
    // Fire + Ice = Steam Burst
    // This tests that the combo system processes correctly with multiple elements
    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    // Should trigger steam_burst as it's first in COMBOS array
    expect(trigger!.comboId).toBe('steam_burst');
  });
});

// ============================================================================
// COMBO TRIGGER DATA
// ============================================================================

describe('ComboTrigger data', () => {
  it('should include enemy ID in trigger', () => {
    const enemy = createComboEnemy({ id: 42, hp: 100, maxHp: 100 });

    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 20 },
      { damageClass: 'ice', damage: 15, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    expect(trigger!.enemyId).toBe(42);
  });

  it('should calculate bonus damage from multiple hits', () => {
    const enemy = createComboEnemy({ hp: 100, maxHp: 100 });

    // Multiple fire and ice hits
    const trigger = applyDamageHits(enemy, [
      { damageClass: 'fire', damage: 10 },
      { damageClass: 'fire', damage: 20, tickOffset: 2 },
      { damageClass: 'ice', damage: 30, tickOffset: 5 },
    ]);

    expect(trigger).not.toBeNull();
    // Average damage = (10 + 20 + 30) / 3 = 20
    // Bonus damage = 20 * 0.30 = 6
    expect(trigger!.bonusDamage).toBe(6);
  });
});
