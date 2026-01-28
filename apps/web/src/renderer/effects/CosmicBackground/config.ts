/**
 * Theme configurations for each pillar's cosmic background
 * UPDATED: Increased visibility of all effects
 */

import type { PillarId } from '@arcade/sim-core';
import type { CosmicConfig } from './types.js';

// ============================================================================
// STREETS - Dark urban sky with smog and light pollution
// ============================================================================

const STREETS_CONFIG: CosmicConfig = {
  gradient: {
    topColor: 0x05050f,
    bottomColor: 0x0f0f25,
    noiseIntensity: 0.1,
    shiftSpeed: 0.015,
  },
  nebula: {
    enabled: true,
    colors: [0x101030, 0x202050, 0x151540], // Dark blue-purple urban haze
    count: 1,
    opacity: 0.6,
    scale: 2.5,
    animationSpeed: 0.15,
  },
  stars: {
    color: 0xffffff,
    secondaryColor: 0xaaddff,
    count: 80, // Few stars - light pollution
    twinkleSpeed: 1.5,
    brightnessRange: [0.3, 0.7], // Dim due to light pollution
    sizeRange: [0.8, 2.0],
    shootingStarChance: 0.0005,
    constellationDensity: 0.1,
  },
  dust: {
    color: 0x555566,
    count: 40,
    speed: 8,
    direction: Math.PI * 0.2,
    sizeRange: [2, 5],
    alpha: 0.25,
  },
  special: {
    type: 'smoke',
    color: 0x252535,
    secondaryColor: 0x353545,
    frequency: 0.5,
    intensity: 0.7,
  },
};

// ============================================================================
// SCIENCE - Clean tech environment with digital aesthetics
// ============================================================================

const SCIENCE_CONFIG: CosmicConfig = {
  gradient: {
    topColor: 0x020812,
    bottomColor: 0x081828,
    noiseIntensity: 0.08,
    shiftSpeed: 0.02,
  },
  nebula: {
    enabled: true,
    colors: [0x082840, 0x105060, 0x0a3850], // Cyan-teal tech nebula
    count: 1,
    opacity: 0.5,
    scale: 2.8,
    animationSpeed: 0.25,
  },
  stars: {
    color: 0x64ffda,
    secondaryColor: 0x00ffff,
    count: 150,
    twinkleSpeed: 3.5,
    brightnessRange: [0.5, 1.0],
    sizeRange: [0.5, 2.0],
    shootingStarChance: 0.001,
    constellationDensity: 0.2,
  },
  dust: {
    color: 0x00ddff,
    count: 50,
    speed: 25,
    direction: Math.PI * 0.5,
    sizeRange: [1, 3],
    alpha: 0.35,
  },
  special: {
    type: 'data_streams',
    color: 0x00f0ff,
    secondaryColor: 0x64ffda,
    frequency: 0.7,
    intensity: 0.9,
  },
};

// ============================================================================
// MUTANTS - Toxic, ruined atmosphere with radiation
// ============================================================================

const MUTANTS_CONFIG: CosmicConfig = {
  gradient: {
    topColor: 0x0a0302,
    bottomColor: 0x150805,
    noiseIntensity: 0.18,
    shiftSpeed: 0.012,
  },
  nebula: {
    enabled: true,
    colors: [0x301008, 0x481810, 0x200a05], // Toxic red-brown
    count: 1,
    opacity: 0.6,
    scale: 2.5,
    animationSpeed: 0.18,
  },
  stars: {
    color: 0xffaa88,
    secondaryColor: 0xff6644,
    count: 50,
    twinkleSpeed: 1.0,
    brightnessRange: [0.3, 0.7],
    sizeRange: [0.8, 2.0],
    shootingStarChance: 0,
    constellationDensity: 0.1,
  },
  dust: {
    color: 0x66cc33,
    count: 50,
    speed: 12,
    direction: Math.PI * 1.1,
    sizeRange: [2, 5],
    alpha: 0.3,
  },
  special: {
    type: 'smoke',
    color: 0x352010,
    secondaryColor: 0x452818,
    frequency: 0.6,
    intensity: 0.9,
  },
};

// ============================================================================
// COSMOS - Classic deep space with nebulae and stars (FLAGSHIP!)
// ============================================================================

const COSMOS_CONFIG: CosmicConfig = {
  gradient: {
    topColor: 0x020210,
    bottomColor: 0x08002a,
    noiseIntensity: 0.12,
    shiftSpeed: 0.01,
  },
  nebula: {
    enabled: true,
    colors: [0x1a0050, 0x3a1080, 0x5020a0], // Rich purple nebula
    count: 1,
    opacity: 0.75,
    scale: 3.0,
    animationSpeed: 0.2,
  },
  stars: {
    color: 0xffffff,
    secondaryColor: 0xaaccff,
    count: 350,
    twinkleSpeed: 2.0,
    brightnessRange: [0.4, 1.0],
    sizeRange: [0.5, 3.5],
    shootingStarChance: 0.003,
    constellationDensity: 0.35,
  },
  dust: {
    color: 0x7744cc,
    count: 60,
    speed: 5,
    direction: Math.PI * 1.6,
    sizeRange: [1, 3],
    alpha: 0.25,
  },
  special: {
    type: 'portals',
    color: 0x9955ee,
    secondaryColor: 0x7733cc,
    frequency: 0.3,
    intensity: 0.8,
  },
};

