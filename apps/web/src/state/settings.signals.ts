import { signal, effect, type Signal } from '@preact/signals';
import type { RelicCategory, AutoPlayRelicPriority, AutoPlayShopPriority, AutoPlaySkillMode } from '@arcade/sim-core';

// Audio Settings
export interface AudioSettings {
  masterVolume: number; // 0-1
  musicVolume: number;  // 0-1
  sfxVolume: number;    // 0-1
  muted: boolean;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 1.0,
  musicVolume: 0.5,
  sfxVolume: 0.6,
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
  autoPickRelics: boolean;
  relicPriority: RelicCategory[];
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  language: 'pl',
  autoSaveInterval: 5,
  showTutorials: true,
  autoPickRelics: false,
  relicPriority: [
    'build_defining',
    'synergy',
    'class',
    'standard',
    'economy',
    'pillar',
    'cursed',
  ],
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

const ALL_RELIC_CATEGORIES: RelicCategory[] = [
  'build_defining',
  'synergy',
  'class',
  'standard',
  'economy',
  'pillar',
  'cursed',
];

function normalizeRelicPriority(input: RelicCategory[] | undefined): RelicCategory[] {
  const unique = new Set(input ?? []);
  const normalized = ALL_RELIC_CATEGORIES.filter((category) => unique.has(category));
  for (const category of ALL_RELIC_CATEGORIES) {
    if (!unique.has(category)) {
      normalized.push(category);
    }
  }
  return normalized;
}

function normalizeGameSettings(input: GameSettings): GameSettings {
  return {
    ...input,
    relicPriority: normalizeRelicPriority(input.relicPriority),
  };
}

// Signals
export const audioSettings: Signal<AudioSettings> = signal<AudioSettings>(loadSettings(STORAGE_KEY_AUDIO, DEFAULT_AUDIO_SETTINGS));
export const graphicsSettings: Signal<GraphicsSettings> = signal<GraphicsSettings>(loadSettings(STORAGE_KEY_GRAPHICS, DEFAULT_GRAPHICS_SETTINGS));
export const gameSettings: Signal<GameSettings> = signal<GameSettings>(
  normalizeGameSettings(loadSettings(STORAGE_KEY_GAME, DEFAULT_GAME_SETTINGS))
);

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
  const next = { ...gameSettings.value, ...updates };
  gameSettings.value = normalizeGameSettings(next);
}

/**
 * First session VFX boost multiplier.
 * During the first few waves, we enhance particles and effects
 * to create a more impactful first impression.
 */
export const FIRST_SESSION_VFX_BOOST = 1.5;

/**
 * Lower damage threshold for screen shake during first session.
 * Makes combat feel more impactful for new players.
 */
export const FIRST_SESSION_SHAKE_THRESHOLD = 200; // Normal is 1000

// ============================================================================
// AUTO-PLAY SETTINGS (Idle/Incremental Features)
// ============================================================================

export interface AutoPlaySettings {
  /** Whether auto-play is enabled */
  enabled: boolean;

  /** Priority for relic selection */
  relicPriority: AutoPlayRelicPriority;

  /** Priority for shop purchases */
  shopPriority: AutoPlayShopPriority;

  /** When to activate fortress skills */
  skillActivation: AutoPlaySkillMode;

  /** Minimum HP percentage before buying heals (0-1) */
  healThreshold: number;
}

const DEFAULT_AUTO_PLAY_SETTINGS: AutoPlaySettings = {
  enabled: false,
  relicPriority: 'balanced',
  shopPriority: 'balanced',
  skillActivation: 'on_cooldown',
  healThreshold: 0.5,
};

// Speed & Automation Settings
export interface SpeedSettings {
  /** Game speed multiplier (1, 2, or 5) */
  speedMultiplier: 1 | 2 | 5;

  /** Skip wave transition animations */
  skipWaveAnimations: boolean;

  /** Skip relic selection animations */
  skipRelicAnimations: boolean;

  /** Auto-restart after game over */
  autoRestart: boolean;

  /** Delay before auto-restart in ms */
  autoRestartDelay: number;
}

const DEFAULT_SPEED_SETTINGS: SpeedSettings = {
  speedMultiplier: 1,
  skipWaveAnimations: false,
  skipRelicAnimations: false,
  autoRestart: false,
  autoRestartDelay: 5000,
};

const STORAGE_KEY_AUTO_PLAY = 'arcade_auto_play_settings';
const STORAGE_KEY_SPEED = 'arcade_speed_settings';

// Auto-Play Signal
export const autoPlaySettings: Signal<AutoPlaySettings> = signal<AutoPlaySettings>(
  loadSettings(STORAGE_KEY_AUTO_PLAY, DEFAULT_AUTO_PLAY_SETTINGS)
);

// Speed Settings Signal
export const speedSettings: Signal<SpeedSettings> = signal<SpeedSettings>(
  loadSettings(STORAGE_KEY_SPEED, DEFAULT_SPEED_SETTINGS)
);

// Persist auto-play settings
effect(() => {
  saveSettings(STORAGE_KEY_AUTO_PLAY, autoPlaySettings.value);
});

// Persist speed settings
effect(() => {
  saveSettings(STORAGE_KEY_SPEED, speedSettings.value);
});

// Update functions
export function updateAutoPlaySettings(updates: Partial<AutoPlaySettings>) {
  autoPlaySettings.value = { ...autoPlaySettings.value, ...updates };
}

export function updateSpeedSettings(updates: Partial<SpeedSettings>) {
  speedSettings.value = { ...speedSettings.value, ...updates };
}

// Convenience toggles
export function toggleAutoPlay() {
  autoPlaySettings.value = {
    ...autoPlaySettings.value,
    enabled: !autoPlaySettings.value.enabled,
  };
}

export function cycleSpeedMultiplier() {
  const current = speedSettings.value.speedMultiplier;
  const next = current === 1 ? 2 : current === 2 ? 5 : 1;
  speedSettings.value = { ...speedSettings.value, speedMultiplier: next };
}

export function toggleAutoRestart() {
  speedSettings.value = {
    ...speedSettings.value,
    autoRestart: !speedSettings.value.autoRestart,
  };
}

export function toggleSkipAnimations() {
  const current = speedSettings.value.skipWaveAnimations;
  speedSettings.value = {
    ...speedSettings.value,
    skipWaveAnimations: !current,
    skipRelicAnimations: !current, // Toggle both together for simplicity
  };
}

// Quick presets
export function setAutoPlayPreset(preset: 'damage' | 'defense' | 'gold' | 'balanced') {
  const presets: Record<string, Partial<AutoPlaySettings>> = {
    damage: {
      relicPriority: 'damage',
      shopPriority: 'damage_first',
      healThreshold: 0.3,
    },
    defense: {
      relicPriority: 'defense',
      shopPriority: 'heal_first',
      healThreshold: 0.6,
    },
    gold: {
      relicPriority: 'gold',
      shopPriority: 'balanced',
      healThreshold: 0.4,
    },
    balanced: {
      relicPriority: 'balanced',
      shopPriority: 'balanced',
      healThreshold: 0.5,
    },
  };

  autoPlaySettings.value = {
    ...autoPlaySettings.value,
    ...presets[preset],
  };
}
