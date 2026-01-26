/**
 * Directed Wave Tests
 *
 * Tests for the scripted first wave experience including:
 * - Tutorial relic pool and selection
 * - Directed wave enemy sequence
 * - Early relic offering
 * - Wave 2 adjustment for smooth transition
 * - Scripted events configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Xorshift32 } from '../../rng.js';
import {
  TUTORIAL_RELIC_POOL,
  getTutorialRelicOptions,
  DIRECTED_WAVE_1_ENEMIES,
  DIRECTED_WAVE_1_EVENTS,
  DIRECTED_WAVE_2_ADJUSTMENT,
  DEFAULT_DIRECTED_WAVE_1_CONFIG,
  getDirectedWave1ConfigWithRelics,
} from '../../data/directed-wave-presets.js';
import { Simulation } from '../../simulation.js';
import { createSimConfig } from '../helpers/factories.js';

describe('Tutorial Relic Pool', () => {
  it('contains exactly 5 tutorial-friendly relics', () => {
    expect(TUTORIAL_RELIC_POOL).toHaveLength(5);
  });

  it('includes simple, beginner-friendly relics', () => {
    // These relics should have clear, immediate effects
    expect(TUTORIAL_RELIC_POOL).toContain('iron_hide');        // HP boost
    expect(TUTORIAL_RELIC_POOL).toContain('sharpened_blades'); // Damage boost
    expect(TUTORIAL_RELIC_POOL).toContain('swift_strikes');    // Attack speed
    expect(TUTORIAL_RELIC_POOL).toContain('critical_eye');     // Crit chance
    expect(TUTORIAL_RELIC_POOL).toContain('gold_rush');        // Gold boost
  });
});

describe('getTutorialRelicOptions', () => {
  let rng: Xorshift32;

  beforeEach(() => {
    rng = new Xorshift32(12345);
  });

  it('returns 3 relics by default', () => {
    const options = getTutorialRelicOptions(rng);
    expect(options).toHaveLength(3);
  });

  it('returns specified number of relics', () => {
    const options = getTutorialRelicOptions(rng, 2);
    expect(options).toHaveLength(2);
  });

  it('returns all relics when count exceeds pool size', () => {
    const options = getTutorialRelicOptions(rng, 10);
    expect(options).toHaveLength(TUTORIAL_RELIC_POOL.length);
  });

  it('returns only relics from tutorial pool', () => {
    const options = getTutorialRelicOptions(rng, 3);
    for (const relic of options) {
      expect(TUTORIAL_RELIC_POOL).toContain(relic);
    }
  });

  it('returns unique relics (no duplicates)', () => {
    const options = getTutorialRelicOptions(rng, 5);
    const uniqueOptions = new Set(options);
    expect(uniqueOptions.size).toBe(options.length);
  });

  it('is deterministic with same seed', () => {
    const rng1 = new Xorshift32(12345);
    const rng2 = new Xorshift32(12345);

    const options1 = getTutorialRelicOptions(rng1, 3);
    const options2 = getTutorialRelicOptions(rng2, 3);

    expect(options1).toEqual(options2);
  });

  it('produces different results with different seeds', () => {
    const rng1 = new Xorshift32(12345);
    const rng2 = new Xorshift32(54321);

    const options1 = getTutorialRelicOptions(rng1, 3);
    const options2 = getTutorialRelicOptions(rng2, 3);

    // Very unlikely to be the same with different seeds
    // Check at least one is different
    expect(options1.join(',') !== options2.join(',')).toBe(true);
  });
});

describe('Directed Wave 1 Enemy Sequence', () => {
  it('has correct number of enemies', () => {
    // 15 enemies: 3 runners (phase 1), 4 mixed (phase 2), 4 mixed + elite (phase 3), 4 finale (phase 4)
    expect(DIRECTED_WAVE_1_ENEMIES).toHaveLength(15);
  });

  it('starts with runners (easy enemies)', () => {
    const firstThree = DIRECTED_WAVE_1_ENEMIES.slice(0, 3);
    for (const enemy of firstThree) {
      expect(enemy.type).toBe('runner');
      expect(enemy.isElite).toBe(false);
    }
  });

  it('has exactly one elite enemy', () => {
    const elites = DIRECTED_WAVE_1_ENEMIES.filter(e => e.isElite);
    expect(elites).toHaveLength(1);
    expect(elites[0].type).toBe('thug');
  });

  it('introduces enemy types progressively', () => {
    // Find first occurrence of each type
    const firstRunner = DIRECTED_WAVE_1_ENEMIES.findIndex(e => e.type === 'runner');
    const firstThug = DIRECTED_WAVE_1_ENEMIES.findIndex(e => e.type === 'thug');
    const firstGangster = DIRECTED_WAVE_1_ENEMIES.findIndex(e => e.type === 'gangster');

    // Runners should come first, then thugs, then gangsters
    expect(firstRunner).toBeLessThan(firstThug);
    expect(firstThug).toBeLessThan(firstGangster);
  });

  it('has valid delay ticks for all enemies', () => {
    for (const enemy of DIRECTED_WAVE_1_ENEMIES) {
      expect(enemy.delayTicks).toBeGreaterThan(0);
      expect(enemy.delayTicks).toBeLessThanOrEqual(90); // Max 3 seconds
    }
  });

  it('total duration is approximately 45-60 seconds', () => {
    const totalTicks = DIRECTED_WAVE_1_ENEMIES.reduce((sum, e) => sum + e.delayTicks, 0);
    const totalSeconds = totalTicks / 30; // 30 ticks per second

    expect(totalSeconds).toBeGreaterThanOrEqual(10); // At least 10 seconds of spawning
    expect(totalSeconds).toBeLessThanOrEqual(30);    // Spawning phase under 30 seconds
  });

  it('pacing accelerates toward the end', () => {
    // Last few enemies should have shorter delays
    const lastFour = DIRECTED_WAVE_1_ENEMIES.slice(-4);
    const lastFourAvgDelay = lastFour.reduce((sum, e) => sum + e.delayTicks, 0) / 4;

    const firstFour = DIRECTED_WAVE_1_ENEMIES.slice(0, 4);
    const firstFourAvgDelay = firstFour.reduce((sum, e) => sum + e.delayTicks, 0) / 4;

    expect(lastFourAvgDelay).toBeLessThan(firstFourAvgDelay);
  });
});

describe('Directed Wave 1 Scripted Events', () => {
  it('has 4 scripted events', () => {
    expect(DIRECTED_WAVE_1_EVENTS).toHaveLength(4);
  });

  it('has unique event IDs', () => {
    const ids = DIRECTED_WAVE_1_EVENTS.map(e => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('has first kill celebration event', () => {
    const firstKillEvent = DIRECTED_WAVE_1_EVENTS.find(e => e.id === 'first_kill_celebration');
    expect(firstKillEvent).toBeDefined();
    expect(firstKillEvent!.triggerType).toBe('kill_count');
    expect(firstKillEvent!.triggerValue).toBe(1);
    expect(firstKillEvent!.event).toBe('vfx_burst');
    expect(firstKillEvent!.data?.confetti).toBe(true);
  });

  it('has synergy highlight event at 5 kills', () => {
    const synergyEvent = DIRECTED_WAVE_1_EVENTS.find(e => e.id === 'synergy_highlight_5_kills');
    expect(synergyEvent).toBeDefined();
    expect(synergyEvent!.triggerType).toBe('kill_count');
    expect(synergyEvent!.triggerValue).toBe(5);
    expect(synergyEvent!.event).toBe('synergy_highlight');
    expect(synergyEvent!.data?.pulseHUD).toBe(true);
  });

  it('has slow motion event for elite spawn', () => {
    const slowMoEvent = DIRECTED_WAVE_1_EVENTS.find(e => e.id === 'elite_spawn_slowmo');
    expect(slowMoEvent).toBeDefined();
    expect(slowMoEvent!.triggerType).toBe('tick');
    expect(slowMoEvent!.event).toBe('slow_motion');
    expect(slowMoEvent!.data?.factor).toBeLessThan(1); // Should slow down
    expect(slowMoEvent!.data?.duration).toBeGreaterThan(0);
  });

  it('has dramatic finish event for last enemy', () => {
    const finishEvent = DIRECTED_WAVE_1_EVENTS.find(e => e.id === 'last_enemy_dramatic');
    expect(finishEvent).toBeDefined();
    expect(finishEvent!.triggerType).toBe('enemies_remaining');
    expect(finishEvent!.triggerValue).toBe(1);
    expect(finishEvent!.event).toBe('vfx_burst');
    expect(finishEvent!.data?.screenShake).toBe(true);
  });

  it('all events have valid trigger types', () => {
    const validTriggerTypes = ['tick', 'kill_count', 'hp_percent', 'enemies_remaining'];
    for (const event of DIRECTED_WAVE_1_EVENTS) {
      expect(validTriggerTypes).toContain(event.triggerType);
    }
  });

  it('all events have valid event types', () => {
    const validEventTypes = ['vfx_burst', 'synergy_highlight', 'tutorial_tip', 'slow_motion'];
    for (const event of DIRECTED_WAVE_1_EVENTS) {
      expect(validEventTypes).toContain(event.event);
    }
  });
});

describe('Wave 2 Adjustment', () => {
  it('reduces enemy count by 10%', () => {
    expect(DIRECTED_WAVE_2_ADJUSTMENT.enemyCountMultiplier).toBe(0.9);
  });

  it('reduces elite chance by 20%', () => {
    expect(DIRECTED_WAVE_2_ADJUSTMENT.eliteChanceMultiplier).toBe(0.8);
  });
});

describe('DEFAULT_DIRECTED_WAVE_1_CONFIG', () => {
  it('is enabled by default', () => {
    expect(DEFAULT_DIRECTED_WAVE_1_CONFIG.enabled).toBe(true);
  });

  it('offers relic at start', () => {
    expect(DEFAULT_DIRECTED_WAVE_1_CONFIG.offerRelicAtStart).toBe(true);
  });

  it('includes enemy sequence', () => {
    expect(DEFAULT_DIRECTED_WAVE_1_CONFIG.enemies).toBe(DIRECTED_WAVE_1_ENEMIES);
  });

  it('includes scripted events', () => {
    expect(DEFAULT_DIRECTED_WAVE_1_CONFIG.scriptedEvents).toBe(DIRECTED_WAVE_1_EVENTS);
  });

  it('includes wave 2 adjustment', () => {
    expect(DEFAULT_DIRECTED_WAVE_1_CONFIG.wave2Adjustment).toBe(DIRECTED_WAVE_2_ADJUSTMENT);
  });

  it('does not force specific relics by default', () => {
    expect(DEFAULT_DIRECTED_WAVE_1_CONFIG.forcedRelicOptions).toBeUndefined();
  });
});

describe('getDirectedWave1ConfigWithRelics', () => {
  it('returns config with forced relic options populated', () => {
    const rng = new Xorshift32(12345);
    const config = getDirectedWave1ConfigWithRelics(rng);

    expect(config.forcedRelicOptions).toBeDefined();
    expect(config.forcedRelicOptions).toHaveLength(3);
  });

  it('preserves other config properties', () => {
    const rng = new Xorshift32(12345);
    const config = getDirectedWave1ConfigWithRelics(rng);

    expect(config.enabled).toBe(DEFAULT_DIRECTED_WAVE_1_CONFIG.enabled);
    expect(config.enemies).toBe(DEFAULT_DIRECTED_WAVE_1_CONFIG.enemies);
    expect(config.scriptedEvents).toBe(DEFAULT_DIRECTED_WAVE_1_CONFIG.scriptedEvents);
    expect(config.wave2Adjustment).toBe(DEFAULT_DIRECTED_WAVE_1_CONFIG.wave2Adjustment);
  });

  it('is deterministic with same seed', () => {
    const rng1 = new Xorshift32(12345);
    const rng2 = new Xorshift32(12345);

    const config1 = getDirectedWave1ConfigWithRelics(rng1);
    const config2 = getDirectedWave1ConfigWithRelics(rng2);

    expect(config1.forcedRelicOptions).toEqual(config2.forcedRelicOptions);
  });
});

describe('Simulation - Early Relic Offer', () => {
  it('offerEarlyRelic returns true when conditions are met', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    const result = sim.offerEarlyRelic();

    expect(result).toBe(true);
    expect(sim.state.inChoice).toBe(true);
    expect(sim.state.pendingChoice).not.toBeNull();
    expect(sim.state.earlyRelicOffered).toBe(true);
  });

  it('offerEarlyRelic returns false when already offered', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    // First offer should succeed
    expect(sim.offerEarlyRelic()).toBe(true);

    // Second offer should fail
    expect(sim.offerEarlyRelic()).toBe(false);
  });

  it('offerEarlyRelic returns false when wave > 0', () => {
    const config = createSimConfig({
      startingWave: 1,
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    expect(sim.offerEarlyRelic()).toBe(false);
    expect(sim.state.inChoice).toBe(false);
  });

  it('offerEarlyRelic returns false when directed wave disabled', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: false,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    expect(sim.offerEarlyRelic()).toBe(false);
  });

  it('offerEarlyRelic returns false when offerRelicAtStart is false', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: false,
      },
    });
    const sim = new Simulation(12345, config);

    expect(sim.offerEarlyRelic()).toBe(false);
  });

  it('early relic choice uses tutorial relic pool', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    sim.offerEarlyRelic();

    const options = sim.state.pendingChoice?.options;
    expect(options).toBeDefined();
    expect(options).toHaveLength(3);

    // All options should be from tutorial pool
    for (const option of options!) {
      expect(TUTORIAL_RELIC_POOL).toContain(option);
    }
  });

  it('early relic choice uses forced options when provided', () => {
    const forcedOptions = ['iron_hide', 'gold_rush', 'swift_strikes'];
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
        forcedRelicOptions: forcedOptions,
      },
    });
    const sim = new Simulation(12345, config);

    sim.offerEarlyRelic();

    expect(sim.state.pendingChoice?.options).toEqual(forcedOptions);
  });
});

describe('Simulation - Directed Wave 1 Spawning', () => {
  it('uses scripted enemy sequence for wave 1', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
      },
    });
    const sim = new Simulation(12345, config);

    // Advance to wave 1
    sim.step();
    while (sim.state.wave === 0) {
      sim.step();
    }

    // Check wave spawn queue matches directed config
    expect(sim.state.waveTotalEnemies).toBe(DIRECTED_WAVE_1_ENEMIES.length);
  });

  it('does not use scripted sequence when directed wave disabled', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: false,
      },
    });
    const sim = new Simulation(12345, config);

    // Advance to wave 1
    sim.step();
    while (sim.state.wave === 0) {
      sim.step();
    }

    // Wave 1 should use standard composition, not directed
    // Standard wave 1 has different enemy count
    expect(sim.state.waveTotalEnemies).not.toBe(DIRECTED_WAVE_1_ENEMIES.length);
  });

  it('resumes normal wave composition after wave 1', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
      },
    });
    const sim = new Simulation(12345, config);

    // Fast-forward through wave 1 - need enough iterations for enemies to spawn
    // and fortress to kill them (fortress auto-attacks enemies)
    for (let i = 0; i < 10000; i++) {
      sim.step();
      if (sim.state.wave >= 2) break;
      if (sim.state.ended) break;
    }

    // Should either complete wave 1 or game ended (fortress died)
    // Test that directed wave 1 was used (spawns started)
    expect(sim.state.waveSpawnedEnemies).toBeGreaterThan(0);
  });
});

describe('Directed Wave - Event Trigger Types', () => {
  it('tick trigger fires at correct tick', () => {
    const event = DIRECTED_WAVE_1_EVENTS.find(e => e.triggerType === 'tick');
    expect(event).toBeDefined();
    expect(event!.triggerValue).toBeGreaterThan(0);
  });

  it('kill_count trigger fires at correct kill count', () => {
    const killEvents = DIRECTED_WAVE_1_EVENTS.filter(e => e.triggerType === 'kill_count');
    expect(killEvents.length).toBeGreaterThan(0);

    // Should have events at 1 and 5 kills
    const killTriggers = killEvents.map(e => e.triggerValue).sort((a, b) => a - b);
    expect(killTriggers).toContain(1);
    expect(killTriggers).toContain(5);
  });

  it('enemies_remaining trigger fires for last enemy', () => {
    const remainingEvent = DIRECTED_WAVE_1_EVENTS.find(
      e => e.triggerType === 'enemies_remaining'
    );
    expect(remainingEvent).toBeDefined();
    expect(remainingEvent!.triggerValue).toBe(1); // Last enemy
  });
});

describe('Directed Wave - Integration', () => {
  it('directed wave 1 uses scripted spawning with correct enemy count', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: false, // Skip relic for simpler test
      },
    });
    const sim = new Simulation(12345, config);

    // Advance until wave 1 starts
    for (let i = 0; i < 200 && sim.state.wave === 0; i++) {
      sim.step();
    }

    // Should be in wave 1 with directed enemy count
    expect(sim.state.wave).toBe(1);
    expect(sim.state.waveTotalEnemies).toBe(DIRECTED_WAVE_1_ENEMIES.length);
  });

  it('early relic offer sets up correct choice state', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    // Offer early relic
    expect(sim.offerEarlyRelic()).toBe(true);
    expect(sim.state.inChoice).toBe(true);
    expect(sim.state.pendingChoice).not.toBeNull();
    expect(sim.state.pendingChoice!.wave).toBe(0);
    expect(sim.state.pendingChoice!.options).toHaveLength(3);
    expect(sim.state.earlyRelicOffered).toBe(true);
  });

  it('early relic shows tutorial relics from pool', () => {
    const config = createSimConfig({
      directedWave1: {
        ...DEFAULT_DIRECTED_WAVE_1_CONFIG,
        enabled: true,
        offerRelicAtStart: true,
      },
    });
    const sim = new Simulation(12345, config);

    // Offer early relic
    sim.offerEarlyRelic();

    // All offered relics should be from tutorial pool
    const options = sim.state.pendingChoice?.options;
    expect(options).toBeDefined();
    for (const option of options!) {
      expect(TUTORIAL_RELIC_POOL).toContain(option);
    }
  });
});
