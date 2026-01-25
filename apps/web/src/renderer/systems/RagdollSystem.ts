/**
 * RagdollSystem - Visual-only death physics for absurdly satisfying enemy deaths
 *
 * Features:
 * - Ragdoll bodies with tumbling, spinning physics
 * - Wall and ground bounces with energy loss
 * - Squash & stretch on impact
 * - Domino effect - flying bodies can hit other enemies
 * - Trail particles while flying
 * - Class-specific debris colors
 */

import { Container, Graphics } from 'pixi.js';
import type { EnemyType, FortressClass, DeathPhysicsEvent } from '@arcade/sim-core';
import { FP } from '@arcade/sim-core';
import { fpXToScreen, fpYToScreen } from '../CoordinateSystem.js';
import { graphicsSettings } from '../../state/settings.signals.js';

// ============================================================================
// TYPES
// ============================================================================

interface RagdollBody {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  angularVelocity: number;
  bounceCount: number;
  lifetime: number;
  maxLifetime: number;
  enemyType: EnemyType;
  sourceClass: FortressClass;
  isElite: boolean;
  isBigKill: boolean;
  container: Container;
  body: Graphics;
  // Squash/stretch animation
  squashProgress: number;
  lastBounceTime: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RAGDOLL_CONFIG = {
  // Physics
  gravity: 1200, // pixels/sec^2 (slightly exaggerated for fun)
  bounceRestitution: 0.55, // Energy retained on bounce
  friction: 0.92, // Air friction
  angularFriction: 0.95, // Rotation slowdown
  groundFriction: 0.85, // Extra friction when on ground

  // Limits
  maxRagdolls: 50, // Pool size
  maxBounces: 6, // Stop bouncing after this
  maxLifetime: 4000, // ms before fade out
  fadeOutDuration: 500, // ms to fade

  // Visual
  velocityScale: 180, // Convert sim velocity to screen velocity
  spinScale: 2.5, // Convert sim spin to visual spin
  squashDuration: 150, // ms for squash animation
  squashIntensity: 0.35, // Max squash amount

  // Trail
  trailSpawnInterval: 50, // ms between trail particles
  trailParticleCount: 2,

  // Domino
  dominoEnabled: true,
  dominoRadius: 40, // pixels
  dominoMinVelocity: 200, // minimum velocity to trigger domino
};

// Enemy colors (same as EnemySystem for consistency)
const ENEMY_COLORS: Partial<Record<EnemyType, number>> = {
  runner: 0x44ff44,
  bruiser: 0xff4444,
  leech: 0xaa44ff,
  gangster: 0x888888,
  thug: 0x666666,
  mafia_boss: 0x222222,
  robot: 0x00ccff,
  drone: 0x88ddff,
  ai_core: 0x00ffff,
  sentinel: 0xff6600,
  mutant_hunter: 0xcc4400,
  kree_soldier: 0x3366ff,
  skrull: 0x33cc33,
  cosmic_beast: 0x9900cc,
  demon: 0xff0066,
  sorcerer: 0xcc00ff,
  dimensional_being: 0x6600cc,
  einherjar: 0xffcc00,
  titan: 0x996600,
  god: 0xffff00,
  catapult: 0x8b4513,
  sapper: 0xff8c00,
  healer: 0x00ff7f,
  shielder: 0x4169e1,
  teleporter: 0x9400d3,
  scatterer: 0xff69b4,
  lone_wolf: 0x808080,
};

// Enemy sizes (approximate, for ragdoll visuals)
const ENEMY_SIZES: Partial<Record<EnemyType, number>> = {
  runner: 18,
  bruiser: 30,
  leech: 22,
  gangster: 18,
  thug: 24,
  mafia_boss: 36,
  robot: 22,
  drone: 16,
  ai_core: 32,
  sentinel: 28,
  mutant_hunter: 26,
  kree_soldier: 22,
  skrull: 24,
  cosmic_beast: 34,
  demon: 26,
  sorcerer: 22,
  dimensional_being: 30,
  einherjar: 26,
  titan: 38,
  god: 42,
  catapult: 32,
  sapper: 20,
  healer: 20,
  shielder: 26,
  teleporter: 22,
  scatterer: 24,
  lone_wolf: 22,
};

// ============================================================================
// RAGDOLL SYSTEM CLASS
// ============================================================================

export class RagdollSystem {
  public container: Container;
  private ragdolls: RagdollBody[] = [];
  private nextId = 0;

