/**
 * Boss Spawn Sequence - Dramatic boss entrance effect
 *
 * Sequence:
 * 1. Screen darken (vignette)
 * 2. Warning text animation
 * 3. Boss silhouette reveal
 * 4. Camera shake + zoom
 * 5. Name plate animation
 * 6. Health bar reveal
 */

import { Container, Graphics, Text, Ticker, type Application } from 'pixi.js';
import i18n from '../../i18n/index.js';

// =============================================================================
// Types
// =============================================================================

export interface BossSpawnConfig {
  bossName: string;
  bossTitle?: string;
  bossColor?: number;
  duration?: number; // Total sequence duration in ms
  onComplete?: () => void;
  onPhaseChange?: (phase: BossSpawnPhase) => void;
}

export type BossSpawnPhase =
  | 'idle'
  | 'darken'
  | 'warning'
  | 'silhouette'
  | 'shake'
  | 'nameplate'
  | 'complete';

interface SequenceState {
  phase: BossSpawnPhase;
  elapsed: number;
  isPlaying: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_DURATION = 4000; // 4 seconds total

const PHASE_TIMINGS = {
  darken: { start: 0, duration: 600 },
  warning: { start: 400, duration: 1200 },
  silhouette: { start: 1200, duration: 800 },
  shake: { start: 1800, duration: 600 },
  nameplate: { start: 2200, duration: 1500 },
};

// =============================================================================
// BossSpawnSequence Class
// =============================================================================

export class BossSpawnSequence {
  private app: Application;
  private container: Container;
  private config: Required<BossSpawnConfig>;
  private state: SequenceState;

  // Visual elements
  private vignetteGraphics: Graphics;
  private warningContainer: Container;
  private silhouetteGraphics: Graphics;
  private namePlateContainer: Container;
  private particleContainer: Container;

  // Animation
  private ticker: Ticker;
  private startTime: number = 0;

  constructor(app: Application, config: BossSpawnConfig) {
    this.app = app;
    this.config = {
      bossName: config.bossName,
      bossTitle: config.bossTitle || 'BOSS',
      bossColor: config.bossColor || 0xff4444,
      duration: config.duration || DEFAULT_DURATION,
      onComplete: config.onComplete || (() => {}),
      onPhaseChange: config.onPhaseChange || (() => {}),
    };

    this.state = {
      phase: 'idle',
      elapsed: 0,
      isPlaying: false,
    };

    // Create container
    this.container = new Container();
    this.container.zIndex = 1000;
    this.container.visible = false;

    // Create visual elements
    this.vignetteGraphics = this.createVignette();
    this.warningContainer = this.createWarningText();
    this.silhouetteGraphics = this.createSilhouette();
    this.namePlateContainer = this.createNamePlate();
    this.particleContainer = new Container();

    // Add to container
    this.container.addChild(this.vignetteGraphics);
    this.container.addChild(this.warningContainer);
    this.container.addChild(this.silhouetteGraphics);
    this.container.addChild(this.namePlateContainer);
    this.container.addChild(this.particleContainer);

    // Setup ticker
    this.ticker = new Ticker();
    this.ticker.add(this.update, this);
  }

  // ===========================================================================
  // Visual Element Creation
  // ===========================================================================

  private createVignette(): Graphics {
    const graphics = new Graphics();
    const { width, height } = this.app.screen;

    // Create radial gradient vignette
    graphics.rect(0, 0, width, height);
    graphics.fill({ color: 0x000000, alpha: 0 });

    // We'll animate alpha in update
    graphics.alpha = 0;

    return graphics;
  }

  private createWarningText(): Container {
    const container = new Container();
    const { width, height } = this.app.screen;

    // Warning background stripe
    const stripe = new Graphics();
    stripe.rect(0, height / 2 - 60, width, 120);
    stripe.fill({ color: 0x000000, alpha: 0.8 });
    container.addChild(stripe);

    // Hazard stripes (diagonal lines)
    const hazardTop = new Graphics();
    const hazardBottom = new Graphics();
    const stripeWidth = 20;
    const stripeGap = 20;

    for (let x = -height; x < width + height; x += stripeWidth + stripeGap) {
      hazardTop.moveTo(x, height / 2 - 60);
      hazardTop.lineTo(x + 60, height / 2 - 60);
      hazardTop.lineTo(x + 60 - stripeWidth, height / 2 - 52);
      hazardTop.lineTo(x - stripeWidth, height / 2 - 52);
      hazardTop.fill({ color: 0xffcc00 });

      hazardBottom.moveTo(x, height / 2 + 60);
      hazardBottom.lineTo(x + 60, height / 2 + 60);
      hazardBottom.lineTo(x + 60 - stripeWidth, height / 2 + 52);
      hazardBottom.lineTo(x - stripeWidth, height / 2 + 52);
      hazardBottom.fill({ color: 0xffcc00 });
    }

    container.addChild(hazardTop);
    container.addChild(hazardBottom);

    // Warning text
    const warningText = new Text({
      text: i18n.t('game:bossSpawn.warning'),
      style: {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 48,
        fontWeight: 'bold',
        fill: 0xff0000,
        letterSpacing: 8,
        dropShadow: {
          color: 0xff0000,
          blur: 10,
          distance: 0,
        },
      },
    });
    warningText.anchor.set(0.5);
    warningText.x = width / 2;
    warningText.y = height / 2;
    container.addChild(warningText);

    container.alpha = 0;
    return container;
  }

