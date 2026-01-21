/**
 * Performance Monitor
 *
 * Tracks rendering performance and automatically adjusts quality settings
 * to maintain smooth gameplay.
 *
 * Features:
 * - FPS tracking with rolling average
 * - Frame time monitoring
 * - Memory usage tracking
 * - Auto-quality adjustment
 * - Performance event callbacks
 */

import type { Application } from 'pixi.js';
import { logger } from '../utils/logger.js';

// =============================================================================
// Types
// =============================================================================

export type QualityLevel = 'ultra' | 'high' | 'medium' | 'low' | 'potato';

export interface PerformanceStats {
  fps: number;
  fpsAverage: number;
  frameTime: number;
  frameTimeAverage: number;
  memoryUsed: number;
  memoryLimit: number;
  drawCalls: number;
  qualityLevel: QualityLevel;
  isThrottling: boolean;
}

export interface PerformanceThresholds {
  targetFPS: number;
  minFPS: number;
  criticalFPS: number;
  maxFrameTime: number;
  memoryWarningPercent: number;
}

export interface QualitySettings {
  particleMultiplier: number;
  filterQuality: number;
  shadowsEnabled: boolean;
  glowEnabled: boolean;
  trailsEnabled: boolean;
  antialiasEnabled: boolean;
  blurQuality: number;
  maxParticles: number;
}

export type PerformanceEventType =
  | 'fps-drop'
  | 'fps-recovery'
  | 'quality-change'
  | 'memory-warning'
  | 'throttle-start'
  | 'throttle-end';

export type PerformanceEventCallback = (
  event: PerformanceEventType,
  data: PerformanceStats
) => void;

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  targetFPS: 60,
  minFPS: 45,
  criticalFPS: 30,
  maxFrameTime: 33, // ~30fps
  memoryWarningPercent: 80,
};

const QUALITY_SETTINGS: Record<QualityLevel, QualitySettings> = {
  ultra: {
    particleMultiplier: 1.5,
    filterQuality: 1,
    shadowsEnabled: true,
    glowEnabled: true,
    trailsEnabled: true,
    antialiasEnabled: true,
    blurQuality: 1,
    maxParticles: 3000,
  },
  high: {
    particleMultiplier: 1,
    filterQuality: 1,
    shadowsEnabled: true,
    glowEnabled: true,
    trailsEnabled: true,
    antialiasEnabled: true,
    blurQuality: 0.75,
    maxParticles: 2000,
  },
  medium: {
    particleMultiplier: 0.7,
    filterQuality: 0.75,
    shadowsEnabled: true,
    glowEnabled: true,
    trailsEnabled: false,
    antialiasEnabled: true,
    blurQuality: 0.5,
    maxParticles: 1500,
  },
  low: {
    particleMultiplier: 0.5,
    filterQuality: 0.5,
    shadowsEnabled: false,
    glowEnabled: true,
    trailsEnabled: false,
    antialiasEnabled: false,
    blurQuality: 0.25,
    maxParticles: 1000,
  },
  potato: {
    particleMultiplier: 0.25,
    filterQuality: 0.25,
    shadowsEnabled: false,
    glowEnabled: false,
    trailsEnabled: false,
    antialiasEnabled: false,
    blurQuality: 0,
    maxParticles: 500,
  },
};

const QUALITY_ORDER: QualityLevel[] = ['ultra', 'high', 'medium', 'low', 'potato'];

// =============================================================================
// Performance Monitor Class
// =============================================================================

export class PerformanceMonitor {
  private app: Application | null = null;
  private isRunning = false;

  // FPS tracking
  private frameCount = 0;
  private lastFrameTime = 0;
  private frameTimes: number[] = [];
  private fpsHistory: number[] = [];
  private readonly sampleSize = 60; // 1 second at 60fps

  // Quality management
  private currentQuality: QualityLevel = 'high';
  private autoQualityEnabled = true;
  private qualityCooldown = 0;
  private readonly qualityCooldownDuration = 3000; // 3 seconds between changes

  // Thresholds
  private thresholds: PerformanceThresholds = { ...DEFAULT_THRESHOLDS };

  // Throttling detection
  private isThrottling = false;
  private consecutiveLowFrames = 0;
  private readonly throttleThreshold = 10; // frames

  // Event callbacks
  private eventCallbacks: Set<PerformanceEventCallback> = new Set();

  // Stats
  private stats: PerformanceStats = {
    fps: 60,
    fpsAverage: 60,
    frameTime: 16.67,
    frameTimeAverage: 16.67,
    memoryUsed: 0,
    memoryLimit: 0,
    drawCalls: 0,
    qualityLevel: 'high',
    isThrottling: false,
  };

  // ===========================================================================
  // Initialization
  // ===========================================================================

  public init(app: Application): void {
    this.app = app;
    this.lastFrameTime = performance.now();
    this.isRunning = true;

    // Add to ticker
    app.ticker.add(this.update, this);

    logger.debug('[PerformanceMonitor] Initialized');
  }

  public destroy(): void {
    if (this.app) {
      this.app.ticker.remove(this.update, this);
    }
    this.isRunning = false;
    this.eventCallbacks.clear();
    logger.debug('[PerformanceMonitor] Destroyed');
  }

  // ===========================================================================
  // Main Update Loop
  // ===========================================================================

