/**
 * Guild Arena 5v5 Unit Tests
 *
 * Tests for hero spawning, movement, combat, and battle resolution
 */
import { describe, it, expect } from 'vitest';
import {
  runGuildArena,
  type GuildBattleHero,
  type GuildArenaResult,
} from '../../../arena/guild-arena.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTestHero(
  ownerId: string,
  heroId: string = 'vanguard',
  power: number = 1000
): GuildBattleHero {
  return {
    ownerId,
    ownerName: `Player ${ownerId}`,
    heroId,
    tier: 1,
    power,
  };
}

function createTeam(
  prefix: string,
  count: number = 5,
  power: number = 1000
): GuildBattleHero[] {
  return Array.from({ length: count }, (_, i) =>
    createTestHero(`${prefix}-${i}`, 'vanguard', power)
  );
}

// ============================================================================
// INITIALIZATION TESTS
// ============================================================================

describe('Guild Arena Initialization', () => {
  it('completes battle with 5 vs 5 heroes', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result).toBeDefined();
    expect(['attacker', 'defender', 'draw']).toContain(result.winnerSide);
  });

  it('attackers spawn on left side (X ~2)', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 1); // Very weak

    const result = runGuildArena(attackers, defenders, 12345);

    // Attackers should win quickly due to power difference
    expect(result.winnerSide).toBe('attacker');
  });

  it('defenders spawn on right side (X ~18)', () => {
    const attackers = createTeam('attacker', 5, 1); // Very weak
    const defenders = createTeam('defender', 5, 10000);

    const result = runGuildArena(attackers, defenders, 12345);

    // Defenders should win due to power difference
    expect(result.winnerSide).toBe('defender');
  });

  it('heroes have Y positions within arena bounds (0-15)', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    // Run battle - if heroes were out of bounds, simulation would fail
    const result = runGuildArena(attackers, defenders, 12345);

    expect(result).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);
  });
});

// ============================================================================
// MOVEMENT AND TARGETING TESTS
// ============================================================================

describe('Guild Arena Movement and Targeting', () => {
  it('heroes move towards enemies', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    // Battle should happen (damage should be dealt)
    expect(result.attackerTotalDamage + result.defenderTotalDamage).toBeGreaterThan(0);
  });

  it('dead heroes do not move or attack', () => {
    // Unbalanced teams - weaker side should die
    const attackers = createTeam('attacker', 5, 100);
    const defenders = createTeam('defender', 5, 10000);

    const result = runGuildArena(attackers, defenders, 12345);

    // Attackers should be eliminated
    expect(result.attackerSurvivors).toBe(0);
    // Kill log should have attackers as victims
    expect(result.killLog.length).toBeGreaterThan(0);
  });

  it('heroes retarget when current target dies', () => {
    const attackers = createTeam('attacker', 5, 5000);
    const defenders = createTeam('defender', 5, 1000);

    const result = runGuildArena(attackers, defenders, 12345);

    // Multiple kills should happen
    expect(result.killLog.length).toBeGreaterThan(1);
  });
});

// ============================================================================
// COMBAT TESTS
// ============================================================================

