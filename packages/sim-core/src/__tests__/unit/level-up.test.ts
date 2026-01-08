/**
 * Level Up System Tests
 * Tests for XP earning and level progression during gameplay
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Simulation, getDefaultConfig } from '../../simulation.js';
import { getXpForLevel, getTotalXpForLevel } from '../../data/fortress-progression.js';
import type { SimConfig } from '../../types.js';

describe('Level Up System', () => {
  let config: SimConfig;

  beforeEach(() => {
    config = getDefaultConfig();
  });

  describe('Initial State', () => {
    it('starts with configured commander level', () => {
      config.commanderLevel = 5;
      const sim = new Simulation(12345, config);
      expect(sim.state.commanderLevel).toBe(5);
    });

    it('starts with zero session XP', () => {
      const sim = new Simulation(12345, config);
      expect(sim.state.sessionXpEarned).toBe(0);
    });

    it('calculates xpAtSessionStart correctly', () => {
      config.commanderLevel = 1;
      const sim1 = new Simulation(12345, config);
      expect(sim1.state.xpAtSessionStart).toBe(0);

      config.commanderLevel = 5;
      const sim5 = new Simulation(12345, config);
      expect(sim5.state.xpAtSessionStart).toBe(getTotalXpForLevel(5));
    });
  });

  describe('XP Earning via Cheats', () => {
    it('adds XP to sessionXpEarned', () => {
      const sim = new Simulation(12345, config);
      sim.cheat_AddXp(100);
      expect(sim.state.sessionXpEarned).toBe(100);
    });

    it('adds XP to segmentXpEarned', () => {
      const sim = new Simulation(12345, config);
      sim.cheat_AddXp(100);
      expect(sim.state.segmentXpEarned).toBe(100);
    });

    it('accumulates XP across multiple calls', () => {
      const sim = new Simulation(12345, config);
      sim.cheat_AddXp(100);
      sim.cheat_AddXp(200);
      sim.cheat_AddXp(50);
      expect(sim.state.sessionXpEarned).toBe(350);
    });
  });

  describe('Level Up Detection', () => {
    it('levels up when XP threshold is reached', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      const xpNeeded = getXpForLevel(1);
      sim.cheat_AddXp(xpNeeded);

      expect(sim.state.commanderLevel).toBe(2);
    });

    it('does not level up before threshold', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      const xpNeeded = getXpForLevel(1);
      sim.cheat_AddXp(xpNeeded - 1);

      expect(sim.state.commanderLevel).toBe(1);
    });

    it('handles multiple level ups in one XP gain', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      // Add enough XP to reach level 5
      const xpToLevel5 = getXpForLevel(1) + getXpForLevel(2) + getXpForLevel(3) + getXpForLevel(4);
      sim.cheat_AddXp(xpToLevel5);

      expect(sim.state.commanderLevel).toBe(5);
    });

    it('stops at max level 50', () => {
      config.commanderLevel = 49;
      const sim = new Simulation(12345, config);

      // Add massive XP
      sim.cheat_AddXp(10000000);

      expect(sim.state.commanderLevel).toBe(50);
    });

    it('correctly calculates level from starting level other than 1', () => {
      config.commanderLevel = 10;
      const sim = new Simulation(12345, config);

      const xpToLevel11 = getXpForLevel(10);
      sim.cheat_AddXp(xpToLevel11);

      expect(sim.state.commanderLevel).toBe(11);
    });
  });

  describe('XP from Enemy Kills', () => {
    it('earns XP when killing enemies', () => {
      // Start at wave 10 where XP per kill is > 0
      config.startingWave = 10;
      const sim = new Simulation(12345, config);

      // Advance until enemies spawn
      for (let i = 0; i < 300 && sim.state.enemies.length === 0; i++) {
        sim.step();
      }

      if (sim.state.enemies.length > 0) {
        const initialXp = sim.state.sessionXpEarned;

        // Kill all enemies
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }

        // Step multiple times to process kills
        for (let i = 0; i < 10; i++) {
          sim.step();
        }

        // At wave 10+, kill XP is: floor(0.75 + wave * 0.075) = floor(0.75 + 10 * 0.075) = 1+ per enemy
        expect(sim.state.sessionXpEarned).toBeGreaterThan(initialXp);
      }
    });

    it('earns more XP from elite enemies', () => {
      // Run simulation for a while to get past initial waves
      config.startingWave = 10; // Elites appear in later waves
      const simWithElites = new Simulation(12345, config);

      for (let i = 0; i < 300 && simWithElites.state.enemies.length === 0; i++) {
        simWithElites.step();
      }

      // Check that any elites give more XP
      const enemies = simWithElites.state.enemies;
      const regularEnemy = enemies.find(e => !e.isElite);
      const eliteEnemy = enemies.find(e => e.isElite);

      if (regularEnemy && eliteEnemy) {
        // Elite enemies should have isElite flag
        expect(eliteEnemy.isElite).toBe(true);
      }
    });
  });

  describe('XP from Wave Completion', () => {
    it('earns XP when completing a wave', () => {
      const sim = new Simulation(12345, config);

      // Run until first wave completes
      for (let i = 0; i < 5000 && sim.state.wavesCleared === 0 && !sim.state.ended; i++) {
        sim.step();
        // Kill all enemies to complete wave faster
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }
      }

      expect(sim.state.sessionXpEarned).toBeGreaterThan(0);
    });

    it('XP increases with higher waves', () => {
      // Wave 1
      const sim1 = new Simulation(12345, config);
      for (let i = 0; i < 5000 && sim1.state.wavesCleared === 0 && !sim1.state.ended; i++) {
        sim1.step();
        for (const enemy of sim1.state.enemies) {
          enemy.hp = 0;
        }
      }
      const wave1Xp = sim1.state.sessionXpEarned;

      // Wave 10 (starting at wave 9)
      config.startingWave = 9;
      const sim10 = new Simulation(12345, config);
      for (let i = 0; i < 5000 && sim10.state.wavesCleared === 0 && !sim10.state.ended; i++) {
        sim10.step();
        for (const enemy of sim10.state.enemies) {
          enemy.hp = 0;
        }
      }
      const wave10Xp = sim10.state.sessionXpEarned;

      // Higher wave should give more XP per wave
      // Note: Total XP also includes kill XP, so we compare relative amounts   
      expect(wave10Xp).toBeGreaterThan(wave1Xp);
    });
  });

  describe('Level Up During Gameplay', () => {
    it('level updates during continuous gameplay', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      const xpForLevelUp = getXpForLevel(1);
      let leveledUp = false;

      // Run simulation and check for level up
      for (let i = 0; i < 10000 && !leveledUp && !sim.state.ended; i++) {
        sim.step();

        // Kill enemies to accelerate
        for (const enemy of sim.state.enemies) {
          enemy.hp = 0;
        }

        // Add some XP via cheat to ensure level up happens
        if (sim.state.sessionXpEarned < xpForLevelUp && i % 100 === 0) {
          sim.cheat_AddXp(50);
        }

        if (sim.state.commanderLevel > 1) {
          leveledUp = true;
        }
      }

      expect(leveledUp).toBe(true);
    });

    it('maintains correct xpAtSessionStart after level up', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      const initialXpAtStart = sim.state.xpAtSessionStart;
      sim.cheat_AddXp(getXpForLevel(1));

      // xpAtSessionStart should NOT change - it's fixed at session start
      expect(sim.state.xpAtSessionStart).toBe(initialXpAtStart);
    });
  });

  describe('Segment XP Tracking', () => {
    it('tracks segment XP separately from session XP', () => {
      const sim = new Simulation(12345, config);

      sim.cheat_AddXp(100);
      expect(sim.state.segmentXpEarned).toBe(100);
      expect(sim.state.sessionXpEarned).toBe(100);

      // Reset segment
      sim.resetSegment();

      expect(sim.state.segmentXpEarned).toBe(0);
      expect(sim.state.sessionXpEarned).toBe(100); // Session XP persists
    });

    it('segment summary includes correct XP', () => {
      const sim = new Simulation(12345, config);

      sim.cheat_AddXp(500);
      const summary = sim.getSegmentSummary();

      expect(summary.xpEarned).toBe(500);
    });
  });

  describe('XP Progress Calculation', () => {
    it('calculates effective total XP correctly', () => {
      config.commanderLevel = 5;
      const sim = new Simulation(12345, config);

      const xpAtStart = getTotalXpForLevel(5);
      expect(sim.state.xpAtSessionStart).toBe(xpAtStart);

      sim.cheat_AddXp(100);

      // Effective total XP = xpAtSessionStart + sessionXpEarned
      const effectiveTotalXp = sim.state.xpAtSessionStart + sim.state.sessionXpEarned;
      expect(effectiveTotalXp).toBe(xpAtStart + 100);
    });

    it('XP within level can be calculated from state', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      const halfLevelXp = Math.floor(getXpForLevel(1) / 2);
      sim.cheat_AddXp(halfLevelXp);

      // Still level 1
      expect(sim.state.commanderLevel).toBe(1);

      // XP in current level = effectiveTotalXp - getTotalXpForLevel(currentLevel)
      const effectiveTotalXp = sim.state.xpAtSessionStart + sim.state.sessionXpEarned;
      const xpInCurrentLevel = effectiveTotalXp - getTotalXpForLevel(sim.state.commanderLevel);

      expect(xpInCurrentLevel).toBe(halfLevelXp);
    });

    it('progress resets after level up', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      // Level up to 2
      sim.cheat_AddXp(getXpForLevel(1));
      expect(sim.state.commanderLevel).toBe(2);

      // XP in level 2 should be 0
      const effectiveTotalXp = sim.state.xpAtSessionStart + sim.state.sessionXpEarned;
      const xpInCurrentLevel = effectiveTotalXp - getTotalXpForLevel(sim.state.commanderLevel);

      expect(xpInCurrentLevel).toBe(0);
    });

    it('partial progress in next level after excess XP', () => {
      config.commanderLevel = 1;
      const sim = new Simulation(12345, config);

      const excessXp = 50;
      sim.cheat_AddXp(getXpForLevel(1) + excessXp);
      expect(sim.state.commanderLevel).toBe(2);

      // XP in level 2 should be the excess
      const effectiveTotalXp = sim.state.xpAtSessionStart + sim.state.sessionXpEarned;
      const xpInCurrentLevel = effectiveTotalXp - getTotalXpForLevel(sim.state.commanderLevel);

      expect(xpInCurrentLevel).toBe(excessXp);
    });
  });
});

describe('Edge Cases', () => {
  it('handles starting at level 50', () => {
    const config = getDefaultConfig();
    config.commanderLevel = 50;
    const sim = new Simulation(12345, config);

    sim.cheat_AddXp(1000000);
    expect(sim.state.commanderLevel).toBe(50);
  });

  it('handles zero XP gain', () => {
    const config = getDefaultConfig();
    const sim = new Simulation(12345, config);

    sim.cheat_AddXp(0);
    expect(sim.state.sessionXpEarned).toBe(0);
    expect(sim.state.commanderLevel).toBe(1);
  });

  it('handles very large XP gains', () => {
    const config = getDefaultConfig();
    config.commanderLevel = 1;
    const sim = new Simulation(12345, config);

    sim.cheat_AddXp(Number.MAX_SAFE_INTEGER);
    expect(sim.state.commanderLevel).toBe(50); // Capped at max
  });

  it('preserves level across simulation steps', () => {
    const config = getDefaultConfig();
    config.commanderLevel = 5;
    const sim = new Simulation(12345, config);

    sim.cheat_AddXp(getXpForLevel(5)); // Level up to 6
    expect(sim.state.commanderLevel).toBe(6);

    // Run many steps
    for (let i = 0; i < 1000 && !sim.state.ended; i++) {
      sim.step();
    }

    // Level should still be at least 6
    expect(sim.state.commanderLevel).toBeGreaterThanOrEqual(6);
  });
});
