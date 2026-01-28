/**
 * Type definitions for the Cosmic Background System
 */

import type { PillarId } from '@arcade/sim-core';

// ============================================================================
// QUALITY LEVELS
// ============================================================================

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityMultipliers {
  starCount: number;
  dustCount: number;
  nebulaCount: number;
  nebulaDetail: number;
  specialEffects: boolean;
}

// ============================================================================
// LAYER CONFIGURATIONS
// ============================================================================

export interface GradientConfig {
  topColor: number;
  bottomColor: number;
  noiseIntensity: number;  // 0-1, amount of color variation
  shiftSpeed: number;      // Animation speed multiplier
}

export interface NebulaConfig {
  enabled: boolean;
  colors: number[];        // Array of nebula colors
  count: number;           // Number of nebula patches (0-8)
  opacity: number;         // Base opacity (0-1)
  scale: number;           // Size multiplier
  animationSpeed: number;  // Drift speed
}

export interface StarConfig {
  color: number;
  secondaryColor?: number; // For multi-colored star fields
  count: number;           // Base count (scaled by quality)
  twinkleSpeed: number;    // 0-5
  brightnessRange: [number, number]; // [min, max] alpha
  sizeRange: [number, number];       // [min, max] size
  shootingStarChance: number;        // Per-frame probability (0-0.01)
  constellationDensity: number;      // Bright star ratio (0-1)
}

export interface DustConfig {
  color: number;
  count: number;
  speed: number;           // Drift speed in px/s
  direction: number;       // Angle in radians
  sizeRange: [number, number];
  alpha: number;
}

export type SpecialEffectType =
  | 'none'
  | 'smoke'
  | 'data_streams'
  | 'lightning'
  | 'runes'
  | 'portals'
  | 'divine_rays';

export interface SpecialEffectConfig {
  type: SpecialEffectType;
  color: number;
  secondaryColor?: number;
  frequency: number;       // How often effects appear (0-1)
  intensity: number;       // Effect strength (0-1)
}

// ============================================================================
// MAIN CONFIG
// ============================================================================

export interface CosmicConfig {
  gradient: GradientConfig;
  nebula: NebulaConfig;
  stars: StarConfig;
  dust: DustConfig;
  special: SpecialEffectConfig;
}

// ============================================================================
// INTERNAL DATA STRUCTURES
// ============================================================================

export interface Star {
  x: number;
  y: number;
  size: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  color: number;
  isBright: boolean;
}

export interface Nebula {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  color: number;
  alpha: number;
  phase: number;
  noiseOffsetX: number;
  noiseOffsetY: number;
  rotation: number;
}

export interface DustParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
}

export interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  life: number;
  maxLife: number;
  color: number;
}

export interface SmokeCloud {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  vx: number;
  vy: number;
  life: number;
}

export interface DataStream {
  x: number;
  y: number;
  length: number;
  speed: number;
  alpha: number;
  isVertical: boolean;
}

export interface LightningBolt {
  segments: Array<{ x: number; y: number }>;
  alpha: number;
  life: number;
  color: number;
}

export interface FloatingRune {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
  shape: number; // 0-5 for different rune shapes
  pulsePhase: number;
}

export interface Portal {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  alpha: number;
  pulsePhase: number;
}

export interface DivineRay {
  x: number;
  angle: number;
  width: number;
  alpha: number;
  length: number;
  pulsePhase: number;
}

// ============================================================================
// LEGACY API COMPATIBILITY
// ============================================================================

/**
 * Legacy ParallaxConfig interface for backwards compatibility
 * Used by ThemeManager.ts
 */
export interface ParallaxConfig {
  starColor: number;
  cloudColor: number;
  starCount: number;
  cloudCount: number;
  cloudSpeed: number;
}

// ============================================================================
// QUALITY PRESETS
// ============================================================================

export const QUALITY_MULTIPLIERS: Record<QualityLevel, QualityMultipliers> = {
  low: {
    starCount: 0.3,
    dustCount: 0.3,
    nebulaCount: 0.5,
    nebulaDetail: 2,
    specialEffects: false,
  },
  medium: {
    starCount: 0.6,
    dustCount: 0.6,
    nebulaCount: 0.75,
    nebulaDetail: 3,
    specialEffects: true,
  },
  high: {
    starCount: 1.0,
    dustCount: 1.0,
    nebulaCount: 1.0,
    nebulaDetail: 5,
    specialEffects: true,
  },
};

// Re-export PillarId for convenience
export type { PillarId };
