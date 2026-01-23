/**
 * Arena Server-Client Verification Tests
 *
 * Tests for scenarios specific to async PvP where:
 * - Server creates challenge with seed
 * - Client runs simulation and reports result
 * - Server verifies by re-running simulation
 *
 * These tests verify the determinism required for anti-cheat.
 */

import { describe, it, expect } from 'vitest';
import {
  ArenaSimulation,
  type ArenaBuildConfig,
  type ArenaHeroConfig,
} from '../../../arena/index.js';

// ============================================================================
// TEST HELPERS
// ============================================================================

function createBuild(
  ownerId: string,
  commanderLevel: number,
  heroIds: string[],
  options: Partial<ArenaBuildConfig> = {}
): ArenaBuildConfig {
  return {
    ownerId,
    ownerName: `Player ${ownerId}`,
    fortressClass: 'fire',
    commanderLevel,
    heroIds,
    ...options,
  };
}

// Simulate what server does
function serverCreateChallenge(
  challengerBuild: ArenaBuildConfig,
  challengedBuild: ArenaBuildConfig
) {
  const seed = Math.floor(Math.random() * 2147483647);
  return {
    seed,
    challengerBuild,
    challengedBuild,
  };
}

// Simulate what client does
function clientRunBattle(
  seed: number,
  leftBuild: ArenaBuildConfig,
  rightBuild: ArenaBuildConfig
) {
  const sim = new ArenaSimulation(seed, leftBuild, rightBuild);
  const result = sim.run();
  return {
    winner: result.winner,
    duration: result.duration,
    leftFinalHp: result.leftStats.finalHp,
    rightFinalHp: result.rightStats.finalHp,
    leftDamage: result.leftStats.damageDealt,
    rightDamage: result.rightStats.damageDealt,
  };
}

// Simulate what server does to verify
function serverVerifyResult(
  seed: number,
  leftBuild: ArenaBuildConfig,
  rightBuild: ArenaBuildConfig,
  clientResult: ReturnType<typeof clientRunBattle>
) {
  const serverResult = clientRunBattle(seed, leftBuild, rightBuild);

  return {
    match:
      serverResult.winner === clientResult.winner &&
      serverResult.duration === clientResult.duration &&
      serverResult.leftFinalHp === clientResult.leftFinalHp &&
      serverResult.rightFinalHp === clientResult.rightFinalHp &&
      serverResult.leftDamage === clientResult.leftDamage &&
      serverResult.rightDamage === clientResult.rightDamage,
    serverResult,
    clientResult,
  };
}

// ============================================================================
// SERVER-CLIENT VERIFICATION TESTS
// ============================================================================

