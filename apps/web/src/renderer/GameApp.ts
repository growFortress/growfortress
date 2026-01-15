import { Application, Container } from "pixi.js";
import { CRTFilter } from "pixi-filters";
import { GameScene, type HubState } from "./scenes/GameScene";
import { filterManager, FilterManager } from "./effects/FilterManager";

// =============================================================================
// WebGPU Detection & Renderer Info
// =============================================================================

export type RendererType = "webgpu" | "webgl2" | "webgl" | "unknown";

export interface RendererInfo {
  type: RendererType;
  isWebGPU: boolean;
  isHardwareAccelerated: boolean;
  maxTextureSize: number;
  vendor: string;
  renderer: string;
}

/**
 * Detect if WebGPU is available in the browser (with timeout)
 */
async function isWebGPUAvailable(): Promise<boolean> {
  if (!navigator.gpu) {
    return false;
  }

  try {
    // Add timeout to prevent hanging on WebGPU detection
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 2000),
    );
    const adapter = await Promise.race([
      navigator.gpu.requestAdapter(),
      timeout,
    ]);
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Get renderer information from PixiJS Application
 */
function getRendererInfo(app: Application): RendererInfo {
  const renderer = app.renderer;
  const gl = (renderer as any).gl as
    | WebGL2RenderingContext
    | WebGLRenderingContext
    | undefined;

  // Detect renderer type
  let type: RendererType = "unknown";
  let vendor = "Unknown";
  let rendererName = "Unknown";
  let maxTextureSize = 4096;
  let isHardwareAccelerated = true;

  // Check if WebGPU
  if ((renderer as any).gpu || (renderer as any).type === "webgpu") {
    type = "webgpu";
    vendor = "WebGPU";
    rendererName = "WebGPU Renderer";
  } else if (gl) {
    // WebGL detection
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "Unknown";
      rendererName =
        gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Unknown";
    }

    maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;

    // Check for WebGL2
    if (gl instanceof WebGL2RenderingContext) {
      type = "webgl2";
    } else {
      type = "webgl";
    }

    // Detect software rendering (SwiftShader, llvmpipe, etc.)
    const softwareRenderers = [
      "swiftshader",
      "llvmpipe",
      "softpipe",
      "software",
    ];
    isHardwareAccelerated = !softwareRenderers.some((sw) =>
      rendererName.toLowerCase().includes(sw),
    );
  }

  return {
    type,
    isWebGPU: type === "webgpu",
    isHardwareAccelerated,
    maxTextureSize,
    vendor,
    renderer: rendererName,
  };
}

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
    const shakeX =
      Math.sin(time * this.frequency * Math.PI * 2) * this.intensity * decay;
    const shakeY =
      Math.sin(time * this.frequency * Math.PI * 2 + 0.5) *
      this.intensity *
      decay;

    // Add some randomness for more organic feel
    this.offsetX =
      shakeX + (Math.random() - 0.5) * this.intensity * decay * 0.3;
    this.offsetY =
      shakeY + (Math.random() - 0.5) * this.intensity * decay * 0.3;

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
  public filterManager: FilterManager = filterManager;
  public rendererInfo: RendererInfo | null = null;
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
    console.log("[GameApp] Starting initialization...");

    // Check WebGPU availability
    const webgpuAvailable = await isWebGPUAvailable();
    console.log(`[GameApp] WebGPU available: ${webgpuAvailable}`);

    // Initialize with preference for WebGPU if available
    console.log("[GameApp] Initializing PixiJS Application...");
    const resizeTarget = this.canvas.parentElement ?? window;
    const initOptions = {
      canvas: this.canvas,
      resizeTo: resizeTarget,
      backgroundColor: "#161622", // Match theme --color-bg-deep
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    };

    try {
      await this.app.init({
        ...initOptions,
        // PixiJS 8 prefers WebGPU automatically if available
        // But we can explicitly set preference here
        preference: webgpuAvailable ? "webgpu" : "webgl",
      });
    } catch (error) {
      if (webgpuAvailable) {
        console.warn(
          "[GameApp] WebGPU init failed, falling back to WebGL:",
          error,
        );
        this.app.destroy(true, { children: true, texture: true });
        this.app = new Application();
        this.stage = this.app.stage;
        await this.app.init({
          ...initOptions,
          preference: "webgl",
        });
      } else {
        throw error;
      }
    }

    console.log("[GameApp] PixiJS Application initialized");

    // Get and store renderer info
    this.rendererInfo = getRendererInfo(this.app);

    // Log renderer info for debugging
    console.log(
      `[GameApp] Renderer: ${this.rendererInfo.type.toUpperCase()}`,
      `| GPU: ${this.rendererInfo.renderer}`,
      `| Hardware Accelerated: ${this.rendererInfo.isHardwareAccelerated}`,
    );

    // Create game container for screen shake
    this.gameContainer.interactiveChildren = true;
    this.stage.addChild(this.gameContainer);

    // Create the main game scene
    this.gameScene = new GameScene(this.app);
    this.gameContainer.addChild(this.gameScene.container);

    // Connect screen shake to VFX system
    this.gameScene.setScreenShakeCallback(
      (intensity: number, duration: number) => {
        this.screenShake.shake(intensity, duration);
      },
    );

    // Setup resize notification for GameScene
    // Note: resizeTo handles renderer resize automatically,
    // ResizeObserver just notifies GameScene about the new dimensions
    const resizeElement =
      resizeTarget instanceof HTMLElement ? resizeTarget : this.canvas;
    const notifyResize = (width: number, height: number) => {
      if (!this.gameScene) return;
      if (width <= 0 || height <= 0) return;
      this.gameScene.onResize(Math.round(width), Math.round(height));
    };

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      notifyResize(entry.contentRect.width, entry.contentRect.height);
    });
    this.resizeObserver.observe(resizeElement);

    // Initialize FilterManager with game container
    this.filterManager.setGlobalContainer(this.gameContainer);

    // Auto-detect quality based on device performance
    const isLowEndDevice =
      navigator.hardwareConcurrency <= 2 ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
    this.filterManager.setQualityLevel(isLowEndDevice ? "low" : "high");

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

      // Animate CRT noise/time, update screen shake, and update filter effects
      this.app.ticker.add((ticker) => {
        crt.time += ticker.deltaTime * 0.01;
        crt.seed = Math.random();

        // Update screen shake
        const shake = this.screenShake.update(ticker.deltaMS);
        this.gameContainer.position.set(shake.x, shake.y);

        // Update filter effects
        this.filterManager.update(ticker.deltaMS);
      });
    } catch (e) {
      console.warn("CRT filter not supported, skipping:", e);

      // Still update screen shake and filters even without CRT filter
      this.app.ticker.add((ticker) => {
        const shake = this.screenShake.update(ticker.deltaMS);
        this.gameContainer.position.set(shake.x, shake.y);

        // Update filter effects
        this.filterManager.update(ticker.deltaMS);
      });
    }

    // Initial notification to GameScene (wait for layout if needed)
    const initialResizeElement =
      resizeTarget instanceof HTMLElement ? resizeTarget : this.canvas;
    const applyInitialResize = () => {
      const rect = initialResizeElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        requestAnimationFrame(applyInitialResize);
        return;
      }
      notifyResize(rect.width, rect.height);
    };
    applyInitialResize();
  }

  destroy() {
    this.filterManager.destroy();
    this.resizeObserver?.disconnect();
    this.app.destroy(true, { children: true, texture: true });
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
   * Set callback for turret click events
   */
  public setOnTurretClick(
    callback: (turretId: string, slotIndex: number) => void,
  ) {
    if (this.gameScene) {
      this.gameScene.setOnTurretClick(callback);
    }
  }

  /**
   * Set callback for field click events (tactical commands)
   */
  public setOnFieldClick(
    callback: ((worldX: number, worldY: number) => void) | null,
  ) {
    if (this.gameScene) {
      this.gameScene.setOnFieldClick(callback);
    }
  }
}

export type { HubState };