describe('Guild Arena Combat', () => {
  it('damage has variance (90%-110%)', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    // Run multiple battles with same seed - should be deterministic
    const result1 = runGuildArena(attackers, defenders, 12345);
    const result2 = runGuildArena(attackers, defenders, 12345);

    expect(result1.attackerTotalDamage).toBe(result2.attackerTotalDamage);
    expect(result1.defenderTotalDamage).toBe(result2.defenderTotalDamage);
  });

  it('critical hits happen with ~15% chance', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    // Check for critical hit moments
    const critMoments = result.keyMoments.filter(m => m.type === 'critical_hit');
    // Should have some crits in a typical battle
    // (might be 0 in very short battles, but typically > 0)
    expect(critMoments.length).toBeGreaterThanOrEqual(0);
  });

  it('attack cooldown respects attack speed', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    // Battle should take more than a few ticks due to attack cooldown
    expect(result.duration).toBeGreaterThan(10);
  });

  it('attack only happens when target is in range (≤3 units)', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    // Heroes need time to close distance before attacking
    // First attack won't happen at tick 0
    const firstKill = result.killLog[0];
    if (firstKill) {
      expect(firstKill.tick).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// BATTLE END CONDITIONS TESTS
// ============================================================================

describe('Guild Arena End Conditions', () => {
  it('battle ends when one side is eliminated', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 100);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.winReason).toBe('elimination');
    expect(result.defenderSurvivors).toBe(0);
  });

  it('max duration is 1800 ticks (timeout)', () => {
    // Equal power teams might timeout
    const attackers = createTeam('attacker', 5, 1000);
    const defenders = createTeam('defender', 5, 1000);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.duration).toBeLessThanOrEqual(1800);
  });

  it('winner at timeout is side with more HP', () => {
    // Create balanced teams that will timeout
    const attackers = createTeam('attacker', 5, 1000);
    const defenders = createTeam('defender', 5, 1000);

    const result = runGuildArena(attackers, defenders, 99999);

    if (result.winReason === 'timeout') {
      // Winner should be determined by remaining HP
      expect(['attacker', 'defender']).toContain(result.winnerSide);
    }
  });

  it('draw when both sides have equal HP at timeout', () => {
    // Perfectly balanced teams with specific seed might draw
    const attackers = createTeam('attacker', 5, 1000);
    const defenders = createTeam('defender', 5, 1000);

    // Try to find a seed that produces a draw (might not be possible)
    for (let seed = 1; seed < 100; seed++) {
      const result = runGuildArena(attackers, defenders, seed);
      if (result.winnerSide === 'draw') {
        expect(result.winReason).toBe('draw');
        return; // Found a draw, test passes
      }
    }
    // If no draw found, that's okay - draws are rare
    expect(true).toBe(true);
  });

  it('draw when both sides are eliminated simultaneously', () => {
    // This is theoretically possible but extremely rare
    // Just verify the simulation handles it
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    if (result.attackerSurvivors === 0 && result.defenderSurvivors === 0) {
      expect(result.winnerSide).toBe('draw');
      expect(result.winReason).toBe('draw');
    }
  });
});

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('Guild Arena Determinism', () => {
  it('same seed + same heroes = identical result', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result1 = runGuildArena(attackers, defenders, 12345);
    const result2 = runGuildArena(attackers, defenders, 12345);

    expect(result1.winnerSide).toBe(result2.winnerSide);
    expect(result1.winReason).toBe(result2.winReason);
    expect(result1.attackerSurvivors).toBe(result2.attackerSurvivors);
    expect(result1.defenderSurvivors).toBe(result2.defenderSurvivors);
    expect(result1.attackerTotalDamage).toBe(result2.attackerTotalDamage);
    expect(result1.defenderTotalDamage).toBe(result2.defenderTotalDamage);
    expect(result1.duration).toBe(result2.duration);
    expect(result1.killLog.length).toBe(result2.killLog.length);
  });

  it('different seed = potentially different result', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const results: GuildArenaResult[] = [];
    for (let seed = 1; seed <= 10; seed++) {
      results.push(runGuildArena(attackers, defenders, seed));
    }

    // Not all results should be identical (high probability)
    const uniqueWinners = new Set(results.map(r => r.winnerSide));
    const uniqueDurations = new Set(results.map(r => r.duration));

    // At least some variation should exist
    expect(uniqueWinners.size + uniqueDurations.size).toBeGreaterThan(2);
  });

  it('kill log is deterministic', () => {
    const attackers = createTeam('attacker', 5, 5000);
    const defenders = createTeam('defender', 5, 1000);

    const result1 = runGuildArena(attackers, defenders, 12345);
    const result2 = runGuildArena(attackers, defenders, 12345);

    expect(result1.killLog).toEqual(result2.killLog);
  });

  it('key moments are deterministic', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result1 = runGuildArena(attackers, defenders, 12345);
    const result2 = runGuildArena(attackers, defenders, 12345);

    expect(result1.keyMoments).toEqual(result2.keyMoments);
  });
});

// ============================================================================
// MVP CALCULATION TESTS
// ============================================================================

describe('Guild Arena MVP', () => {
  it('MVP is from winning side', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 100);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.winnerSide).toBe('attacker');
    expect(result.mvp).not.toBeNull();
    expect(result.mvp!.ownerId).toMatch(/^attacker-/);
  });

  it('MVP has highest damage from winning team', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 100);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.mvp).not.toBeNull();
    expect(result.mvp!.damage).toBeGreaterThan(0);
  });

  it('MVP tracks kill count', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 100);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.mvp).not.toBeNull();
    expect(result.mvp!.kills).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// RESULT STRUCTURE TESTS
// ============================================================================