describe('Arena Server-Client Verification', () => {
  describe('Basic Verification', () => {
    it('client and server produce identical results', () => {
      const challengerBuild = createBuild('challenger', 30, ['storm', 'forge']);
      const challengedBuild = createBuild('challenged', 25, ['titan', 'medic']);

      const challenge = serverCreateChallenge(challengerBuild, challengedBuild);

      // Client runs battle
      const clientResult = clientRunBattle(
        challenge.seed,
        challenge.challengerBuild,
        challenge.challengedBuild
      );

      // Server verifies
      const verification = serverVerifyResult(
        challenge.seed,
        challenge.challengerBuild,
        challenge.challengedBuild,
        clientResult
      );

      expect(verification.match).toBe(true);
    });

    it('verification works with many different builds', () => {
      const builds = [
        createBuild('p1', 10, ['scout']),
        createBuild('p2', 20, ['storm', 'forge']),
        createBuild('p3', 30, ['titan', 'vanguard', 'medic']),
        createBuild('p4', 40, ['storm', 'forge', 'titan', 'vanguard']),
        createBuild('p5', 50, ['storm', 'forge', 'titan', 'vanguard'], { damageBonus: 0.5 }),
      ];

      // Test all combinations
      for (let i = 0; i < builds.length; i++) {
        for (let j = 0; j < builds.length; j++) {
          if (i === j) continue;

          const challenge = serverCreateChallenge(builds[i], builds[j]);
          const clientResult = clientRunBattle(
            challenge.seed,
            challenge.challengerBuild,
            challenge.challengedBuild
          );
          const verification = serverVerifyResult(
            challenge.seed,
            challenge.challengerBuild,
            challenge.challengedBuild,
            clientResult
          );

          expect(verification.match).toBe(true);
        }
      }
    });

    it('different seeds produce different battles but same verification', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge']);
      const build2 = createBuild('p2', 30, ['storm', 'forge']);

      const results = [];

      for (let seed = 1; seed <= 5; seed++) {
        const clientResult = clientRunBattle(seed * 12345, build1, build2);
        const verification = serverVerifyResult(seed * 12345, build1, build2, clientResult);

        expect(verification.match).toBe(true);
        results.push(clientResult);
      }
    });
  });

  describe('Tampered Results Detection', () => {
    it('detects tampered winner', () => {
      const build1 = createBuild('p1', 50, ['titan', 'storm', 'forge']);
      const build2 = createBuild('p2', 10, ['scout']);

      const seed = 12345;
      const clientResult = clientRunBattle(seed, build1, build2);

      // Tamper with the result
      const tamperedResult = {
        ...clientResult,
        winner: clientResult.winner === 'left' ? 'right' as const : 'left' as const,
      };

      const verification = serverVerifyResult(seed, build1, build2, tamperedResult);

      expect(verification.match).toBe(false);
    });

    it('detects tampered duration', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge']);
      const build2 = createBuild('p2', 30, ['storm', 'forge']);

      const seed = 12345;
      const clientResult = clientRunBattle(seed, build1, build2);

      // Tamper with duration
      const tamperedResult = {
        ...clientResult,
        duration: clientResult.duration + 100,
      };

      const verification = serverVerifyResult(seed, build1, build2, tamperedResult);

      expect(verification.match).toBe(false);
    });

    it('detects tampered damage values', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge']);
      const build2 = createBuild('p2', 30, ['storm', 'forge']);

      const seed = 12345;
      const clientResult = clientRunBattle(seed, build1, build2);

      // Tamper with damage
      const tamperedResult = {
        ...clientResult,
        leftDamage: clientResult.leftDamage + 1000,
      };

      const verification = serverVerifyResult(seed, build1, build2, tamperedResult);

      expect(verification.match).toBe(false);
    });

    it('detects tampered HP values', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge']);
      const build2 = createBuild('p2', 30, ['storm', 'forge']);

      const seed = 12345;
      const clientResult = clientRunBattle(seed, build1, build2);

      // Tamper with HP
      const tamperedResult = {
        ...clientResult,
        leftFinalHp: clientResult.leftFinalHp + 500,
      };

      const verification = serverVerifyResult(seed, build1, build2, tamperedResult);

      expect(verification.match).toBe(false);
    });
  });

  describe('Build Consistency', () => {
    it('same builds always produce same result with same seed', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge']);
      const build2 = createBuild('p2', 25, ['titan', 'medic']);
      const seed = 999888777;

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(clientRunBattle(seed, build1, build2));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].winner).toBe(results[0].winner);
        expect(results[i].duration).toBe(results[0].duration);
        expect(results[i].leftFinalHp).toBe(results[0].leftFinalHp);
        expect(results[i].rightFinalHp).toBe(results[0].rightFinalHp);
        expect(results[i].leftDamage).toBe(results[0].leftDamage);
        expect(results[i].rightDamage).toBe(results[0].rightDamage);
      }
    });
  });

  describe('Hero Configuration Verification', () => {
    it('verifies battles with hero tiers', () => {
      const heroConfigs1: ArenaHeroConfig[] = [
        { heroId: 'storm', tier: 3 },
        { heroId: 'forge', tier: 2 },
      ];
      const heroConfigs2: ArenaHeroConfig[] = [
        { heroId: 'titan', tier: 1 },
        { heroId: 'medic', tier: 1 },
      ];

      const build1 = createBuild('p1', 30, ['storm', 'forge'], { heroConfigs: heroConfigs1 });
      const build2 = createBuild('p2', 30, ['titan', 'medic'], { heroConfigs: heroConfigs2 });

      const seed = 55555;
      const clientResult = clientRunBattle(seed, build1, build2);
      const verification = serverVerifyResult(seed, build1, build2, clientResult);

      expect(verification.match).toBe(true);
    });

    it('tier difference affects results deterministically', () => {
      const tier1Build = createBuild('p1', 30, ['storm'], {
        heroConfigs: [{ heroId: 'storm', tier: 1 }],
      });
      const tier3Build = createBuild('p2', 30, ['storm'], {
        heroConfigs: [{ heroId: 'storm', tier: 3 }],
      });

      const seed = 77777;

      // Tier 3 should consistently beat Tier 1
      const result1 = clientRunBattle(seed, tier1Build, tier3Build);
      const result2 = clientRunBattle(seed, tier3Build, tier1Build);

      // Both should verify
      expect(serverVerifyResult(seed, tier1Build, tier3Build, result1).match).toBe(true);
      expect(serverVerifyResult(seed, tier3Build, tier1Build, result2).match).toBe(true);

      // Results should be consistent with tier advantage
      expect(result2.winner).toBe('left'); // Tier 3 on left wins
    });
  });

  describe('Fortress Class Verification', () => {
    it('verifies battles with different fortress classes', () => {
      const classes = ['fire', 'ice', 'lightning', 'tech', 'natural', 'void', 'plasma'] as const;

      for (const class1 of classes) {
        for (const class2 of classes) {
          const build1 = createBuild('p1', 30, ['storm', 'forge'], { fortressClass: class1 });
          const build2 = createBuild('p2', 30, ['storm', 'forge'], { fortressClass: class2 });

          const seed = 11111;
          const clientResult = clientRunBattle(seed, build1, build2);
          const verification = serverVerifyResult(seed, build1, build2, clientResult);

          expect(verification.match).toBe(true);
        }
      }
    });
  });

  describe('Bonus Verification', () => {
    it('verifies battles with damage bonuses', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge'], { damageBonus: 0.5 });
      const build2 = createBuild('p2', 30, ['storm', 'forge'], { damageBonus: 0 });

      const seed = 22222;
      const clientResult = clientRunBattle(seed, build1, build2);
      const verification = serverVerifyResult(seed, build1, build2, clientResult);

      expect(verification.match).toBe(true);
      // Player with damage bonus should deal more damage
      expect(clientResult.leftDamage).toBeGreaterThan(clientResult.rightDamage);
    });

    it('verifies battles with HP bonuses', () => {
      const build1 = createBuild('p1', 30, ['storm', 'forge'], { hpBonus: 1.0 });
      const build2 = createBuild('p2', 30, ['storm', 'forge'], { hpBonus: 0 });

      const seed = 33333;
      const clientResult = clientRunBattle(seed, build1, build2);
      const verification = serverVerifyResult(seed, build1, build2, clientResult);

      expect(verification.match).toBe(true);
    });
  });
});

