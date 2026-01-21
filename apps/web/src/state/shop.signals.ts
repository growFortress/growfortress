/**
 * Shop State Management - Microtransactions signals
 */
import { signal, computed, type Signal, type ReadonlySignal } from '@preact/signals';
import type {
  GetShopResponse,
  ActiveBooster,
  Purchase,
  ShopCategory,
  ShopProduct,
} from '@arcade/protocol';
import type { MaterialType } from '@arcade/sim-core';
import * as shopApi from '../api/shop.js';
import { addMaterials } from './materials.signals.js';
import { baseDust, baseGold } from './profile.signals.js';

// ============================================================================
// STATE
// ============================================================================

// Shop data from server
export const shopData: Signal<GetShopResponse | null> = signal<GetShopResponse | null>(null);

// Active boosters
export const activeBoosters: Signal<ActiveBooster[]> = signal<ActiveBooster[]>([]);

// Purchase history
export const purchaseHistory: Signal<Purchase[]> = signal<Purchase[]>([]);

// Loading states
export const isLoadingShop: Signal<boolean> = signal(false);
export const isProcessingPurchase: Signal<boolean> = signal(false);

// UI state
export const shopModalVisible: Signal<boolean> = signal(false);
export const selectedCategory: Signal<ShopCategory> = signal<ShopCategory>('featured');
export const checkoutSessionId: Signal<string | null> = signal<string | null>(null);
export const checkoutStatus: Signal<'idle' | 'pending' | 'success' | 'failed' | 'expired'> = signal<'idle' | 'pending' | 'success' | 'failed' | 'expired'>('idle');

// Error state
export const shopError: Signal<string | null> = signal<string | null>(null);

// Last successful purchase (for success modal)
export const lastPurchase: Signal<Purchase | null> = signal<Purchase | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

// Products for current category
export const currentCategoryProducts: ReadonlySignal<ShopProduct[]> = computed(() => {
  if (!shopData.value) return [];
  const category = shopData.value.categories.find((c) => c.id === selectedCategory.value);
  return category?.products ?? [];
});

// Is starter pack available
export const starterPackAvailable: ReadonlySignal<boolean> = computed(() => {
  return shopData.value?.starterPackAvailable ?? false;
});

// Check if user has first purchase bonus for a package
export function hasFirstPurchaseBonus(productId: string): boolean {
  return shopData.value?.firstPurchaseBonusAvailable[productId] ?? true;
}

// Get active booster of type
export function getActiveBooster(type: string): ActiveBooster | undefined {
  return activeBoosters.value.find((b) => b.type === type);
}

// Check if any XP boost is active
export const hasActiveXpBoost: ReadonlySignal<boolean> = computed(() => {
  return activeBoosters.value.some(
    (b) => b.type === 'xp_1.5x' || b.type === 'ultimate_1.5x',
  );
});

// Check if any gold boost is active
export const hasActiveGoldBoost: ReadonlySignal<boolean> = computed(() => {
  return activeBoosters.value.some(
    (b) => b.type === 'gold_1.5x' || b.type === 'ultimate_1.5x',
  );
});

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Load shop data from server
 */
export async function loadShop(): Promise<void> {
  isLoadingShop.value = true;
  shopError.value = null;

  try {
    shopData.value = await shopApi.getShop();
  } catch (error) {
    shopError.value = error instanceof Error ? error.message : 'Failed to load shop';
    console.error('Failed to load shop:', error);
  } finally {
    isLoadingShop.value = false;
  }
}

/**
 * Load active boosters
 */
export async function loadActiveBoosters(): Promise<void> {
  try {
    const response = await shopApi.getActiveBoosters();
    activeBoosters.value = response.boosters;
  } catch (error) {
    console.error('Failed to load active boosters:', error);
  }
}

/**
 * Load purchase history
 */
export async function loadPurchaseHistory(limit = 50): Promise<void> {
  try {
    const response = await shopApi.getPurchases(limit, 0);
    purchaseHistory.value = response.purchases;
  } catch (error) {
    console.error('Failed to load purchase history:', error);
  }
}

/**
 * Start Stripe checkout for a product
 */
export async function startCheckout(productId: string): Promise<void> {
  isProcessingPurchase.value = true;
  checkoutStatus.value = 'pending';
  shopError.value = null;

  try {
    await shopApi.startCheckout(productId);
    // Redirect happens in the API function
  } catch (error) {
    checkoutStatus.value = 'failed';
    shopError.value = error instanceof Error ? error.message : 'Checkout failed';
    console.error('Checkout failed:', error);
    isProcessingPurchase.value = false;
  }
}

/**
 * Handle checkout return from Stripe
 */