  private update = (): void => {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Track frame time
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.sampleSize) {
      this.frameTimes.shift();
    }

    // Calculate FPS
    const fps = frameTime > 0 ? 1000 / frameTime : 60;
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > this.sampleSize) {
      this.fpsHistory.shift();
    }

    // Calculate averages
    const fpsAverage = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    const frameTimeAverage = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    // Update stats
    this.stats.fps = Math.round(fps);
    this.stats.fpsAverage = Math.round(fpsAverage);
    this.stats.frameTime = frameTime;
    this.stats.frameTimeAverage = frameTimeAverage;
    this.stats.qualityLevel = this.currentQuality;
    this.stats.isThrottling = this.isThrottling;

    // Update memory if available
    if ((performance as any).memory) {
      const mem = (performance as any).memory;
      this.stats.memoryUsed = mem.usedJSHeapSize;
      this.stats.memoryLimit = mem.jsHeapSizeLimit;
    }

    // Check for throttling
    this.checkThrottling(fps);

    // Auto-adjust quality
    if (this.autoQualityEnabled) {
      this.qualityCooldown = Math.max(0, this.qualityCooldown - frameTime);
      this.autoAdjustQuality(fpsAverage);
    }

    this.frameCount++;
  };

  // ===========================================================================
  // Throttling Detection
  // ===========================================================================

  private checkThrottling(fps: number): void {
    if (fps < this.thresholds.criticalFPS) {
      this.consecutiveLowFrames++;

      if (!this.isThrottling && this.consecutiveLowFrames >= this.throttleThreshold) {
        this.isThrottling = true;
        this.emitEvent('throttle-start');
      }
    } else {
      if (this.isThrottling && this.consecutiveLowFrames === 0) {
        this.isThrottling = false;
        this.emitEvent('throttle-end');
      }
      this.consecutiveLowFrames = Math.max(0, this.consecutiveLowFrames - 1);
    }
  }

  // ===========================================================================
  // Auto Quality Adjustment
  // ===========================================================================

  private autoAdjustQuality(fpsAverage: number): void {
    if (this.qualityCooldown > 0) return;

    const currentIndex = QUALITY_ORDER.indexOf(this.currentQuality);

    // Need to lower quality
    if (fpsAverage < this.thresholds.minFPS && currentIndex < QUALITY_ORDER.length - 1) {
      const newQuality = QUALITY_ORDER[currentIndex + 1];
      this.setQuality(newQuality);
      this.qualityCooldown = this.qualityCooldownDuration;
      this.emitEvent('quality-change');
      logger.debug(
        `[PerformanceMonitor] Quality reduced: ${this.currentQuality} -> ${newQuality} (FPS: ${Math.round(fpsAverage)})`,
      );
    }
    // Can increase quality
    else if (fpsAverage >= this.thresholds.targetFPS - 5 && currentIndex > 0) {
      const newQuality = QUALITY_ORDER[currentIndex - 1];
      this.setQuality(newQuality);
      this.qualityCooldown = this.qualityCooldownDuration * 2; // Longer cooldown for upgrades
      this.emitEvent('quality-change');
      logger.debug(
        `[PerformanceMonitor] Quality increased: ${this.currentQuality} -> ${newQuality} (FPS: ${Math.round(fpsAverage)})`,
      );
    }

    // Memory warning
    if (this.stats.memoryLimit > 0) {
      const memoryPercent = (this.stats.memoryUsed / this.stats.memoryLimit) * 100;
      if (memoryPercent > this.thresholds.memoryWarningPercent) {
        this.emitEvent('memory-warning');
      }
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  public getStats(): PerformanceStats {
    return { ...this.stats };
  }

  public getQualitySettings(): QualitySettings {
    return { ...QUALITY_SETTINGS[this.currentQuality] };
  }

  public setQuality(level: QualityLevel): void {
    if (this.currentQuality !== level) {
      this.currentQuality = level;
      this.stats.qualityLevel = level;
    }
  }

  public getQuality(): QualityLevel {
    return this.currentQuality;
  }

  public setAutoQuality(enabled: boolean): void {
    this.autoQualityEnabled = enabled;
  }

  public isAutoQualityEnabled(): boolean {
    return this.autoQualityEnabled;
  }

  public setThresholds(thresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  public getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  public addEventListener(callback: PerformanceEventCallback): void {
    this.eventCallbacks.add(callback);
  }

  public removeEventListener(callback: PerformanceEventCallback): void {
    this.eventCallbacks.delete(callback);
  }

  private emitEvent(event: PerformanceEventType): void {
    const stats = this.getStats();
    this.eventCallbacks.forEach(callback => callback(event, stats));
  }

  // ===========================================================================
  // Debug Display
  // ===========================================================================

  public getDebugString(): string {
    const s = this.stats;
    return [
      `FPS: ${s.fps} (avg: ${s.fpsAverage})`,
      `Frame: ${s.frameTime.toFixed(2)}ms (avg: ${s.frameTimeAverage.toFixed(2)}ms)`,
      `Quality: ${s.qualityLevel.toUpperCase()}`,
      s.memoryLimit > 0 ? `Memory: ${(s.memoryUsed / 1024 / 1024).toFixed(1)}MB` : '',
      s.isThrottling ? 'THROTTLING!' : '',
    ].filter(Boolean).join(' | ');
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const performanceMonitor = new PerformanceMonitor();