  private createSilhouette(): Graphics {
    const graphics = new Graphics();
    const { width, height } = this.app.screen;
    const centerX = width / 2;
    const centerY = height / 2;

    // Create boss silhouette (menacing shape)
    const size = 150;
    graphics.moveTo(centerX, centerY - size);
    graphics.lineTo(centerX + size * 0.8, centerY + size * 0.3);
    graphics.lineTo(centerX + size * 0.5, centerY + size * 0.3);
    graphics.lineTo(centerX + size * 0.5, centerY + size);
    graphics.lineTo(centerX - size * 0.5, centerY + size);
    graphics.lineTo(centerX - size * 0.5, centerY + size * 0.3);
    graphics.lineTo(centerX - size * 0.8, centerY + size * 0.3);
    graphics.closePath();
    graphics.fill({ color: 0x000000 });

    // Add glowing eyes
    const eyeGlow = new Graphics();
    eyeGlow.circle(centerX - 30, centerY - 20, 8);
    eyeGlow.circle(centerX + 30, centerY - 20, 8);
    eyeGlow.fill({ color: this.config.bossColor });
    graphics.addChild(eyeGlow);

    graphics.alpha = 0;
    graphics.scale.set(0.5);

    return graphics;
  }

  private createNamePlate(): Container {
    const container = new Container();
    const { width, height } = this.app.screen;

    // Background plate
    const plate = new Graphics();
    plate.roundRect(-200, -40, 400, 80, 8);
    plate.fill({ color: 0x000000, alpha: 0.9 });
    plate.stroke({ color: this.config.bossColor, width: 2 });
    plate.x = width / 2;
    plate.y = height / 2 + 180;
    container.addChild(plate);

    // Boss title (small text)
    const titleText = new Text({
      text: this.config.bossTitle,
      style: {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: this.config.bossColor,
        letterSpacing: 4,
      },
    });
    titleText.anchor.set(0.5);
    titleText.x = width / 2;
    titleText.y = height / 2 + 155;
    container.addChild(titleText);

    // Boss name (large text)
    const nameText = new Text({
      text: this.config.bossName.toUpperCase(),
      style: {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 32,
        fontWeight: 'bold',
        fill: 0xffffff,
        letterSpacing: 4,
        dropShadow: {
          color: this.config.bossColor,
          blur: 8,
          distance: 0,
        },
      },
    });
    nameText.anchor.set(0.5);
    nameText.x = width / 2;
    nameText.y = height / 2 + 180;
    container.addChild(nameText);

    container.alpha = 0;
    container.scale.set(0.8);

    return container;
  }

  // ===========================================================================
  // Animation Methods
  // ===========================================================================

  public play(): void {
    if (this.state.isPlaying) return;

    this.state.isPlaying = true;
    this.state.phase = 'darken';
    this.state.elapsed = 0;
    this.startTime = performance.now();

    // Add container to stage
    this.app.stage.addChild(this.container);
    this.container.visible = true;

    // Start ticker
    this.ticker.start();

    this.config.onPhaseChange('darken');
  }

  public stop(): void {
    this.state.isPlaying = false;
    this.ticker.stop();
    this.container.visible = false;

    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }

    this.reset();
  }

  private reset(): void {
    this.state.phase = 'idle';
    this.state.elapsed = 0;

    this.vignetteGraphics.alpha = 0;
    this.warningContainer.alpha = 0;
    this.silhouetteGraphics.alpha = 0;
    this.silhouetteGraphics.scale.set(0.5);
    this.namePlateContainer.alpha = 0;
    this.namePlateContainer.scale.set(0.8);
  }

  private update = (): void => {
    if (!this.state.isPlaying) return;

    const now = performance.now();
    this.state.elapsed = now - this.startTime;

    // Update phases based on elapsed time
    this.updateVignette();
    this.updateWarning();
    this.updateSilhouette();
    this.updateShake();
    this.updateNameplate();

    // Check for completion
    if (this.state.elapsed >= this.config.duration) {
      this.complete();
    }
  };