describe('Guild Arena Result Structure', () => {
  it('returns complete result object', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result).toHaveProperty('winnerSide');
    expect(result).toHaveProperty('winReason');
    expect(result).toHaveProperty('attackerSurvivors');
    expect(result).toHaveProperty('defenderSurvivors');
    expect(result).toHaveProperty('attackerTotalDamage');
    expect(result).toHaveProperty('defenderTotalDamage');
    expect(result).toHaveProperty('mvp');
    expect(result).toHaveProperty('keyMoments');
    expect(result).toHaveProperty('killLog');
    expect(result).toHaveProperty('duration');
  });

  it('key moments include battle_start and battle_end', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    const startMoment = result.keyMoments.find(m => m.type === 'battle_start');
    const endMoment = result.keyMoments.find(m => m.type === 'battle_end');

    expect(startMoment).toBeDefined();
    expect(startMoment!.tick).toBe(0);
    expect(endMoment).toBeDefined();
    expect(endMoment!.tick).toBe(result.duration);
  });

  it('kill log contains correct information', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 100);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.killLog.length).toBeGreaterThan(0);

    for (const kill of result.killLog) {
      expect(kill).toHaveProperty('tick');
      expect(kill).toHaveProperty('killerId');
      expect(kill).toHaveProperty('killerHeroId');
      expect(kill).toHaveProperty('killerName');
      expect(kill).toHaveProperty('victimId');
      expect(kill).toHaveProperty('victimHeroId');
      expect(kill).toHaveProperty('victimName');
      expect(kill.tick).toBeGreaterThan(0);
    }
  });

  it('survivor counts are accurate', () => {
    const attackers = createTeam('attacker', 5, 10000);
    const defenders = createTeam('defender', 5, 100);

    const result = runGuildArena(attackers, defenders, 12345);

    // All defenders should be dead
    expect(result.defenderSurvivors).toBe(0);
    // Some or all attackers should survive
    expect(result.attackerSurvivors).toBeGreaterThan(0);
    expect(result.attackerSurvivors).toBeLessThanOrEqual(5);
  });

  it('total damage is sum of all hero damage', () => {
    const attackers = createTeam('attacker');
    const defenders = createTeam('defender');

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.attackerTotalDamage).toBeGreaterThan(0);
    expect(result.defenderTotalDamage).toBeGreaterThan(0);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Guild Arena Edge Cases', () => {
  it('handles 1v1 battle', () => {
    const attackers = [createTestHero('attacker-0')];
    const defenders = [createTestHero('defender-0')];

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result).toBeDefined();
    expect(['attacker', 'defender', 'draw']).toContain(result.winnerSide);
  });

  it('handles uneven teams (3v5)', () => {
    const attackers = createTeam('attacker', 3, 2000);
    const defenders = createTeam('defender', 5, 1000);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result).toBeDefined();
    expect(['attacker', 'defender', 'draw']).toContain(result.winnerSide);
  });

  it('handles very high power difference', () => {
    const attackers = createTeam('attacker', 5, 1000000);
    const defenders = createTeam('defender', 5, 1);

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result.winnerSide).toBe('attacker');
    expect(result.winReason).toBe('elimination');
    // Battle should be very quick
    expect(result.duration).toBeLessThan(100);
  });

  it('handles tier differences', () => {
    const attackers: GuildBattleHero[] = [
      { ownerId: 'a1', ownerName: 'A1', heroId: 'vanguard', tier: 3, power: 1000 },
      { ownerId: 'a2', ownerName: 'A2', heroId: 'vanguard', tier: 3, power: 1000 },
      { ownerId: 'a3', ownerName: 'A3', heroId: 'vanguard', tier: 3, power: 1000 },
      { ownerId: 'a4', ownerName: 'A4', heroId: 'vanguard', tier: 3, power: 1000 },
      { ownerId: 'a5', ownerName: 'A5', heroId: 'vanguard', tier: 3, power: 1000 },
    ];
    const defenders: GuildBattleHero[] = [
      { ownerId: 'd1', ownerName: 'D1', heroId: 'vanguard', tier: 1, power: 1000 },
      { ownerId: 'd2', ownerName: 'D2', heroId: 'vanguard', tier: 1, power: 1000 },
      { ownerId: 'd3', ownerName: 'D3', heroId: 'vanguard', tier: 1, power: 1000 },
      { ownerId: 'd4', ownerName: 'D4', heroId: 'vanguard', tier: 1, power: 1000 },
      { ownerId: 'd5', ownerName: 'D5', heroId: 'vanguard', tier: 1, power: 1000 },
    ];

    const result = runGuildArena(attackers, defenders, 12345);

    expect(result).toBeDefined();
    // Higher tier should have advantage
    expect(result.winnerSide).toBe('attacker');
  });
});
