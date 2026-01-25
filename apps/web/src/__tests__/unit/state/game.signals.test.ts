/**
 * Game signals tests
 *
 * Tests for game state signals and computed values.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGameState } from '../../mocks/data.js';

// Import signals after any setup
import {
  gamePhase,
  forceResetToHub,
  gameSpeed,
  isFirstSession,
  gameState,
  fortressHp,
  fortressMaxHp,
  fortressHpPercent,
  currentScore,
  waveProgress,
  wavesUntilBoss,
  isBossWave,
  nextBossWave,
  currentPillar,
  PILLAR_INFO,
  currentPillarInfo,
  lastSkillTargetPositions,
  FIRST_SESSION_WAVE_THRESHOLD,
} from '../../../state/game.signals.js';

describe('Game Signals', () => {
  beforeEach(() => {
    // Reset signals to defaults
    gamePhase.value = 'idle';
    forceResetToHub.value = false;
    gameSpeed.value = 1;
    isFirstSession.value = false;
    gameState.value = null;
    fortressHp.value = 100;
    fortressMaxHp.value = 100;
    currentPillar.value = 'streets';
    lastSkillTargetPositions.value = {};
  });

  describe('gamePhase', () => {
    it('should default to idle', () => {
      expect(gamePhase.value).toBe('idle');
    });

    it('should update phase', () => {
      gamePhase.value = 'playing';
      expect(gamePhase.value).toBe('playing');

      gamePhase.value = 'ended';
      expect(gamePhase.value).toBe('ended');
    });
  });

  describe('forceResetToHub', () => {
    it('should default to false', () => {
      expect(forceResetToHub.value).toBe(false);
    });

    it('should toggle reset flag', () => {
      forceResetToHub.value = true;
      expect(forceResetToHub.value).toBe(true);
    });
  });

  describe('gameSpeed', () => {
    it('should default to 1x speed', () => {
      expect(gameSpeed.value).toBe(1);
    });

    it('should support 2x speed', () => {
      gameSpeed.value = 2;
      expect(gameSpeed.value).toBe(2);
    });
  });

  describe('isFirstSession', () => {
    it('should default to false', () => {
      expect(isFirstSession.value).toBe(false);
    });

    it('should have wave threshold constant', () => {
      expect(FIRST_SESSION_WAVE_THRESHOLD).toBe(5);
    });
  });

  describe('gameState', () => {
    it('should default to null', () => {
      expect(gameState.value).toBeNull();
    });

    it('should update with game snapshot', () => {
      const mockState = createMockGameState({ wave: 5, kills: 100 });
      gameState.value = mockState as any;

      expect(gameState.value?.wave).toBe(5);
      expect(gameState.value?.kills).toBe(100);
    });
  });

  describe('fortressHpPercent (computed)', () => {
    it('should calculate HP percentage', () => {
      fortressHp.value = 50;
      fortressMaxHp.value = 100;
      expect(fortressHpPercent.value).toBe(50);
    });

    it('should return 100 when max HP is 0', () => {
      fortressHp.value = 0;
      fortressMaxHp.value = 0;
      expect(fortressHpPercent.value).toBe(100);
    });

    it('should handle full HP', () => {
      fortressHp.value = 100;
      fortressMaxHp.value = 100;
      expect(fortressHpPercent.value).toBe(100);
    });

    it('should handle low HP', () => {
      fortressHp.value = 10;
      fortressMaxHp.value = 100;
      expect(fortressHpPercent.value).toBe(10);
    });
  });

  describe('currentScore (computed)', () => {
    it('should return 0 when no game state', () => {
      gameState.value = null;
      expect(currentScore.value).toBe(0);
    });

    it('should calculate score from waves and kills', () => {
      gameState.value = createMockGameState({
        wavesCleared: 10,
        kills: 100,
      }) as any;
      // Score = wavesCleared * WAVE_SCORE_MULTIPLIER + kills * KILL_SCORE_MULTIPLIER
      // Default multipliers: WAVE_SCORE = 100, KILL_SCORE = 1
      expect(currentScore.value).toBeGreaterThan(0);
    });
  });

  describe('waveProgress (computed)', () => {
    it('should return 0 when no game state', () => {
      gameState.value = null;
      expect(waveProgress.value).toBe(0);
    });

    it('should return 0 when total enemies is 0', () => {
      gameState.value = createMockGameState({
        waveSpawnedEnemies: 0,
        waveTotalEnemies: 0,
      }) as any;
      expect(waveProgress.value).toBe(0);
    });

    it('should calculate wave progress percentage', () => {
      gameState.value = createMockGameState({
        waveSpawnedEnemies: 5,
        waveTotalEnemies: 10,
      }) as any;
      expect(waveProgress.value).toBe(50);
    });

    it('should handle full wave progress', () => {
      gameState.value = createMockGameState({
        waveSpawnedEnemies: 10,
        waveTotalEnemies: 10,
      }) as any;
      expect(waveProgress.value).toBe(100);
    });
  });

  describe('wavesUntilBoss (computed)', () => {
    it('should return null when no game state', () => {
      gameState.value = null;
      expect(wavesUntilBoss.value).toBeNull();
    });

    it('should return null when wave is 0', () => {
      gameState.value = createMockGameState({ wave: 0 }) as any;
      expect(wavesUntilBoss.value).toBeNull();
    });

    it('should return 0 on boss wave (wave 10)', () => {
      gameState.value = createMockGameState({ wave: 10 }) as any;
      expect(wavesUntilBoss.value).toBe(0);
    });

    it('should return correct waves until boss', () => {
      gameState.value = createMockGameState({ wave: 7 }) as any;
      expect(wavesUntilBoss.value).toBe(3); // 10 - 7 = 3

      gameState.value = createMockGameState({ wave: 1 }) as any;
      expect(wavesUntilBoss.value).toBe(9); // 10 - 1 = 9
    });

    it('should handle waves beyond 10 (cycle)', () => {
      gameState.value = createMockGameState({ wave: 15 }) as any;
      expect(wavesUntilBoss.value).toBe(5); // Next boss at 20

      gameState.value = createMockGameState({ wave: 20 }) as any;
      expect(wavesUntilBoss.value).toBe(0); // Wave 20 is boss
    });
  });

  describe('isBossWave (computed)', () => {
    it('should be true on boss waves', () => {
      gameState.value = createMockGameState({ wave: 10 }) as any;
      expect(isBossWave.value).toBe(true);

      gameState.value = createMockGameState({ wave: 20 }) as any;
      expect(isBossWave.value).toBe(true);

      gameState.value = createMockGameState({ wave: 100 }) as any;
      expect(isBossWave.value).toBe(true);
    });

    it('should be false on non-boss waves', () => {
      gameState.value = createMockGameState({ wave: 1 }) as any;
      expect(isBossWave.value).toBe(false);

      gameState.value = createMockGameState({ wave: 15 }) as any;
      expect(isBossWave.value).toBe(false);
    });
  });

  describe('nextBossWave (computed)', () => {
    it('should return null when no game state', () => {
      gameState.value = null;
      expect(nextBossWave.value).toBeNull();
    });

    it('should calculate next boss wave', () => {
      gameState.value = createMockGameState({ wave: 3 }) as any;
      expect(nextBossWave.value).toBe(10);

      gameState.value = createMockGameState({ wave: 15 }) as any;
      expect(nextBossWave.value).toBe(20);
    });

    it('should return +10 when on boss wave', () => {
      gameState.value = createMockGameState({ wave: 10 }) as any;
      expect(nextBossWave.value).toBe(20);
    });
  });

  describe('currentPillar', () => {
    it('should default to streets', () => {
      expect(currentPillar.value).toBe('streets');
    });

    it('should update pillar', () => {
      currentPillar.value = 'cosmos';
      expect(currentPillar.value).toBe('cosmos');
    });
  });

  describe('PILLAR_INFO', () => {
    it('should have info for all pillars', () => {
      const pillars = ['streets', 'science', 'mutants', 'cosmos', 'magic', 'gods'];

      for (const pillar of pillars) {
        expect(PILLAR_INFO[pillar as keyof typeof PILLAR_INFO]).toBeDefined();
        expect(PILLAR_INFO[pillar as keyof typeof PILLAR_INFO].name).toBeDefined();
        expect(PILLAR_INFO[pillar as keyof typeof PILLAR_INFO].color).toBeDefined();
        expect(PILLAR_INFO[pillar as keyof typeof PILLAR_INFO].icon).toBeDefined();
      }
    });
  });

  describe('currentPillarInfo (computed)', () => {
    it('should return info for current pillar', () => {
      currentPillar.value = 'streets';
      expect(currentPillarInfo.value).toEqual(PILLAR_INFO.streets);

      currentPillar.value = 'cosmos';
      expect(currentPillarInfo.value).toEqual(PILLAR_INFO.cosmos);
    });
  });

  describe('lastSkillTargetPositions', () => {
    it('should default to empty object', () => {
      expect(lastSkillTargetPositions.value).toEqual({});
    });

    it('should store skill target positions', () => {
      lastSkillTargetPositions.value = {
        'skill-1': { x: 100, y: 200 },
        'skill-2': { x: 300, y: 400 },
      };

      expect(lastSkillTargetPositions.value['skill-1']).toEqual({ x: 100, y: 200 });
    });
  });
});
