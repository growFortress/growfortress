import { Assets, Texture } from 'pixi.js';

/**
 * Progress information for asset loading
 */
export interface AssetLoadProgress {
  loaded: number;
  total: number;
  currentAsset?: string;
}

// Hero sprite asset paths
export const HERO_ASSETS: Record<string, string> = {
  'vanguard': '/assets/heroes/vanguard.png',
  'storm': '/assets/heroes/storm.png',
  'medic': '/assets/heroes/medic.png',
  'pyro': '/assets/heroes/pyro.png',
  'scout': '/assets/heroes/scout.png',
  'forge': '/assets/heroes/forge.png',
  'frost': '/assets/heroes/frost.png',
  'rift': '/assets/heroes/rift.png',
  'spectre': '/assets/heroes/spectre.png',
  'inferno': '/assets/heroes/inferno.png',
  'glacier': '/assets/heroes/glacier.png',
  'titan': '/assets/heroes/titan.png',
  'omega': '/assets/heroes/omega.png',
};

// Enemy sprite asset paths
export const ENEMY_ASSETS: Record<string, string> = {
  // Base enemies
  'runner': '/assets/enemies/runner.png',
  'bruiser': '/assets/enemies/bruiser.png',
  'leech': '/assets/enemies/leech.png',
  // Special enemies
  'catapult': '/assets/enemies/catapult.png',
  'sapper': '/assets/enemies/sapper.png',
  'healer': '/assets/enemies/healer.png',
  'shielder': '/assets/enemies/shielder.png',
  'teleporter': '/assets/enemies/teleporter.png',
  // Bosses
  'mafia_boss': '/assets/enemies/mafia_boss.png',
  'ai_core': '/assets/enemies/ai_core.png',
  'sentinel_boss': '/assets/enemies/sentinel_boss.png',
  'cosmic_beast': '/assets/enemies/cosmic_beast.png',
  'dimensional_being': '/assets/enemies/dimensional_being.png',
  'god': '/assets/enemies/god.png',
};

/**
 * Singleton asset manager for game sprites and textures.
 * Handles preloading with progress tracking and graceful error handling.
 */
export class AssetManager {
  private static instance: AssetManager;
  private loaded = false;
  private loadedAssets = new Set<string>();
  private failedAssets = new Set<string>();

  private constructor() {}

  public static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  /**
   * Check if assets have been loaded
   */
  public isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Load all game assets with optional progress callback.
   * Gracefully handles missing assets without blocking the game.
   *
   * @param onProgress - Optional callback for loading progress updates
   */
  public async loadGameAssets(
    onProgress?: (progress: AssetLoadProgress) => void
  ): Promise<void> {
    if (this.loaded) {
      return;
    }

    const assetsToLoad: { alias: string; src: string }[] = [];

    // Add hero assets
    for (const [id, path] of Object.entries(HERO_ASSETS)) {
      assetsToLoad.push({ alias: `hero_${id}`, src: path });
    }

    // Add enemy assets
    for (const [id, path] of Object.entries(ENEMY_ASSETS)) {
      assetsToLoad.push({ alias: `enemy_${id}`, src: path });
    }

    const total = assetsToLoad.length;
    let loaded = 0;

    // Register all assets
    for (const asset of assetsToLoad) {
      if (!Assets.cache.has(asset.alias)) {
        Assets.add({ alias: asset.alias, src: asset.src });
      }
    }

    // Load assets one by one for better error handling
    for (const asset of assetsToLoad) {
      try {
        if (onProgress) {
          onProgress({ loaded, total, currentAsset: asset.alias });
        }

        await Assets.load(asset.alias);
        this.loadedAssets.add(asset.alias);
      } catch (error) {
        // Asset failed to load (404 or other error) - continue without it
        this.failedAssets.add(asset.alias);
        console.warn(`Failed to load asset: ${asset.alias}`, error);
      }

      loaded++;
    }

    if (onProgress) {
      onProgress({ loaded: total, total });
    }

    this.loaded = true;

    // Log summary
    if (this.failedAssets.size > 0) {
      console.warn(
        `Asset loading complete. Loaded: ${this.loadedAssets.size}, Failed: ${this.failedAssets.size}`
      );
    } else {
      console.log(`All ${total} assets loaded successfully`);
    }
  }

  /**
   * Check if a texture exists in the cache
   */
  public hasTexture(type: 'hero' | 'enemy', id: string): boolean {
    const alias = `${type}_${id}`;
    return Assets.cache.has(alias) && !this.failedAssets.has(alias);
  }

  /**
   * Get a texture by type and ID, returns null if not available
   */
  public getTexture(type: 'hero' | 'enemy', id: string): Texture | null {
    const alias = `${type}_${id}`;
    if (this.hasTexture(type, id)) {
      return Assets.get(alias);
    }
    return null;
  }

  /**
   * Ensure a specific asset is loaded (lazy loading fallback)
   * @returns true if asset is available, false if failed to load
   */
  public async ensureLoaded(type: 'hero' | 'enemy', id: string): Promise<boolean> {
    const alias = `${type}_${id}`;

    // Already loaded
    if (this.loadedAssets.has(alias)) {
      return true;
    }

    // Already failed
    if (this.failedAssets.has(alias)) {
      return false;
    }

    // Try to load
    const assetMap = type === 'hero' ? HERO_ASSETS : ENEMY_ASSETS;
    const src = assetMap[id];

    if (!src) {
      this.failedAssets.add(alias);
      return false;
    }

    try {
      if (!Assets.cache.has(alias)) {
        Assets.add({ alias, src });
      }
      await Assets.load(alias);
      this.loadedAssets.add(alias);
      return true;
    } catch {
      this.failedAssets.add(alias);
      console.warn(`Failed to lazy-load asset: ${alias}`);
      return false;
    }
  }

  /**
   * Get loading statistics
   */
  public getStats(): { loaded: number; failed: number; total: number } {
    return {
      loaded: this.loadedAssets.size,
      failed: this.failedAssets.size,
      total: Object.keys(HERO_ASSETS).length + Object.keys(ENEMY_ASSETS).length,
    };
  }
}

export const assetManager = AssetManager.getInstance();
