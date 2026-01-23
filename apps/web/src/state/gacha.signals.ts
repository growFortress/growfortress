/**
 * Gacha State Management - Banner pulls, pity, spark, shards
 */
import { signal, computed, type Signal, type ReadonlySignal } from "@preact/signals";
import type {
  GachaBanner,
  GachaStatusResponse,
  HeroGachaPullResult,
  GachaPullRecord,
} from "@arcade/protocol";
import * as gachaApi from "../api/gacha.js";
import { baseDust } from "./profile.signals.js";
import { unlockedHeroIds } from "./index.js";

// ============================================================================
// CONFIGURATION (from protocol)
// ============================================================================

export const HERO_PULL_COST_SINGLE = 300;
export const HERO_PULL_COST_TEN = 2700;
export const SPARK_THRESHOLD = 100;
export const PITY_THRESHOLD = 50;

// ============================================================================
// STATE
// ============================================================================

// Active banners from server
export const activeBanners: Signal<GachaBanner[]> = signal<GachaBanner[]>([]);

// User's gacha status
export const gachaStatus: Signal<GachaStatusResponse | null> = signal<GachaStatusResponse | null>(null);

// Pull history
export const pullHistory: Signal<GachaPullRecord[]> = signal<GachaPullRecord[]>([]);

// Selected banner for pulling
export const selectedBanner: Signal<GachaBanner | null> = signal<GachaBanner | null>(null);

// Last pull results (for animation/display)
export const lastPullResults: Signal<HeroGachaPullResult[]> = signal<HeroGachaPullResult[]>([]);

// Loading states
export const isLoadingBanners: Signal<boolean> = signal(false);
export const isPulling: Signal<boolean> = signal(false);
export const isRedeemingSpark: Signal<boolean> = signal(false);

// UI state
export const gachaModalVisible: Signal<boolean> = signal(false);
export const showPullResults: Signal<boolean> = signal(false);

// Error state
export const gachaError: Signal<string | null> = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

// Current pity count
export const heroPityCount: ReadonlySignal<number> = computed(() => {
  return gachaStatus.value?.heroPityCount ?? 0;
});

// Current spark count
export const heroSparkCount: ReadonlySignal<number> = computed(() => {
  return gachaStatus.value?.heroSparkCount ?? 0;
});

// Current shards
export const heroShards: ReadonlySignal<number> = computed(() => {
  return gachaStatus.value?.heroShards ?? 0;
});

// Can afford single pull
export const canAffordSinglePull: ReadonlySignal<boolean> = computed(() => {
  return baseDust.value >= HERO_PULL_COST_SINGLE;
});

// Can afford ten pull
export const canAffordTenPull: ReadonlySignal<boolean> = computed(() => {
  return baseDust.value >= HERO_PULL_COST_TEN;
});

// Can redeem spark
export const canRedeemSpark: ReadonlySignal<boolean> = computed(() => {
  return heroSparkCount.value >= SPARK_THRESHOLD;
});

// Progress to next pity (as percentage)
export const pityProgress: ReadonlySignal<number> = computed(() => {
  return (heroPityCount.value / PITY_THRESHOLD) * 100;
});

// Progress to spark (as percentage)
export const sparkProgress: ReadonlySignal<number> = computed(() => {
  return (heroSparkCount.value / SPARK_THRESHOLD) * 100;
});

