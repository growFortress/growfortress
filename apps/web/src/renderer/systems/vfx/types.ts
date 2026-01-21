import type { FortressClass, EnemyType } from '@arcade/sim-core';

// Particle shape types
export type ParticleShape = 'circle' | 'square' | 'spark' | 'ring' | 'diamond' | 'star' | 'smoke' | 'confetti';

// Core particle interface
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
  shape?: ParticleShape;
  rotation?: number;
  rotationSpeed?: number;
  gravity?: number;
  startSize?: number;
  endSize?: number;
  alpha?: number;
  startAlpha?: number;
  endAlpha?: number;
  drag?: number;
  scaleX?: number;
  scaleY?: number;
  stage?: number;
  spawnSecondary?: boolean;
}

// Floating text for damage numbers, combos, etc.
export interface FloatingText {
  text: import('pixi.js').Text;
  life: number;
  maxLife: number;
  vy: number;
  vx?: number;
  scale?: number;
  targetScale?: number;
}

// Screen shake callback type
export type ScreenShakeCallback = (intensity: number, duration: number) => void;

// Lighting callback type for dynamic illumination
export type LightingCallback = (x: number, y: number, color: number, radius: number) => void;

// Class color config
export interface ClassColors {
  primary: number;
  secondary: number;
  glow: number;
}

// Enemy death color config
export interface DeathColors {
  primary: number;
  secondary: number;
  particles: ParticleShape;
}

// Enemy category for death VFX
export type EnemyCategory = 'streets' | 'science' | 'mutants' | 'cosmos' | 'magic' | 'gods' | 'default';

// Staged effect for multi-phase explosions
export interface StagedEffect {
  x: number;
  y: number;
  fortressClass: FortressClass;
  intensity: number;
  elapsed: number;
  stages: number[];
  kind: 'enhanced' | 'staggered';
}

// Particle spec for data-driven particle emission
export interface ParticleSpec {
  // Position
  x: number;
  y: number;
  offsetX?: number;
  offsetY?: number;
  
  // Velocity
  vx?: number;
  vy?: number;
  speed?: number;
  angle?: number;
  angleSpread?: number;
  
  // Lifecycle
  life: number;
  lifeVariance?: number;
  
  // Appearance
  size: number;
  sizeVariance?: number;
  startSize?: number;
  endSize?: number;
  color: number;
  colors?: number[];
  shape?: ParticleShape;
  
  // Alpha
  alpha?: number;
  startAlpha?: number;
  endAlpha?: number;
  
  // Physics
  gravity?: number;
  drag?: number;
  
  // Rotation
  rotation?: number;
  rotationSpeed?: number;
  
  // Advanced
  spawnSecondary?: boolean;
}

// Burst config for radial particle bursts
export interface BurstConfig {
  x: number;
  y: number;
  count: number;
  speed: number;
  speedVariance?: number;
  life: number;
  lifeVariance?: number;
  size: number;
  sizeVariance?: number;
  colors: number[];
  shape?: ParticleShape;
  gravity?: number;
  drag?: number;
  startAlpha?: number;
  endAlpha?: number;
}

// Flash config
export interface FlashConfig {
  x: number;
  y: number;
  color: number;
  size: number;
  life?: number;
}

// Ring config for shockwaves
export interface RingConfig {
  x: number;
  y: number;
  color: number;
  startSize: number;
  endSize: number;
  life: number;
  alpha?: number;
}

// Re-export types from sim-core
export type { FortressClass, EnemyType };
