/**
 * Shop API - Microtransactions endpoints
 */
import { request, createDomainError } from './base.js';
import type {
  GetShopResponse,
  CreateCheckoutRequest,
  CreateCheckoutResponse,
  GetPurchasesResponse,
  BuyWithDustRequest,
  BuyWithDustResponse,
  GetActiveBoostersResponse,
  Purchase,
} from '@arcade/protocol';

// ============================================================================
// ERROR CLASS
// ============================================================================

export class ShopApiError extends createDomainError('ShopApiError') {}

// ============================================================================
// SHOP ENDPOINTS
// ============================================================================

/**
 * Get shop overview with all products and user purchase info
 */
export async function getShop(): Promise<GetShopResponse> {
  return request<GetShopResponse>('/v1/shop');
}

/**
 * Create Stripe checkout session for a product
 */
export async function createCheckout(
  data: CreateCheckoutRequest,
): Promise<CreateCheckoutResponse> {
  return request<CreateCheckoutResponse>('/v1/shop/checkout', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Verify checkout session status
 */
export async function verifyCheckout(
  sessionId: string,
): Promise<{ status: string; purchase?: Purchase }> {
  return request<{ status: string; purchase?: Purchase }>(
    `/v1/shop/verify/${sessionId}`,
  );
}

/**
 * Buy item with dust (boosters, convenience items)
 */
export async function buyWithDust(
  data: BuyWithDustRequest,
): Promise<BuyWithDustResponse> {
  return request<BuyWithDustResponse>('/v1/shop/buy-dust', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get user's active boosters
 */
export async function getActiveBoosters(): Promise<GetActiveBoostersResponse> {
  return request<GetActiveBoostersResponse>('/v1/shop/boosters');
}

/**
 * Get user's purchase history
 */
export async function getPurchases(
  limit = 50,
  offset = 0,
): Promise<GetPurchasesResponse> {
  return request<GetPurchasesResponse>(
    `/v1/shop/purchases?limit=${limit}&offset=${offset}`,
  );
}

// ============================================================================
// CHECKOUT FLOW HELPERS
// ============================================================================

/**
 * Start checkout flow - creates session and redirects to Stripe
 */
export async function startCheckout(productId: string): Promise<void> {
  const successUrl = `${window.location.origin}/shop?success=true&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${window.location.origin}/shop?canceled=true`;

  const response = await createCheckout({
    productId,
    successUrl,
    cancelUrl,
  });

  // Redirect to Stripe Checkout
  window.location.href = response.checkoutUrl;
}

/**
 * Poll checkout status until completed or failed
 */
export async function pollCheckoutStatus(
  sessionId: string,
  maxAttempts = 30,
  intervalMs = 2000,
): Promise<{ status: string; purchase?: Purchase }> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await verifyCheckout(sessionId);

    if (result.status === 'completed' || result.status === 'failed' || result.status === 'expired') {
      return result;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return { status: 'timeout' };
}