  // Screen bounds (set on update)
  private groundY = 0;
  private wallXMin = 0;
  private wallXMax = 0;

  // Trail particle callback
  private trailCallback: ((x: number, y: number, color: number) => void) | null = null;
  private lastTrailTime = 0;

  // Camera effects callback
  private cameraShakeCallback: ((intensity: number, duration: number) => void) | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = 'ragdolls';
  }

  /**
   * Set callback for trail particles
   */
  public setTrailCallback(callback: (x: number, y: number, color: number) => void): void {
    this.trailCallback = callback;
  }

  /**
   * Set callback for camera shake
   */
  public setCameraShakeCallback(callback: (intensity: number, duration: number) => void): void {
    this.cameraShakeCallback = callback;
  }

  /**
   * Spawn a ragdoll from death physics event
   */
  public spawnFromDeathPhysics(
    event: DeathPhysicsEvent,
    viewWidth: number,
    viewHeight: number
  ): void {
    // Check quality settings
    const quality = graphicsSettings.value.quality;
    const maxRagdolls = quality === 'low' ? 15 : quality === 'medium' ? 30 : RAGDOLL_CONFIG.maxRagdolls;

    // Recycle oldest if at limit
    if (this.ragdolls.length >= maxRagdolls) {
      const oldest = this.ragdolls.shift();
      if (oldest) {
        this.container.removeChild(oldest.container);
        oldest.container.destroy();
      }
    }

    // Convert fixed-point positions to screen coordinates
    const screenX = fpXToScreen(event.x, viewWidth);
    const screenY = fpYToScreen(event.y, viewHeight);

    // Convert fixed-point velocity to screen velocity
    const vx = FP.toFloat(event.kbX) * RAGDOLL_CONFIG.velocityScale;
    const vy = FP.toFloat(event.kbY) * RAGDOLL_CONFIG.velocityScale;

    // Get enemy visual properties
    const color = ENEMY_COLORS[event.enemyType] ?? 0xffffff;
    const baseSize = ENEMY_SIZES[event.enemyType] ?? 20;
    const size = event.isElite ? baseSize * 1.3 : baseSize;

    // Create visual container
    const container = new Container();
    container.position.set(screenX, screenY);

    // Create body graphics
    const body = new Graphics();
    this.drawRagdollBody(body, event.enemyType, size, color, event.isElite);
    container.addChild(body);

    // Add to scene
    this.container.addChild(container);

    // Create ragdoll body
    const ragdoll: RagdollBody = {
      id: this.nextId++,
      x: screenX,
      y: screenY,
      vx,
      vy,
      rotation: 0,
      angularVelocity: event.spinForce * RAGDOLL_CONFIG.spinScale,
      bounceCount: 0,
      lifetime: 0,
      maxLifetime: RAGDOLL_CONFIG.maxLifetime,
      enemyType: event.enemyType,
      sourceClass: event.sourceClass,
      isElite: event.isElite,
      isBigKill: event.isBigKill,
      container,
      body,
      squashProgress: 0,
      lastBounceTime: 0,
    };

    this.ragdolls.push(ragdoll);

    // Big kill gets camera shake
    if (event.isBigKill && this.cameraShakeCallback) {
      this.cameraShakeCallback(4, 200);
    }
  }

