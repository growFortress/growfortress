import { signal, effect, type Signal } from '@preact/signals';

// Audio Settings
export interface AudioSettings {
  masterVolume: number; // 0-1
  musicVolume: number;  // 0-1
  sfxVolume: number;    // 0-1
  muted: boolean;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1.0,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
};

// Graphics Settings
export interface GraphicsSettings {
  quality: 'low' | 'medium' | 'high';
  particles: number;      // Multiplier: 0.5, 1.0, 1.5
  resolutionScale: number; // 0.5 - 1.0
  damageNumbers: boolean;  // Floating numbers toggle
}

const DEFAULT_GRAPHICS_SETTINGS: GraphicsSettings = {
  quality: 'high',
  particles: 1.0,
  resolutionScale: 1.0,
  damageNumbers: true,
};

// Game Settings
export interface GameSettings {
  language: string;
  autoSaveInterval: number; // Minutes
  showTutorials: boolean;
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  language: 'pl',
  autoSaveInterval: 5,
  showTutorials: true,
};

// Persistence Helper
const STORAGE_KEY_AUDIO = 'arcade_audio_settings';
const STORAGE_KEY_GRAPHICS = 'arcade_graphics_settings';
const STORAGE_KEY_GAME = 'arcade_game_settings';

function loadSettings<T>(key: string, defaults: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return { ...defaults, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn(`Failed to load settings for ${key}`, e);
  }
  return defaults;
}

function saveSettings(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to save settings for ${key}`, e);
  }
}

// Signals
export const audioSettings: Signal<AudioSettings> = signal<AudioSettings>(loadSettings(STORAGE_KEY_AUDIO, DEFAULT_AUDIO_SETTINGS));
export const graphicsSettings: Signal<GraphicsSettings> = signal<GraphicsSettings>(loadSettings(STORAGE_KEY_GRAPHICS, DEFAULT_GRAPHICS_SETTINGS));
export const gameSettings: Signal<GameSettings> = signal<GameSettings>(loadSettings(STORAGE_KEY_GAME, DEFAULT_GAME_SETTINGS));

// Effects to persist changes
effect(() => {
  saveSettings(STORAGE_KEY_AUDIO, audioSettings.value);
});

effect(() => {
  saveSettings(STORAGE_KEY_GRAPHICS, graphicsSettings.value);
});

effect(() => {
  saveSettings(STORAGE_KEY_GAME, gameSettings.value);
});

// Update functions
export function updateAudioSettings(updates: Partial<AudioSettings>) {
  audioSettings.value = { ...audioSettings.value, ...updates };
}

export function updateGraphicsSettings(updates: Partial<GraphicsSettings>) {
  graphicsSettings.value = { ...graphicsSettings.value, ...updates };
}

export function updateGameSettings(updates: Partial<GameSettings>) {
  gameSettings.value = { ...gameSettings.value, ...updates };
}
