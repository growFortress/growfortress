import type { FortressClass, EnemyCategory, ClassColors, DeathColors, ParticleShape } from './types.js';
import type { EnemyType } from '@arcade/sim-core';

// Class-specific colors for VFX (7 classes)
export const CLASS_VFX_COLORS: Record<FortressClass, ClassColors> = {
  natural: { primary: 0x228b22, secondary: 0x32cd32, glow: 0x44ff44 },
  ice: { primary: 0x00bfff, secondary: 0x87ceeb, glow: 0xadd8e6 },
  fire: { primary: 0xff4500, secondary: 0xff6600, glow: 0xffaa00 },
  lightning: { primary: 0x9932cc, secondary: 0xda70d6, glow: 0xffffff },
  tech: { primary: 0x00f0ff, secondary: 0x00ffff, glow: 0xffffff },
  void: { primary: 0x4b0082, secondary: 0x8b008b, glow: 0x9400d3 },
  plasma: { primary: 0x00ffff, secondary: 0xff00ff, glow: 0xffffff },
};

// Enemy category colors for death VFX
export const ENEMY_DEATH_COLORS: Record<EnemyCategory, DeathColors> = {
  streets: { primary: 0xcc0000, secondary: 0x880000, particles: 'circle' },
  science: { primary: 0x00aaff, secondary: 0xffff00, particles: 'spark' },
  mutants: { primary: 0x44ff44, secondary: 0x00aa00, particles: 'smoke' },
  cosmos: { primary: 0xffffaa, secondary: 0xffd700, particles: 'star' },
  magic: { primary: 0x9933ff, secondary: 0xff33ff, particles: 'diamond' },
  gods: { primary: 0xffd700, secondary: 0xffaa00, particles: 'star' },
  default: { primary: 0xff4444, secondary: 0xaa0000, particles: 'circle' },
};

// Map enemy types to categories
export function getEnemyCategory(enemyType?: EnemyType): EnemyCategory {
  if (!enemyType) return 'default';
  switch (enemyType) {
    case 'gangster': case 'thug': case 'mafia_boss':
      return 'streets';
    case 'robot': case 'drone': case 'ai_core':
      return 'science';
    case 'sentinel': case 'mutant_hunter':
      return 'mutants';
    case 'kree_soldier': case 'skrull': case 'cosmic_beast':
      return 'cosmos';
    case 'demon': case 'sorcerer': case 'dimensional_being':
      return 'magic';
    case 'einherjar': case 'titan': case 'god':
      return 'gods';
    default:
      return 'default';
  }
}

// Explosion config per class
export interface ExplosionConfig {
  flashSize: number;
  ringSize: number;
  debrisCount: number;
  smokeCount: number;
  debrisShape: ParticleShape;
  debrisGravity: number;
  screenShake: number;
  useShockwave: boolean;
}

export const CLASS_EXPLOSION_CONFIG: Record<FortressClass, ExplosionConfig> = {
  natural: {
    flashSize: 28,
    ringSize: 80,
    debrisCount: 25,
    smokeCount: 8,
    debrisShape: 'square',
    debrisGravity: 150,
    screenShake: 3,
    useShockwave: true,
  },
  ice: {
    flashSize: 25,
    ringSize: 70,
    debrisCount: 20,
    smokeCount: 4,
    debrisShape: 'diamond',
    debrisGravity: 120,
    screenShake: 2,
    useShockwave: true,
  },
  fire: {
    flashSize: 32,
    ringSize: 90,
    debrisCount: 30,
    smokeCount: 12,
    debrisShape: 'circle',
    debrisGravity: -80, // Fire rises
    screenShake: 4,
    useShockwave: true,
  },
  lightning: {
    flashSize: 30,
    ringSize: 85,
    debrisCount: 22,
    smokeCount: 5,
    debrisShape: 'spark',
    debrisGravity: 100,
    screenShake: 3.5,
    useShockwave: true,
  },
  tech: {
    flashSize: 26,
    ringSize: 75,
    debrisCount: 20,
    smokeCount: 6,
    debrisShape: 'square',
    debrisGravity: 130,
    screenShake: 2.5,
    useShockwave: true,
  },
  void: {
    flashSize: 35,
    ringSize: 100,
    debrisCount: 18,
    smokeCount: 10,
    debrisShape: 'diamond',
    debrisGravity: 80,
    screenShake: 4,
    useShockwave: true,
  },
  plasma: {
    flashSize: 30,
    ringSize: 85,
    debrisCount: 24,
    smokeCount: 7,
    debrisShape: 'circle',
    debrisGravity: 90,
    screenShake: 3.5,
    useShockwave: true,
  },
};

// Death VFX config per enemy category
export interface DeathConfig {
  flashSize: number;
  ringStartSize: number;
  ringEndSize: number;
  ringLife: number;
  particleCount: number;
  particleSpeed: number;
  useDisintegration: boolean;
}

