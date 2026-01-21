import Stripe from "stripe";
import { config } from "../config.js";
import type { Currency } from "@arcade/protocol";

// ============================================================================
// STRIPE CLIENT
// ============================================================================

let stripeClient: Stripe | null = null;

/**
 * Get Stripe client instance (singleton)
 * Returns null if STRIPE_SECRET_KEY is not configured
 */
export function getStripe(): Stripe | null {
  if (!config.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(config.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }

  return stripeClient;
}

/**
 * Check if Stripe is configured and available
 */
export function isStripeConfigured(): boolean {
  return !!config.STRIPE_SECRET_KEY;
}

// ============================================================================
// CHECKOUT SESSION
// ============================================================================

export interface CreateCheckoutParams {
  userId: string;
  productId: string;
  productName: string;
  productDescription: string;
  priceGrosze: number;
  currency: Currency;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

/**
 * Create a Stripe Checkout Session
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  const currency = params.currency.toLowerCase();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    currency,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: params.productName,
            description: params.productDescription,
          },
          unit_amount: params.priceGrosze, // Amount in grosze (1/100 PLN)
        },
        quantity: 1,
      },
    ],
    success_url: params.successUrl || config.STRIPE_SUCCESS_URL,
    cancel_url: params.cancelUrl || config.STRIPE_CANCEL_URL,
    client_reference_id: params.userId,
    metadata: {
      userId: params.userId,
      productId: params.productId,
      ...params.metadata,
    },
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  });

  return session;
}

// ============================================================================
// WEBHOOK VERIFICATION
// ============================================================================

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("Stripe is not configured");
  }

  if (!config.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook secret is not configured");
  }

  return stripe.webhooks.constructEvent(
    payload,
    signature,
    config.STRIPE_WEBHOOK_SECRET,
  );
}

// ============================================================================
// PAYMENT INTENT HELPERS
// ============================================================================

/**
 * Retrieve a Checkout Session by ID
 */
export async function getCheckoutSession(
  sessionId: string,
): Promise<Stripe.Checkout.Session | null> {
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }

  try {
    return await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return null;
  }
}

/**
 * Check if a checkout session was successfully paid
 */
export function isSessionPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid";
}

/**
 * Get payment intent from session
 */
export async function getPaymentIntent(
  session: Stripe.Checkout.Session,
): Promise<Stripe.PaymentIntent | null> {
  const stripe = getStripe();
  if (!stripe || !session.payment_intent) {
    return null;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent.id;

  try {
    return await stripe.paymentIntents.retrieve(paymentIntentId);
  } catch {
    return null;
  }
}

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * Create a refund for a payment
 */
export async function createRefund(
  paymentIntentId: string,
  reason?: "duplicate" | "fraudulent" | "requested_by_customer",
): Promise<Stripe.Refund | null> {
  const stripe = getStripe();
  if (!stripe) {
    return null;
  }

  try {
    return await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason,
    });
  } catch {
    return null;
  }
}

// ============================================================================
// TYPES EXPORT
// ============================================================================

export type { Stripe };