  /**
   * Draw ragdoll body (simplified enemy shape)
   */
  private drawRagdollBody(
    g: Graphics,
    _type: EnemyType,
    size: number,
    color: number,
    isElite: boolean
  ): void {
    g.clear();

    // Elite glow
    if (isElite) {
      g.circle(0, 0, size * 1.3).fill({ color: 0xffcc00, alpha: 0.2 });
    }

    // Main body (simple circle)
    g.circle(0, 0, size * 0.9).fill({ color });

    // Inner highlight
    g.circle(-size * 0.2, -size * 0.2, size * 0.3).fill({ color: 0xffffff, alpha: 0.3 });

    // "X" eyes for comedic dead look
    const eyeOffset = size * 0.25;
    const eyeSize = size * 0.15;
    g.moveTo(-eyeOffset - eyeSize, -eyeSize)
      .lineTo(-eyeOffset + eyeSize, eyeSize)
      .stroke({ color: 0x000000, width: 2 });
    g.moveTo(-eyeOffset + eyeSize, -eyeSize)
      .lineTo(-eyeOffset - eyeSize, eyeSize)
      .stroke({ color: 0x000000, width: 2 });
    g.moveTo(eyeOffset - eyeSize, -eyeSize)
      .lineTo(eyeOffset + eyeSize, eyeSize)
      .stroke({ color: 0x000000, width: 2 });
    g.moveTo(eyeOffset + eyeSize, -eyeSize)
      .lineTo(eyeOffset - eyeSize, eyeSize)
      .stroke({ color: 0x000000, width: 2 });
  }