export const CATEGORY_DEATH_CONFIG: Record<EnemyCategory, DeathConfig> = {
  streets: {
    flashSize: 10,
    ringStartSize: 5,
    ringEndSize: 25,
    ringLife: 0.25,
    particleCount: 6,
    particleSpeed: 40,
    useDisintegration: false,
  },
  science: {
    flashSize: 12,
    ringStartSize: 6,
    ringEndSize: 30,
    ringLife: 0.3,
    particleCount: 10,
    particleSpeed: 60,
    useDisintegration: true,
  },
  mutants: {
    flashSize: 10,
    ringStartSize: 5,
    ringEndSize: 28,
    ringLife: 0.35,
    particleCount: 8,
    particleSpeed: 35,
    useDisintegration: false,
  },
  cosmos: {
    flashSize: 15,
    ringStartSize: 8,
    ringEndSize: 35,
    ringLife: 0.4,
    particleCount: 12,
    particleSpeed: 50,
    useDisintegration: true,
  },
  magic: {
    flashSize: 12,
    ringStartSize: 6,
    ringEndSize: 32,
    ringLife: 0.35,
    particleCount: 10,
    particleSpeed: 45,
    useDisintegration: true,
  },
  gods: {
    flashSize: 18,
    ringStartSize: 10,
    ringEndSize: 40,
    ringLife: 0.45,
    particleCount: 14,
    particleSpeed: 55,
    useDisintegration: true,
  },
  default: {
    flashSize: 10,
    ringStartSize: 5,
    ringEndSize: 25,
    ringLife: 0.25,
    particleCount: 6,
    particleSpeed: 40,
    useDisintegration: false,
  },
};

// Text style configs
export interface DamageTextConfig {
  baseFontSize: number;
  maxFontSize: number;
  strokeWidth: number;
  shadowBlur: number;
  floatSpeed: number;
  floatLife: number;
  driftX: number;
}

export const DAMAGE_TEXT_CONFIG: DamageTextConfig = {
  baseFontSize: 18,
  maxFontSize: 42,
  strokeWidth: 4,
  shadowBlur: 3,
  floatSpeed: -50,
  floatLife: 0.8,
  driftX: 8,
};

export const CRIT_TEXT_CONFIG: DamageTextConfig = {
  baseFontSize: 22,
  maxFontSize: 48,
  strokeWidth: 5,
  shadowBlur: 5,
  floatSpeed: -40,
  floatLife: 1.0,
  driftX: 10,
};

// Kill streak thresholds and names
export interface StreakConfig {
  threshold: number;
  nameKey: string;
  color: number;
  fontSize: number;
  shake: number;
  flash: boolean;
}

export const STREAK_CONFIGS: StreakConfig[] = [
  { threshold: 3, nameKey: 'game:vfx.killStreak.doubleKill', color: 0xffcc00, fontSize: 26, shake: 0, flash: false },
  { threshold: 5, nameKey: 'game:vfx.killStreak.tripleKill', color: 0xff8800, fontSize: 28, shake: 0, flash: true },
  { threshold: 10, nameKey: 'game:vfx.killStreak.rampage', color: 0xff4400, fontSize: 30, shake: 3, flash: true },
  { threshold: 15, nameKey: 'game:vfx.killStreak.dominating', color: 0xff0066, fontSize: 32, shake: 4, flash: true },
  { threshold: 20, nameKey: 'game:vfx.killStreak.godlike', color: 0xff00ff, fontSize: 36, shake: 5, flash: true },
];

// Combo visual configs
export interface ComboConfig {
  nameKey: string;
  color: number;
  ringSize: number;
}

export const COMBO_CONFIGS: Record<string, ComboConfig> = {
  steam_burst: { nameKey: 'game:vfx.combos.steamBurst', color: 0xff8844, ringSize: 40 },
  electrocute: { nameKey: 'game:vfx.combos.electrocute', color: 0x44aaff, ringSize: 45 },
  shatter: { nameKey: 'game:vfx.combos.shatter', color: 0xcc88ff, ringSize: 42 },
};

// Special skill color palettes
export const SKILL_COLORS = {
  hammer: { primary: 0x4169e1, secondary: 0x87ceeb, glow: 0xffff00 },
  shield: { red: 0xdc143c, white: 0xffffff, blue: 0x4169e1 },
  missile: { primary: 0xb22222, secondary: 0xffd700, smoke: 0x666666 },
  plasma: { primary: 0xdc143c, secondary: 0xff69b4, dark: 0x8b0000 },
  omega: { primary: 0xffd700, secondary: 0x1a1a2a, glow: 0xffaa00 },
  portal: { primary: 0x8844cc, secondary: 0x6622aa, glow: 0xaa66ff, dark: 0x220044 },
};
