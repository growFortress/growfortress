import { Application, Container } from 'pixi.js';
import { CRTFilter } from 'pixi-filters';
import { GameScene, type HubState } from './scenes/GameScene';

// Force full page reload instead of HMR for Pixi/WebGL files
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    import.meta.hot?.invalidate();
  });
}

// Screen shake manager for impact effects
class ScreenShakeManager {
  private intensity: number = 0;
  private duration: number = 0;
  private elapsed: number = 0;
  private frequency: number = 30; // shakes per second
  private offsetX: number = 0;
  private offsetY: number = 0;

  public shake(intensity: number, duration: number) {
    // Stack shakes but cap intensity
    this.intensity = Math.min(this.intensity + intensity, 15);
    this.duration = Math.max(this.duration, duration);
    this.elapsed = 0;
  }

  public update(delta: number): { x: number; y: number } {
    if (this.duration <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return { x: 0, y: 0 };
    }

    this.elapsed += delta;

    if (this.elapsed >= this.duration) {
      this.duration = 0;
      this.intensity = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      return { x: 0, y: 0 };
    }

    // Calculate decay (exponential falloff)
    const progress = this.elapsed / this.duration;
    const decay = 1 - progress * progress; // Quadratic decay

    // Calculate shake offset using sine waves with slight phase difference
    const time = this.elapsed / 1000;
    const shakeX = Math.sin(time * this.frequency * Math.PI * 2) * this.intensity * decay;
    const shakeY = Math.sin(time * this.frequency * Math.PI * 2 + 0.5) * this.intensity * decay;

    // Add some randomness for more organic feel
    this.offsetX = shakeX + (Math.random() - 0.5) * this.intensity * decay * 0.3;
    this.offsetY = shakeY + (Math.random() - 0.5) * this.intensity * decay * 0.3;

    return { x: this.offsetX, y: this.offsetY };
  }

  public isShaking(): boolean {
    return this.duration > 0;
  }
}

export class GameApp {
  public app: Application;
  public stage: Container;
  public gameScene: GameScene | null = null;
  private canvas: HTMLCanvasElement;
  private resizeObserver: ResizeObserver | null = null;
  private screenShake: ScreenShakeManager;
  private gameContainer: Container;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.app = new Application();
    this.stage = this.app.stage;
    this.screenShake = new ScreenShakeManager();
    this.gameContainer = new Container();
  }

  async init() {
    await this.app.init({
      canvas: this.canvas,
      resizeTo: window,
      backgroundColor: '#161622', // Match theme --color-bg-deep
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });

    // Create game container for screen shake
    this.gameContainer.interactiveChildren = true;
    this.stage.addChild(this.gameContainer);

    // Create the main game scene
    this.gameScene = new GameScene(this.app);
    this.gameContainer.addChild(this.gameScene.container);

    // Connect screen shake to VFX system
    this.gameScene.setScreenShakeCallback((intensity: number, duration: number) => {
      this.screenShake.shake(intensity, duration);
    });

    // Setup resizing
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);

    // Apply Global CRT Filter (with fallback if incompatible)
    try {
      const crt = new CRTFilter({
        curvature: 1,
        lineWidth: 0.5,
        lineContrast: 0.1,
        noise: 0.03,
        noiseSize: 1,
      });
      crt.time = 0;
      this.stage.filters = [crt];

      // Animate CRT noise/time and update screen shake
      this.app.ticker.add((ticker) => {
        crt.time += ticker.deltaTime * 0.01;
        crt.seed = Math.random();

        // Update screen shake
        const shake = this.screenShake.update(ticker.deltaMS);
        this.gameContainer.position.set(shake.x, shake.y);
      });
    } catch (e) {
      console.warn('CRT filter not supported, skipping:', e);

      // Still update screen shake even without CRT filter
      this.app.ticker.add((ticker) => {
        const shake = this.screenShake.update(ticker.deltaMS);
        this.gameContainer.position.set(shake.x, shake.y);
      });
    }

    // Initial resize to set dimensions
    this.resize();
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.app.destroy(true, { children: true, texture: true });
  }

  private resize() {
    this.app.resize();
    if (this.gameScene) {
      this.gameScene.onResize(this.app.screen.width, this.app.screen.height);
    }
  }

  public render(state: any, alpha: number, hubState?: HubState) {
    if (this.gameScene) {
      this.gameScene.update(state, alpha, hubState);
    }
  }

  /**
   * Set callback for hero click events
   */
  public setOnHeroClick(callback: (heroId: string) => void) {
    if (this.gameScene) {
      this.gameScene.setOnHeroClick(callback);
    }
  }

  /**
   * Set callback for field click events (tactical commands)
   */
  public setOnFieldClick(callback: ((worldX: number, worldY: number) => void) | null) {
    if (this.gameScene) {
      this.gameScene.setOnFieldClick(callback);
    }
  }
}

export type { HubState };
