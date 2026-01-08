/**
 * State builders for creating complex test scenarios
 */
import type { GameEvent } from '@arcade/protocol';
import { GameState, SimConfig, Enemy, ActiveRelic, ModifierSet } from '../../types.js';
import { Simulation, getDefaultConfig } from '../../simulation.js';
import { createGameState } from './factories.js';
import { computeModifiers } from '../../modifiers.js';

/**
 * Fluent builder for GameState
 */
export class GameStateBuilder {
  private state: GameState;

  constructor() {
    this.state = createGameState();
  }

  /**
   * Set the current tick
   */
  withTick(tick: number): this {
    this.state.tick = tick;
    return this;
  }

  /**
   * Set the current wave
   */
  withWave(wave: number): this {
    this.state.wave = wave;
    return this;
  }

  /**
   * Set waves cleared
   */
  withWavesCleared(wavesCleared: number): this {
    this.state.wavesCleared = wavesCleared;
    return this;
  }

  /**
   * Set fortress HP
   */
  withFortressHp(hp: number, maxHp?: number): this {
    this.state.fortressHp = hp;
    if (maxHp !== undefined) {
      this.state.fortressMaxHp = maxHp;
    }
    return this;
  }

  /**
   * Set fortress max HP
   */
  withFortressMaxHp(maxHp: number): this {
    this.state.fortressMaxHp = maxHp;
    return this;
  }

  /**
   * Add enemies
   */
  withEnemies(enemies: Enemy[]): this {
    this.state.enemies = enemies;
    this.state.nextEnemyId = Math.max(...enemies.map(e => e.id), 0) + 1;
    return this;
  }

  /**
   * Add relics and recompute modifiers
   */
  withRelics(relics: ActiveRelic[]): this {
    this.state.relics = relics;
    this.state.modifiers = computeModifiers(relics);
    return this;
  }

  /**
   * Add relics by ID
   */
  withRelicIds(relicIds: string[]): this {
    this.state.relics = relicIds.map((id, i) => ({
      id,
      acquiredWave: i + 1,
      acquiredTick: i * 100,
    }));
    this.state.modifiers = computeModifiers(this.state.relics);
    return this;
  }

  /**
   * Set gold amount
   */
  withGold(gold: number): this {
    this.state.gold = gold;
    return this;
  }

  /**
   * Set dust amount
   */
  withDust(dust: number): this {
    this.state.dust = dust;
    return this;
  }

  /**
   * Set kills count
   */
  withKills(kills: number, eliteKills: number = 0): this {
    this.state.kills = kills;
    this.state.eliteKills = eliteKills;
    return this;
  }

  /**
   * Put state in choice mode
   */
  inChoiceMode(options: string[], wave?: number): this {
    const w = wave ?? this.state.wave;
    this.state.inChoice = true;
    this.state.pendingChoice = {
      options,
      wave: w,
      offeredTick: this.state.tick,
    };
    this.state.pendingChoiceTick = this.state.tick;
    return this;
  }

  /**
   * Set modifiers directly
   */
  withModifiers(modifiers: Partial<ModifierSet>): this {
    this.state.modifiers = { ...this.state.modifiers, ...modifiers };
    return this;
  }

  /**
   * Set last skill tick
   */
  withLastSkillTick(tick: number): this {
    this.state.lastSkillTick = tick;
    return this;
  }

  /**
   * Set RNG state
   */
  withRngState(state: number): this {
    this.state.rngState = state;
    return this;
  }

  /**
   * Set game as ended
   */
  asEnded(won: boolean = false): this {
    this.state.ended = true;
    this.state.won = won;
    return this;
  }

  /**
   * Set gold earned
   */
  withGoldEarned(goldEarned: number): this {
    this.state.goldEarned = goldEarned;
    return this;
  }

  /**
   * Set dust earned
   */
  withDustEarned(dustEarned: number): this {
    this.state.dustEarned = dustEarned;
    return this;
  }

  /**
   * Build the final state
   */
  build(): GameState {
    return { ...this.state };
  }
}

/**
 * Create a new GameStateBuilder
 */
export function gameStateBuilder(): GameStateBuilder {
  return new GameStateBuilder();
}

/**
 * Run a simulation to a specific state
 */
export interface SimulationRunOptions {
  seed: number;
  targetWave?: number;
  targetTick?: number;
  events?: GameEvent[];
  config?: Partial<SimConfig>;
  autoChooseRelic?: boolean;
}

export interface SimulationRunResult {
  sim: Simulation;
  state: GameState;
  events: GameEvent[];
}

/**
 * Run simulation until a target condition
 */
export function runSimulationTo(options: SimulationRunOptions): SimulationRunResult {
  const {
    seed,
    targetWave,
    targetTick,
    events = [],
    config = {},
    autoChooseRelic = true,
  } = options;

  const fullConfig = { ...getDefaultConfig(), ...config };
  const sim = new Simulation(seed, fullConfig);
  const collectedEvents: GameEvent[] = [...events];

  sim.setEvents(collectedEvents);

  const maxIterations = 10000;
  let iterations = 0;

  while (iterations < maxIterations && !sim.state.ended) {
    // Check target conditions
    if (targetTick !== undefined && sim.state.tick >= targetTick) {
      break;
    }
    if (targetWave !== undefined && sim.state.wavesCleared >= targetWave) {
      break;
    }

    sim.step();

    // Auto-choose first relic if in choice mode
    if (autoChooseRelic && sim.state.inChoice && sim.state.pendingChoice) {
      const event: GameEvent = {
        type: 'CHOOSE_RELIC',
        tick: sim.state.tick,
        wave: sim.state.pendingChoice.wave,
        optionIndex: 0,
      };
      collectedEvents.push(event);
      sim.setEvents(collectedEvents);
    }

    iterations++;
  }

  return {
    sim,
    state: sim.state,
    events: collectedEvents,
  };
}

/**
 * Run simulation for exact number of ticks
 */
export function runSimulationTicks(
  seed: number,
  ticks: number,
  config?: Partial<SimConfig>
): SimulationRunResult {
  const fullConfig = { ...getDefaultConfig(), ...config };
  const sim = new Simulation(seed, fullConfig);

  for (let i = 0; i < ticks && !sim.state.ended; i++) {
    sim.step();
  }

  return {
    sim,
    state: sim.state,
    events: [],
  };
}

/**
 * Create simulation and run until wave is complete
 */
export function runSimulationUntilWaveComplete(
  seed: number,
  targetWave: number,
  config?: Partial<SimConfig>
): SimulationRunResult {
  return runSimulationTo({
    seed,
    targetWave,
    config,
    autoChooseRelic: true,
  });
}
