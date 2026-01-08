import { describe, it, expect } from 'vitest';
import { Simulation, getDefaultConfig, FP, steerTowards } from '../../index.js';

describe('Hero Movement', () => {
  it('hero should move towards enemies after they spawn', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['thunderlord'];

    const sim = new Simulation(12345, config);

    // Track initial hero position
    const hero = sim.state.heroes[0];
    expect(hero).toBeDefined();

    const initialX = hero.x;

    // Run until we have enemies
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) {
        break;
      }
    }

    expect(sim.state.enemies.length).toBeGreaterThan(0);

    // Run more ticks to let hero move
    for (let i = 0; i < 100; i++) {
      sim.step();
    }

    const finalX = hero.x;
    const finalState = hero.state;

    // Hero should have moved (position changed)
    expect(finalX).not.toBe(initialX);

    // Hero should be in deploying or combat state
    expect(['deploying', 'combat']).toContain(finalState);
  });

  it('hero state transitions from idle to deploying when enemies appear', () => {
    const config = getDefaultConfig();
    config.startingHeroes = ['thunderlord'];

    const sim = new Simulation(12345, config);
    const hero = sim.state.heroes[0];

    expect(hero.state).toBe('idle');

    // Run until enemies appear and one more tick
    for (let i = 0; i < 200; i++) {
      sim.step();
      if (sim.state.enemies.length > 0) {
        break;
      }
    }

    // Step once more to trigger state change
    sim.step();

    expect(hero.state).not.toBe('idle');
  });

  it('steerTowards should compute correct direction', () => {
    // Hero at (3, 7.5), enemy at (38, 0.8)
    const heroX = FP.fromInt(3);
    const heroY = FP.fromFloat(7.5);
    const enemyX = FP.fromInt(38);
    const enemyY = FP.fromFloat(0.8);
    const maxSpeed = FP.fromFloat(0.08);
    const arrivalRadius = FP.fromFloat(5.0);

    const body = {
      x: heroX,
      y: heroY,
      vx: 0,
      vy: 0,
      radius: FP.fromFloat(1.0),
      mass: FP.fromFloat(1.0),
    };

    const steering = steerTowards(body, enemyX, enemyY, maxSpeed, arrivalRadius);

    // Enemy is to the right and below, so:
    // ax should be positive (towards right)
    // ay should be negative (towards bottom, where enemy is)
    expect(steering.ax).toBeGreaterThan(0);
    expect(steering.ay).toBeLessThan(0);
  });
});