// ============================================================================
// STRESS TESTS
// ============================================================================

describe('Arena Stress Tests', () => {
  it('handles 100 consecutive verifications', () => {
    const builds = [
      createBuild('p1', 20, ['storm', 'forge']),
      createBuild('p2', 25, ['titan', 'medic']),
      createBuild('p3', 30, ['vanguard', 'pyro']),
    ];

    for (let i = 0; i < 100; i++) {
      const build1 = builds[i % builds.length];
      const build2 = builds[(i + 1) % builds.length];
      const seed = i * 12345 + 1;

      const clientResult = clientRunBattle(seed, build1, build2);
      const verification = serverVerifyResult(seed, build1, build2, clientResult);

      expect(verification.match).toBe(true);
    }
  });

  it('verification is consistent across multiple runs', () => {
    const build1 = createBuild('p1', 30, ['storm', 'forge', 'titan']);
    const build2 = createBuild('p2', 30, ['vanguard', 'medic', 'pyro']);
    const seed = 987654321;

    // Run verification 50 times
    const verifications = [];
    for (let i = 0; i < 50; i++) {
      const clientResult = clientRunBattle(seed, build1, build2);
      const verification = serverVerifyResult(seed, build1, build2, clientResult);
      verifications.push(verification);
    }

    // All should match
    for (const v of verifications) {
      expect(v.match).toBe(true);
    }

    // All server results should be identical
    for (let i = 1; i < verifications.length; i++) {
      expect(verifications[i].serverResult).toEqual(verifications[0].serverResult);
    }
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe('Arena Edge Cases', () => {
  it('handles very large seed values', () => {
    const build1 = createBuild('p1', 30, ['storm']);
    const build2 = createBuild('p2', 30, ['forge']);

    const largeSeeds = [2147483646, 2147483647, 1000000000, 999999999];

    for (const seed of largeSeeds) {
      const clientResult = clientRunBattle(seed, build1, build2);
      const verification = serverVerifyResult(seed, build1, build2, clientResult);

      expect(verification.match).toBe(true);
    }
  });

  it('handles seed value of 1', () => {
    const build1 = createBuild('p1', 30, ['storm']);
    const build2 = createBuild('p2', 30, ['forge']);

    const clientResult = clientRunBattle(1, build1, build2);
    const verification = serverVerifyResult(1, build1, build2, clientResult);

    expect(verification.match).toBe(true);
  });

  it('handles single hero vs multiple heroes', () => {
    const singleHero = createBuild('p1', 50, ['titan'], { damageBonus: 2, hpBonus: 2 });
    const multiHero = createBuild('p2', 30, ['scout', 'scout', 'scout', 'scout']);

    const seed = 44444;
    const clientResult = clientRunBattle(seed, singleHero, multiHero);
    const verification = serverVerifyResult(seed, singleHero, multiHero, clientResult);

    expect(verification.match).toBe(true);
  });

  it('handles extreme power differences', () => {
    const strongBuild = createBuild('p1', 100, ['titan', 'storm', 'forge', 'vanguard'], {
      damageBonus: 5,
      hpBonus: 5,
    });
    const weakBuild = createBuild('p2', 1, ['scout']);

    const seed = 55555;
    const clientResult = clientRunBattle(seed, strongBuild, weakBuild);
    const verification = serverVerifyResult(seed, strongBuild, weakBuild, clientResult);

    expect(verification.match).toBe(true);
    expect(clientResult.winner).toBe('left');
  });
});