export async function handleCheckoutReturn(sessionId: string): Promise<void> {
  checkoutSessionId.value = sessionId;
  checkoutStatus.value = 'pending';

  try {
    const result = await shopApi.pollCheckoutStatus(sessionId);

    if (result.status === 'completed') {
      checkoutStatus.value = 'success';
      // Store purchase data for success modal
      if (result.purchase) {
        lastPurchase.value = result.purchase as Purchase;

        // Update local inventory with granted rewards
        if (result.purchase.dustGranted) {
          baseDust.value += result.purchase.dustGranted;
        }
        if (result.purchase.goldGranted) {
          baseGold.value += result.purchase.goldGranted;
        }
        // Add materials to local inventory
        if (result.purchase.materialsGranted) {
          for (const [materialId, amount] of Object.entries(result.purchase.materialsGranted)) {
            addMaterials(materialId as MaterialType, amount);
          }
        }
      }
      // Reload shop data to update purchase limits
      await loadShop();
      await loadPurchaseHistory();
    } else if (result.status === 'failed' || result.status === 'expired') {
      checkoutStatus.value = result.status as 'failed' | 'expired';
    }
  } catch (error) {
    checkoutStatus.value = 'failed';
    console.error('Failed to verify checkout:', error);
  }
}

/**
 * Buy item with dust
 */
export async function buyWithDust(
  itemType: 'booster' | 'convenience' | 'cosmetic',
  itemId: string,
): Promise<boolean> {
  isProcessingPurchase.value = true;
  shopError.value = null;

  try {
    const response = await shopApi.buyWithDust({ itemType, itemId });

    if (response.success) {
      // Update local boosters if it was a booster
      if (itemType === 'booster' && response.expiresAt) {
        const existingIndex = activeBoosters.value.findIndex(
          (b) => b.type === itemId.replace(/_\d+h$/, '_2x'),
        );

        if (existingIndex >= 0) {
          // Update existing booster
          const updated = [...activeBoosters.value];
          updated[existingIndex] = {
            ...updated[existingIndex],
            expiresAt: response.expiresAt,
            remainingSeconds: Math.floor(
              (new Date(response.expiresAt).getTime() - Date.now()) / 1000,
            ),
          };
          activeBoosters.value = updated;
        } else {
          // Add new booster
          const boosterType = itemId.includes('xp')
            ? 'xp_1.5x'
            : itemId.includes('gold')
              ? 'gold_1.5x'
              : itemId.includes('material')
                ? 'material_1.5x'
                : 'ultimate_1.5x';

          activeBoosters.value = [
            ...activeBoosters.value,
            {
              type: boosterType as ActiveBooster['type'],
              expiresAt: response.expiresAt,
              remainingSeconds: Math.floor(
                (new Date(response.expiresAt).getTime() - Date.now()) / 1000,
              ),
            },
          ];
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    shopError.value = error instanceof Error ? error.message : 'Purchase failed';
    console.error('Buy with dust failed:', error);
    return false;
  } finally {
    isProcessingPurchase.value = false;
  }
}

// ============================================================================
// UI ACTIONS
// ============================================================================

/**
 * Open shop modal
 */
export function showShopModal(): void {
  shopModalVisible.value = true;
  loadShop();
  loadActiveBoosters();
}

/**
 * Close shop modal
 */
export function hideShopModal(): void {
  shopModalVisible.value = false;
  checkoutStatus.value = 'idle';
  shopError.value = null;
}

/**
 * Select category in shop
 */
export function selectCategory(category: ShopCategory): void {
  selectedCategory.value = category;
}

/**
 * Reset checkout status (after showing result)
 */
export function resetCheckoutStatus(): void {
  checkoutStatus.value = 'idle';
  checkoutSessionId.value = null;
  lastPurchase.value = null;
}

// ============================================================================
// BOOSTER TIMER UPDATES
// ============================================================================

/**
 * Update booster remaining times (call from interval)
 */
export function updateBoosterTimers(): void {
  const now = Date.now();
  const updated = activeBoosters.value
    .map((b) => ({
      ...b,
      remainingSeconds: Math.max(
        0,
        Math.floor((new Date(b.expiresAt).getTime() - now) / 1000),
      ),
    }))
    .filter((b) => b.remainingSeconds > 0);

  if (updated.length !== activeBoosters.value.length) {
    activeBoosters.value = updated;
  }
}

// ============================================================================
// RESET
// ============================================================================

/**
 * Reset all shop state (on logout)
 */
export function resetShopState(): void {
  shopData.value = null;
  activeBoosters.value = [];
  purchaseHistory.value = [];
  isLoadingShop.value = false;
  isProcessingPurchase.value = false;
  shopModalVisible.value = false;
  selectedCategory.value = 'featured';
  checkoutSessionId.value = null;
  checkoutStatus.value = 'idle';
  shopError.value = null;
}