  private updateVignette(): void {
    const { start, duration } = PHASE_TIMINGS.darken;
    const progress = this.getPhaseProgress(start, duration);

    if (progress > 0) {
      // Ease in-out
      const alpha = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      // Rebuild vignette with current alpha
      const { width, height } = this.app.screen;
      this.vignetteGraphics.clear();

      // Create radial gradient effect with multiple circles
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);

      for (let i = 10; i >= 0; i--) {
        const radius = maxRadius * (i / 10);
        const circleAlpha = (1 - i / 10) * alpha * 0.7;
        this.vignetteGraphics.circle(centerX, centerY, radius);
        this.vignetteGraphics.fill({ color: 0x000000, alpha: circleAlpha });
      }
    }
  }

  private updateWarning(): void {
    const { start, duration } = PHASE_TIMINGS.warning;
    const progress = this.getPhaseProgress(start, duration);

    if (progress > 0 && progress < 1) {
      // Flash effect
      const flashSpeed = 4;
      const flash = Math.sin(progress * Math.PI * flashSpeed);
      this.warningContainer.alpha = Math.max(0.3, flash);

      // Update phase if entering
      if (this.state.phase === 'darken' && progress > 0.1) {
        this.state.phase = 'warning';
        this.config.onPhaseChange('warning');
      }
    } else if (progress >= 1) {
      this.warningContainer.alpha = 0;
    }
  }

  private updateSilhouette(): void {
    const { start, duration } = PHASE_TIMINGS.silhouette;
    const progress = this.getPhaseProgress(start, duration);

    if (progress > 0) {
      // Ease out back
      const scale = 0.5 + 0.7 * this.easeOutBack(Math.min(progress, 1));
      this.silhouetteGraphics.scale.set(scale);
      this.silhouetteGraphics.alpha = Math.min(progress * 2, 1);

      // Update phase
      if (this.state.phase === 'warning' && progress > 0.1) {
        this.state.phase = 'silhouette';
        this.config.onPhaseChange('silhouette');
      }
    }
  }

  private updateShake(): void {
    const { start, duration } = PHASE_TIMINGS.shake;
    const progress = this.getPhaseProgress(start, duration);

    if (progress > 0 && progress < 1) {
      // Camera shake effect
      const intensity = 10 * (1 - progress);
      const shakeX = (Math.random() - 0.5) * intensity;
      const shakeY = (Math.random() - 0.5) * intensity;

      this.container.x = shakeX;
      this.container.y = shakeY;

      // Update phase
      if (this.state.phase === 'silhouette' && progress > 0.1) {
        this.state.phase = 'shake';
        this.config.onPhaseChange('shake');
      }
    } else {
      this.container.x = 0;
      this.container.y = 0;
    }
  }

  private updateNameplate(): void {
    const { start, duration } = PHASE_TIMINGS.nameplate;
    const progress = this.getPhaseProgress(start, duration);

    if (progress > 0) {
      // Ease out elastic
      const elasticProgress = this.easeOutElastic(Math.min(progress * 1.5, 1));
      this.namePlateContainer.alpha = Math.min(progress * 2, 1);
      this.namePlateContainer.scale.set(0.8 + 0.2 * elasticProgress);

      // Update phase
      if (this.state.phase === 'shake' && progress > 0.1) {
        this.state.phase = 'nameplate';
        this.config.onPhaseChange('nameplate');
      }
    }
  }

  private complete(): void {
    this.state.phase = 'complete';
    this.state.isPlaying = false;
    this.ticker.stop();

    this.config.onPhaseChange('complete');
    this.config.onComplete();

    // Fade out and cleanup
    this.fadeOut();
  }

  private fadeOut(): void {
    const fadeOutDuration = 500;
    const startAlpha = this.container.alpha;
    const startTime = performance.now();

    const fadeStep = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / fadeOutDuration, 1);

      this.container.alpha = startAlpha * (1 - progress);

      if (progress < 1) {
        requestAnimationFrame(fadeStep);
      } else {
        this.stop();
      }
    };

    requestAnimationFrame(fadeStep);
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  private getPhaseProgress(start: number, duration: number): number {
    const elapsed = this.state.elapsed - start;
    if (elapsed < 0) return 0;
    return elapsed / duration;
  }

  private easeOutBack(x: number): number {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  private easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;

    if (x === 0) return 0;
    if (x === 1) return 1;

    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  public get isPlaying(): boolean {
    return this.state.isPlaying;
  }

  public get currentPhase(): BossSpawnPhase {
    return this.state.phase;
  }

  public destroy(): void {
    this.stop();
    this.ticker.destroy();
    this.container.destroy({ children: true });
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createBossSpawnSequence(
  app: Application,
  config: BossSpawnConfig
): BossSpawnSequence {
  return new BossSpawnSequence(app, config);
}
