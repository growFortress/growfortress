/**
 * Settings signals tests
 *
 * Tests for audio, graphics, and game settings signals.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing signals
const localStorageStore: Record<string, string> = {};

const mockLocalStorage = {
  store: localStorageStore,
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]);
  }),
};

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// Import signals after localStorage mock
import {
  audioSettings,
  graphicsSettings,
  gameSettings,
  updateAudioSettings,
  updateGraphicsSettings,
  updateGameSettings,
  FIRST_SESSION_VFX_BOOST,
  FIRST_SESSION_SHAKE_THRESHOLD,
} from '../../../state/settings.signals.js';

describe('Settings Signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
  });

  // ==========================================================================
  // AUDIO SETTINGS
  // ==========================================================================

  describe('audioSettings', () => {
    it('should have default values', () => {
      const audio = audioSettings.value;
      expect(audio.masterVolume).toBeDefined();
      expect(audio.musicVolume).toBeDefined();
      expect(audio.sfxVolume).toBeDefined();
      expect(typeof audio.muted).toBe('boolean');
    });

    it('should have volumes between 0 and 1', () => {
      const audio = audioSettings.value;
      expect(audio.masterVolume).toBeGreaterThanOrEqual(0);
      expect(audio.masterVolume).toBeLessThanOrEqual(1);
      expect(audio.musicVolume).toBeGreaterThanOrEqual(0);
      expect(audio.musicVolume).toBeLessThanOrEqual(1);
      expect(audio.sfxVolume).toBeGreaterThanOrEqual(0);
      expect(audio.sfxVolume).toBeLessThanOrEqual(1);
    });
  });

  describe('updateAudioSettings', () => {
    it('should update master volume', () => {
      updateAudioSettings({ masterVolume: 0.5 });
      expect(audioSettings.value.masterVolume).toBe(0.5);
    });

    it('should update mute state', () => {
      updateAudioSettings({ muted: true });
      expect(audioSettings.value.muted).toBe(true);

      updateAudioSettings({ muted: false });
      expect(audioSettings.value.muted).toBe(false);
    });

    it('should preserve other values when updating', () => {
      const before = { ...audioSettings.value };
      updateAudioSettings({ masterVolume: 0.3 });

      expect(audioSettings.value.musicVolume).toBe(before.musicVolume);
      expect(audioSettings.value.sfxVolume).toBe(before.sfxVolume);
    });
  });

  // ==========================================================================
  // GRAPHICS SETTINGS
  // ==========================================================================

  describe('graphicsSettings', () => {
    it('should have default values', () => {
      const graphics = graphicsSettings.value;
      expect(['low', 'medium', 'high']).toContain(graphics.quality);
      expect(typeof graphics.particles).toBe('number');
      expect(typeof graphics.resolutionScale).toBe('number');
      expect(typeof graphics.damageNumbers).toBe('boolean');
    });

    it('should have valid particle multiplier', () => {
      const particles = graphicsSettings.value.particles;
      expect(particles).toBeGreaterThan(0);
    });

    it('should have valid resolution scale', () => {
      const scale = graphicsSettings.value.resolutionScale;
      expect(scale).toBeGreaterThanOrEqual(0.5);
      expect(scale).toBeLessThanOrEqual(1.0);
    });
  });

  describe('updateGraphicsSettings', () => {
    it('should update quality', () => {
      updateGraphicsSettings({ quality: 'low' });
      expect(graphicsSettings.value.quality).toBe('low');

      updateGraphicsSettings({ quality: 'high' });
      expect(graphicsSettings.value.quality).toBe('high');
    });

    it('should update particles', () => {
      updateGraphicsSettings({ particles: 0.5 });
      expect(graphicsSettings.value.particles).toBe(0.5);
    });

    it('should update resolution scale', () => {
      updateGraphicsSettings({ resolutionScale: 0.75 });
      expect(graphicsSettings.value.resolutionScale).toBe(0.75);
    });

    it('should toggle damage numbers', () => {
      updateGraphicsSettings({ damageNumbers: false });
      expect(graphicsSettings.value.damageNumbers).toBe(false);

      updateGraphicsSettings({ damageNumbers: true });
      expect(graphicsSettings.value.damageNumbers).toBe(true);
    });
  });

  // ==========================================================================
  // GAME SETTINGS
  // ==========================================================================

  describe('gameSettings', () => {
    it('should have default values', () => {
      const game = gameSettings.value;
      expect(typeof game.language).toBe('string');
      expect(typeof game.autoSaveInterval).toBe('number');
      expect(typeof game.showTutorials).toBe('boolean');
      expect(typeof game.autoPickRelics).toBe('boolean');
      expect(Array.isArray(game.relicPriority)).toBe(true);
    });

    it('should have valid auto-save interval', () => {
      expect(gameSettings.value.autoSaveInterval).toBeGreaterThan(0);
    });

    it('should have relic priority categories', () => {
      const priority = gameSettings.value.relicPriority;
      expect(priority.length).toBeGreaterThan(0);
      expect(priority).toContain('standard');
    });
  });

  describe('updateGameSettings', () => {
    it('should update language', () => {
      updateGameSettings({ language: 'en' });
      expect(gameSettings.value.language).toBe('en');
    });

    it('should update auto-save interval', () => {
      updateGameSettings({ autoSaveInterval: 10 });
      expect(gameSettings.value.autoSaveInterval).toBe(10);
    });

    it('should toggle tutorials', () => {
      updateGameSettings({ showTutorials: false });
      expect(gameSettings.value.showTutorials).toBe(false);
    });

    it('should toggle auto-pick relics', () => {
      updateGameSettings({ autoPickRelics: true });
      expect(gameSettings.value.autoPickRelics).toBe(true);
    });

    it('should normalize relic priority', () => {
      updateGameSettings({ relicPriority: ['standard', 'economy'] });
      const priority = gameSettings.value.relicPriority;

      // Should include all categories even if not specified
      expect(priority).toContain('standard');
      expect(priority).toContain('economy');
      // Standard and economy should be first (as specified)
      expect(priority.indexOf('standard')).toBeLessThan(priority.indexOf('cursed'));
    });
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('constants', () => {
    it('should have VFX boost multiplier', () => {
      expect(FIRST_SESSION_VFX_BOOST).toBe(1.5);
    });

    it('should have shake threshold', () => {
      expect(FIRST_SESSION_SHAKE_THRESHOLD).toBe(200);
    });
  });

  // ==========================================================================
  // PERSISTENCE (localStorage)
  // ==========================================================================

  describe('persistence', () => {
    it('should save audio settings on change', () => {
      updateAudioSettings({ masterVolume: 0.8 });
      // Effect runs synchronously in tests
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should save graphics settings on change', () => {
      updateGraphicsSettings({ quality: 'medium' });
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should save game settings on change', () => {
      updateGameSettings({ language: 'pl' });
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });
});