// Hero banners only
export const heroBanners: ReadonlySignal<GachaBanner[]> = computed(() => {
  return activeBanners.value.filter((b) => b.gachaType === "hero");
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Load active banners from server
 */
export async function loadBanners(): Promise<void> {
  isLoadingBanners.value = true;
  gachaError.value = null;

  try {
    const response = await gachaApi.getActiveBanners();
    activeBanners.value = response.banners;

    // Auto-select first hero banner if none selected
    if (!selectedBanner.value) {
      const firstHeroBanner = response.banners.find((b) => b.gachaType === "hero");
      if (firstHeroBanner) {
        selectedBanner.value = firstHeroBanner;
      }
    }
  } catch (error) {
    gachaError.value = error instanceof Error ? error.message : "Failed to load banners";
    console.error("Failed to load banners:", error);
  } finally {
    isLoadingBanners.value = false;
  }
}

/**
 * Load user's gacha status
 */
export async function loadGachaStatus(): Promise<void> {
  try {
    gachaStatus.value = await gachaApi.getGachaStatus();
  } catch (error) {
    console.error("Failed to load gacha status:", error);
  }
}

/**
 * Load pull history
 */
export async function loadPullHistory(limit = 50): Promise<void> {
  try {
    const response = await gachaApi.getGachaHistory("hero", limit, 0);
    pullHistory.value = response.pulls;
  } catch (error) {
    console.error("Failed to load pull history:", error);
  }
}

/**
 * Perform hero gacha pull
 */
export async function pullHero(pullCount: "single" | "ten"): Promise<boolean> {
  isPulling.value = true;
  gachaError.value = null;

  try {
    const bannerId = selectedBanner.value?.id;
    const response = await gachaApi.pullHeroGacha(pullCount, bannerId);

    // Update local state
    lastPullResults.value = response.results;
    showPullResults.value = true;

    // Update dust balance
    baseDust.value = response.newDustBalance;

    // Update gacha status
    if (gachaStatus.value) {
      gachaStatus.value = {
        ...gachaStatus.value,
        heroPityCount: response.pityCount,
        heroSparkCount: response.sparkCount,
        heroShards: response.totalShards,
      };
    }

    // Update unlocked heroes for new pulls
    const newHeroIds = response.results
      .filter((r) => r.isNew)
      .map((r) => r.heroId);
    if (newHeroIds.length > 0) {
      unlockedHeroIds.value = [...unlockedHeroIds.value, ...newHeroIds];
    }

    return true;
  } catch (error) {
    gachaError.value = error instanceof Error ? error.message : "Pull failed";
    console.error("Hero pull failed:", error);
    return false;
  } finally {
    isPulling.value = false;
  }
}

/**
 * Redeem spark for a hero
 */
export async function redeemSparkForHero(heroId: string): Promise<boolean> {
  isRedeemingSpark.value = true;
  gachaError.value = null;

  try {
    const response = await gachaApi.redeemSpark(heroId);

    if (response.success) {
      // Update gacha status
      if (gachaStatus.value) {
        gachaStatus.value = {
          ...gachaStatus.value,
          heroSparkCount: response.remainingSpark ?? 0,
        };
      }

      // Add hero to unlocked list
      if (response.heroId) {
        unlockedHeroIds.value = [...unlockedHeroIds.value, response.heroId];
      }

      return true;
    }

    gachaError.value = "Redeem failed";
    return false;
  } catch (error) {
    gachaError.value = error instanceof Error ? error.message : "Redeem failed";
    console.error("Spark redeem failed:", error);
    return false;
  } finally {
    isRedeemingSpark.value = false;
  }
}

// ============================================================================
// UI ACTIONS
// ============================================================================

/**
 * Open gacha modal
 */
export function showGachaModal(): void {
  gachaModalVisible.value = true;
  loadBanners();
  loadGachaStatus();
}

/**
 * Close gacha modal
 */
export function hideGachaModal(): void {
  gachaModalVisible.value = false;
  showPullResults.value = false;
  gachaError.value = null;
}

/**
 * Select a banner
 */
export function selectBanner(banner: GachaBanner): void {
  selectedBanner.value = banner;
}

/**
 * Dismiss pull results
 */
export function dismissPullResults(): void {
  showPullResults.value = false;
  lastPullResults.value = [];
}

// ============================================================================
// RESET
// ============================================================================

/**
 * Reset all gacha state (on logout)
 */
export function resetGachaState(): void {
  activeBanners.value = [];
  gachaStatus.value = null;
  pullHistory.value = [];
  selectedBanner.value = null;
  lastPullResults.value = [];
  isLoadingBanners.value = false;
  isPulling.value = false;
  isRedeemingSpark.value = false;
  gachaModalVisible.value = false;
  showPullResults.value = false;
  gachaError.value = null;
}
