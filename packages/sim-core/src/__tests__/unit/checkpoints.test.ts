import { describe, it, expect } from 'vitest';
import {
  fnv1a32,
  computeCheckpointHash,
  computeChainHash,
  createCheckpoint,
  verifyCheckpoint,
  computeFinalHash,
} from '../../checkpoints.js';
import { createGameState, createEnemy, createActiveRelic } from '../helpers/factories.js';

describe('fnv1a32', () => {
  it('hashes empty array to offset basis', () => {
    const result = fnv1a32([]);
    expect(result).toBe(0x811c9dc5); // FNV offset basis
  });

  it('hashes [0] correctly', () => {
    const result = fnv1a32([0]);
    // 0x811c9dc5 ^ 0 = 0x811c9dc5
    // 0x811c9dc5 * 0x01000193 = ...
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('same input produces same hash', () => {
    const data = [1, 2, 3, 4, 5];
    const hash1 = fnv1a32(data);
    const hash2 = fnv1a32(data);
    expect(hash1).toBe(hash2);
  });

  it('different inputs produce different hashes', () => {
    const hash1 = fnv1a32([1, 2, 3]);
    const hash2 = fnv1a32([1, 2, 4]);
    const hash3 = fnv1a32([3, 2, 1]);
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  it('hash is unsigned 32-bit', () => {
    const data = [255, 255, 255, 255];
    const result = fnv1a32(data);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('handles large arrays', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i % 256);
    const result = fnv1a32(data);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('order matters', () => {
    const hash1 = fnv1a32([1, 2, 3]);
    const hash2 = fnv1a32([3, 2, 1]);
    expect(hash1).not.toBe(hash2);
  });
});

describe('computeCheckpointHash', () => {
  it('includes tick in hash', () => {
    const state1 = createGameState({ tick: 100 });
    const state2 = createGameState({ tick: 200 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes wave in hash', () => {
    const state1 = createGameState({ wave: 1 });
    const state2 = createGameState({ wave: 2 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes ended flag in hash', () => {
    const state1 = createGameState({ ended: false });
    const state2 = createGameState({ ended: true });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes won flag in hash', () => {
    const state1 = createGameState({ ended: true, won: false });
    const state2 = createGameState({ ended: true, won: true });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes rngState in hash', () => {
    const state1 = createGameState({ rngState: 12345 });
    const state2 = createGameState({ rngState: 54321 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes fortress HP in hash', () => {
    const state1 = createGameState({ fortressHp: 100 });
    const state2 = createGameState({ fortressHp: 50 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes sorted enemies in hash', () => {
    const enemies1 = [createEnemy({ id: 1, hp: 20 }), createEnemy({ id: 2, hp: 30 })];
    const enemies2 = [createEnemy({ id: 1, hp: 20 }), createEnemy({ id: 2, hp: 25 })];
    const state1 = createGameState({ enemies: enemies1 });
    const state2 = createGameState({ enemies: enemies2 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('enemy order does not affect hash (sorted by ID)', () => {
    const enemies1 = [createEnemy({ id: 1 }), createEnemy({ id: 2 })];
    const enemies2 = [createEnemy({ id: 2 }), createEnemy({ id: 1 })];
    const state1 = createGameState({ enemies: enemies1 });
    const state2 = createGameState({ enemies: enemies2 });
    expect(computeCheckpointHash(state1)).toBe(computeCheckpointHash(state2));
  });

  it('includes economy (gold, dust) in hash', () => {
    const state1 = createGameState({ gold: 100, dust: 50 });
    const state2 = createGameState({ gold: 100, dust: 60 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes sorted relics in hash', () => {
    const relics1 = [createActiveRelic('damage-boost', 1)];
    const relics2 = [createActiveRelic('speed-demon', 1)];
    const state1 = createGameState({ relics: relics1 });
    const state2 = createGameState({ relics: relics2 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('includes stats (kills, wavesCleared, eliteKills) in hash', () => {
    const state1 = createGameState({ kills: 10, wavesCleared: 2, eliteKills: 1 });
    const state2 = createGameState({ kills: 10, wavesCleared: 2, eliteKills: 2 });
    expect(computeCheckpointHash(state1)).not.toBe(computeCheckpointHash(state2));
  });

  it('same state produces same hash', () => {
    const state = createGameState({
      tick: 100,
      wave: 2,
      fortressHp: 80,
      kills: 15,
    });
    expect(computeCheckpointHash(state)).toBe(computeCheckpointHash(state));
  });

  it('returns unsigned 32-bit integer', () => {
    const state = createGameState();
    const hash = computeCheckpointHash(state);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

describe('computeChainHash', () => {
  it('chains previous hash with current', () => {
    const prevHash = 12345;
    const tick = 100;
    const currentHash = 67890;
    const result = computeChainHash(prevHash, tick, currentHash);

    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('order matters (tick, currentHash)', () => {
    const prevHash = 12345;
    const hash1 = computeChainHash(prevHash, 100, 200);
    const hash2 = computeChainHash(prevHash, 200, 100);
    expect(hash1).not.toBe(hash2);
  });

  it('produces consistent results', () => {
    const result1 = computeChainHash(11111, 100, 22222);
    const result2 = computeChainHash(11111, 100, 22222);
    expect(result1).toBe(result2);
  });

  it('different previous hash produces different result', () => {
    const hash1 = computeChainHash(11111, 100, 22222);
    const hash2 = computeChainHash(33333, 100, 22222);
    expect(hash1).not.toBe(hash2);
  });
});

describe('createCheckpoint', () => {
  it('creates checkpoint with correct tick', () => {
    const state = createGameState({ tick: 150 });
    const checkpoint = createCheckpoint(state, 0);
    expect(checkpoint.tick).toBe(150);
  });

  it('computes hash32 correctly', () => {
    const state = createGameState({ tick: 100, wave: 2 });
    const checkpoint = createCheckpoint(state, 0);
    const expectedHash = computeCheckpointHash(state);
    expect(checkpoint.hash32).toBe(expectedHash);
  });

  it('computes chainHash32 correctly', () => {
    const state = createGameState({ tick: 100 });
    const prevChainHash = 12345;
    const checkpoint = createCheckpoint(state, prevChainHash);

    const expectedHash = computeCheckpointHash(state);
    const expectedChain = computeChainHash(prevChainHash, state.tick, expectedHash);
    expect(checkpoint.chainHash32).toBe(expectedChain);
  });

  it('first checkpoint has chain based on 0', () => {
    const state = createGameState({ tick: 100 });
    const checkpoint = createCheckpoint(state, 0);

    const hash = computeCheckpointHash(state);
    const expectedChain = computeChainHash(0, 100, hash);
    expect(checkpoint.chainHash32).toBe(expectedChain);
  });

  it('sequential checkpoints chain correctly', () => {
    const state1 = createGameState({ tick: 100 });
    const checkpoint1 = createCheckpoint(state1, 0);

    const state2 = createGameState({ tick: 200, wave: 1 });
    const checkpoint2 = createCheckpoint(state2, checkpoint1.chainHash32);

    // Verify chain is linked
    const hash2 = computeCheckpointHash(state2);
    const expectedChain = computeChainHash(checkpoint1.chainHash32, 200, hash2);
    expect(checkpoint2.chainHash32).toBe(expectedChain);
  });
});

describe('verifyCheckpoint', () => {
  it('returns true for valid checkpoint', () => {
    const state = createGameState({ tick: 100, wave: 2 });
    const prevChainHash = 12345;
    const checkpoint = createCheckpoint(state, prevChainHash);

    expect(verifyCheckpoint(checkpoint, state, prevChainHash)).toBe(true);
  });

  it('returns false for tampered hash32', () => {
    const state = createGameState({ tick: 100 });
    const checkpoint = createCheckpoint(state, 0);

    const tamperedCheckpoint = { ...checkpoint, hash32: checkpoint.hash32 + 1 };
    expect(verifyCheckpoint(tamperedCheckpoint, state, 0)).toBe(false);
  });

  it('returns false for tampered chainHash32', () => {
    const state = createGameState({ tick: 100 });
    const checkpoint = createCheckpoint(state, 0);

    const tamperedCheckpoint = { ...checkpoint, chainHash32: checkpoint.chainHash32 + 1 };
    expect(verifyCheckpoint(tamperedCheckpoint, state, 0)).toBe(false);
  });

  it('returns false for wrong state', () => {
    const state1 = createGameState({ tick: 100, fortressHp: 100 });
    const checkpoint = createCheckpoint(state1, 0);

    const state2 = createGameState({ tick: 100, fortressHp: 50 });
    expect(verifyCheckpoint(checkpoint, state2, 0)).toBe(false);
  });

  it('returns false for wrong prevChainHash', () => {
    const state = createGameState({ tick: 100 });
    const checkpoint = createCheckpoint(state, 12345);

    expect(verifyCheckpoint(checkpoint, state, 54321)).toBe(false);
  });

  it('verifies checkpoint chain', () => {
    const state1 = createGameState({ tick: 100 });
    const cp1 = createCheckpoint(state1, 0);
    expect(verifyCheckpoint(cp1, state1, 0)).toBe(true);

    const state2 = createGameState({ tick: 200, kills: 5 });
    const cp2 = createCheckpoint(state2, cp1.chainHash32);
    expect(verifyCheckpoint(cp2, state2, cp1.chainHash32)).toBe(true);
  });
});

describe('computeFinalHash', () => {
  it('includes checkpoint hash', () => {
    const state = createGameState();
    const finalHash = computeFinalHash(state);
    expect(finalHash).toBeGreaterThan(0);
    expect(finalHash).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('includes final stats', () => {
    const state1 = createGameState({ wavesCleared: 5, kills: 20 });
    const state2 = createGameState({ wavesCleared: 5, kills: 25 });
    expect(computeFinalHash(state1)).not.toBe(computeFinalHash(state2));
  });

  it('includes won flag', () => {
    const state1 = createGameState({ ended: true, won: true });
    const state2 = createGameState({ ended: true, won: false });
    expect(computeFinalHash(state1)).not.toBe(computeFinalHash(state2));
  });

  it('includes goldEarned and dustEarned', () => {
    const state1 = createGameState({ goldEarned: 100, dustEarned: 50 });
    const state2 = createGameState({ goldEarned: 100, dustEarned: 60 });
    expect(computeFinalHash(state1)).not.toBe(computeFinalHash(state2));
  });

  it('includes tick (time survived)', () => {
    const state1 = createGameState({ tick: 1000 });
    const state2 = createGameState({ tick: 2000 });
    expect(computeFinalHash(state1)).not.toBe(computeFinalHash(state2));
  });

  it('same state produces same hash', () => {
    const state = createGameState({
      tick: 500,
      wavesCleared: 3,
      kills: 50,
      ended: true,
      won: false,
    });
    expect(computeFinalHash(state)).toBe(computeFinalHash(state));
  });

  it('is deterministic', () => {
    const state = createGameState({
      tick: 1000,
      wave: 5,
      wavesCleared: 5,
      kills: 100,
      eliteKills: 10,
      goldEarned: 500,
      dustEarned: 100,
      ended: true,
      won: false,
    });

    const hash1 = computeFinalHash(state);
    const hash2 = computeFinalHash(state);
    const hash3 = computeFinalHash(state);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });
});