  /**
   * Update all ragdolls
   */
  public update(deltaMs: number, viewWidth: number, viewHeight: number): void {
    // Calculate bounds (play area is roughly 35%-65% of screen height)
    this.groundY = viewHeight * 0.75;
    this.wallXMin = 50;
    this.wallXMax = viewWidth - 50;

    const dt = Math.min(deltaMs, 50) / 1000; // Cap delta to prevent huge jumps
    const now = performance.now();

    // Update each ragdoll
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const ragdoll = this.ragdolls[i];

      // Update lifetime
      ragdoll.lifetime += deltaMs;

      // Check for removal
      if (ragdoll.lifetime >= ragdoll.maxLifetime) {
        this.container.removeChild(ragdoll.container);
        ragdoll.container.destroy();
        this.ragdolls.splice(i, 1);
        continue;
      }

      // Apply gravity
      ragdoll.vy += RAGDOLL_CONFIG.gravity * dt;

      // Apply air friction
      ragdoll.vx *= Math.pow(RAGDOLL_CONFIG.friction, dt * 60);
      ragdoll.vy *= Math.pow(RAGDOLL_CONFIG.friction, dt * 60);
      ragdoll.angularVelocity *= Math.pow(RAGDOLL_CONFIG.angularFriction, dt * 60);

      // Update position
      ragdoll.x += ragdoll.vx * dt;
      ragdoll.y += ragdoll.vy * dt;

      // Update rotation
      ragdoll.rotation += ragdoll.angularVelocity * dt;

      // Ground bounce
      if (ragdoll.y > this.groundY && ragdoll.bounceCount < RAGDOLL_CONFIG.maxBounces) {
        ragdoll.y = this.groundY;
        ragdoll.vy = -ragdoll.vy * RAGDOLL_CONFIG.bounceRestitution;
        ragdoll.vx *= RAGDOLL_CONFIG.groundFriction;
        ragdoll.angularVelocity *= 0.7; // Reduce spin on ground hit
        ragdoll.bounceCount++;
        ragdoll.squashProgress = 1.0;
        ragdoll.lastBounceTime = now;

        // Small shake on bounce
        if (this.cameraShakeCallback && Math.abs(ragdoll.vy) > 150) {
          this.cameraShakeCallback(1, 50);
        }
      }

      // Wall bounces
      if (ragdoll.x < this.wallXMin) {
        ragdoll.x = this.wallXMin;
        ragdoll.vx = -ragdoll.vx * RAGDOLL_CONFIG.bounceRestitution;
        ragdoll.angularVelocity = -ragdoll.angularVelocity * 0.8;
        ragdoll.bounceCount++;
        ragdoll.squashProgress = 0.6;
      }
      if (ragdoll.x > this.wallXMax) {
        ragdoll.x = this.wallXMax;
        ragdoll.vx = -ragdoll.vx * RAGDOLL_CONFIG.bounceRestitution;
        ragdoll.angularVelocity = -ragdoll.angularVelocity * 0.8;
        ragdoll.bounceCount++;
        ragdoll.squashProgress = 0.6;
      }

      // Settle on ground after max bounces
      if (ragdoll.bounceCount >= RAGDOLL_CONFIG.maxBounces && ragdoll.y >= this.groundY - 5) {
        ragdoll.y = this.groundY;
        ragdoll.vy = 0;
        ragdoll.vx *= 0.9;
        ragdoll.angularVelocity *= 0.9;
      }

      // Update squash animation
      if (ragdoll.squashProgress > 0) {
        const timeSinceBounce = now - ragdoll.lastBounceTime;
        ragdoll.squashProgress = Math.max(0, 1 - timeSinceBounce / RAGDOLL_CONFIG.squashDuration);
      }

      // Apply visual transforms
      ragdoll.container.position.set(ragdoll.x, ragdoll.y);
      ragdoll.container.rotation = ragdoll.rotation;

      // Squash & stretch
      const squashAmount = ragdoll.squashProgress * RAGDOLL_CONFIG.squashIntensity;
      ragdoll.container.scale.set(
        1 + squashAmount, // Wider when squashed
        1 - squashAmount  // Shorter when squashed
      );

      // Fade out near end of lifetime
      const fadeStart = ragdoll.maxLifetime - RAGDOLL_CONFIG.fadeOutDuration;
      if (ragdoll.lifetime > fadeStart) {
        const fadeProgress = (ragdoll.lifetime - fadeStart) / RAGDOLL_CONFIG.fadeOutDuration;
        ragdoll.container.alpha = 1 - fadeProgress;
      }

      // Trail particles
      if (this.trailCallback && now - this.lastTrailTime > RAGDOLL_CONFIG.trailSpawnInterval) {
        const speed = Math.sqrt(ragdoll.vx * ragdoll.vx + ragdoll.vy * ragdoll.vy);
        if (speed > 100) {
          const color = ENEMY_COLORS[ragdoll.enemyType] ?? 0xffffff;
          this.trailCallback(ragdoll.x, ragdoll.y, color);
          this.lastTrailTime = now;
        }
      }
    }
  }

  /**
   * Check for domino effect - ragdolls hitting living enemies
   * Returns positions where domino hits occurred
   */
  public checkDominoEffect(enemyPositions: Array<{ x: number; y: number }>): Array<{ x: number; y: number; vx: number; vy: number }> {
    if (!RAGDOLL_CONFIG.dominoEnabled) return [];

    const quality = graphicsSettings.value.quality;
    if (quality === 'low') return []; // Skip domino on low quality

    const hits: Array<{ x: number; y: number; vx: number; vy: number }> = [];

    for (const ragdoll of this.ragdolls) {
      // Only check fast-moving ragdolls
      const speed = Math.sqrt(ragdoll.vx * ragdoll.vx + ragdoll.vy * ragdoll.vy);
      if (speed < RAGDOLL_CONFIG.dominoMinVelocity) continue;

      // Check collision with each enemy position
      for (const enemy of enemyPositions) {
        const dx = enemy.x - ragdoll.x;
        const dy = enemy.y - ragdoll.y;
        const distSq = dx * dx + dy * dy;
        const radiusSq = RAGDOLL_CONFIG.dominoRadius * RAGDOLL_CONFIG.dominoRadius;

        if (distSq < radiusSq) {
          hits.push({
            x: enemy.x,
            y: enemy.y,
            vx: ragdoll.vx * 0.5,
            vy: ragdoll.vy * 0.5,
          });

          // Reduce ragdoll velocity (momentum transfer)
          ragdoll.vx *= 0.5;
          ragdoll.vy *= 0.5;
        }
      }
    }

    return hits;
  }

  /**
   * Get active ragdoll count (for debugging)
   */
  public get count(): number {
    return this.ragdolls.length;
  }

  /**
   * Clear all ragdolls
   */
  public clear(): void {
    for (const ragdoll of this.ragdolls) {
      this.container.removeChild(ragdoll.container);
      ragdoll.container.destroy();
    }
    this.ragdolls = [];
  }
}