// ============================================================================
// MAGIC - Mystical atmosphere with golden particles
// ============================================================================

const MAGIC_CONFIG: CosmicConfig = {
  gradient: {
    topColor: 0x080418,
    bottomColor: 0x120830,
    noiseIntensity: 0.15,
    shiftSpeed: 0.02,
  },
  nebula: {
    enabled: true,
    colors: [0x281848, 0x401870, 0x1a1040], // Mystical purple
    count: 1,
    opacity: 0.65,
    scale: 2.8,
    animationSpeed: 0.22,
  },
  stars: {
    color: 0xfbbf24,
    secondaryColor: 0xffdd66,
    count: 160,
    twinkleSpeed: 2.0,
    brightnessRange: [0.5, 1.0],
    sizeRange: [0.8, 2.5],
    shootingStarChance: 0.002,
    constellationDensity: 0.25,
  },
  dust: {
    color: 0xeebb00,
    count: 55,
    speed: 8,
    direction: -Math.PI * 0.3,
    sizeRange: [1, 3],
    alpha: 0.35,
  },
  special: {
    type: 'runes',
    color: 0xfbbf24,
    secondaryColor: 0xffaa00,
    frequency: 0.45,
    intensity: 0.9,
  },
};

// ============================================================================
// GODS - Divine golden realm with celestial effects
// ============================================================================

const GODS_CONFIG: CosmicConfig = {
  gradient: {
    topColor: 0x080806,
    bottomColor: 0x141410,
    noiseIntensity: 0.1,
    shiftSpeed: 0.015,
  },
  nebula: {
    enabled: true,
    colors: [0x2a2518, 0x3a3520, 0x1a1810], // Golden divine glow
    count: 1,
    opacity: 0.55,
    scale: 3.0,
    animationSpeed: 0.18,
  },
  stars: {
    color: 0xffd700,
    secondaryColor: 0xffffff,
    count: 200,
    twinkleSpeed: 1.6,
    brightnessRange: [0.5, 1.0],
    sizeRange: [0.8, 3.5],
    shootingStarChance: 0.002,
    constellationDensity: 0.35,
  },
  dust: {
    color: 0xffdd88,
    count: 45,
    speed: 7,
    direction: Math.PI * 0.8,
    sizeRange: [1.5, 4],
    alpha: 0.3,
  },
  special: {
    type: 'divine_rays',
    color: 0xffd700,
    secondaryColor: 0xffffcc,
    frequency: 0.35,
    intensity: 0.95,
  },
};

// ============================================================================
// CONFIG MAP
// ============================================================================

export const COSMIC_CONFIGS: Record<PillarId, CosmicConfig> = {
  streets: STREETS_CONFIG,
  science: SCIENCE_CONFIG,
  mutants: MUTANTS_CONFIG,
  cosmos: COSMOS_CONFIG,
  magic: MAGIC_CONFIG,
  gods: GODS_CONFIG,
};

// Default config (used before theme is set)
export const DEFAULT_CONFIG = STREETS_CONFIG;

// ============================================================================
// LEGACY STAR COLOR TO PILLAR MAPPING
// For backwards compatibility with setTheme(ParallaxConfig)
// ============================================================================

export const STAR_COLOR_TO_PILLAR: Map<number, PillarId> = new Map([
  [0x64ffda, 'science'],
  [0xffaaaa, 'mutants'],
  [0xfbbf24, 'magic'],
  [0xffd700, 'gods'],
]);

// For white stars, we need to check cloud color
export const CLOUD_COLOR_TO_PILLAR: Map<number, PillarId> = new Map([
  [0x1a1a30, 'streets'],
  [0x190061, 'cosmos'],
]);

/**
 * Detect pillar from legacy ParallaxConfig
 */
export function detectPillarFromConfig(starColor: number, cloudColor: number): PillarId {
  // Check unique star colors first
  const pillarByStarColor = STAR_COLOR_TO_PILLAR.get(starColor);
  if (pillarByStarColor) {
    return pillarByStarColor;
  }

  // For white/neutral stars, check cloud color
  const pillarByCloudColor = CLOUD_COLOR_TO_PILLAR.get(cloudColor);
  if (pillarByCloudColor) {
    return pillarByCloudColor;
  }

  // Default to cosmos for white stars (most common cosmic look)
  if (starColor === 0xffffff) {
    return 'cosmos';
  }

  // Fallback to streets
  return 'streets';
}
