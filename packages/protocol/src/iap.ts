import { z } from 'zod';

// ============================================================================
// DUST PACKAGES
// ============================================================================

export interface DustPackage {
  id: string;
  dustAmount: number;
  bonusDust: number;      // First-time purchase bonus
  priceUSD: number;       // Reference price (actual price from store)
  storeProductId: string; // For Apple/Google/Steam
}

/**
 * Available dust packages for IAP
 * Note: Actual prices are determined by app stores, these are reference values
 */
export const DUST_PACKAGES: DustPackage[] = [
  { id: 'dust_100', dustAmount: 100, bonusDust: 10, priceUSD: 0.99, storeProductId: 'com.arcade.dust100' },
  { id: 'dust_500', dustAmount: 500, bonusDust: 75, priceUSD: 4.99, storeProductId: 'com.arcade.dust500' },
  { id: 'dust_1100', dustAmount: 1100, bonusDust: 200, priceUSD: 9.99, storeProductId: 'com.arcade.dust1100' },
  { id: 'dust_2500', dustAmount: 2500, bonusDust: 500, priceUSD: 19.99, storeProductId: 'com.arcade.dust2500' },
  { id: 'dust_6500', dustAmount: 6500, bonusDust: 1500, priceUSD: 49.99, storeProductId: 'com.arcade.dust6500' },
  { id: 'dust_14000', dustAmount: 14000, bonusDust: 4000, priceUSD: 99.99, storeProductId: 'com.arcade.dust14000' },
];

// ============================================================================
// SCHEMAS
// ============================================================================

export const DustPackageSchema = z.object({
  id: z.string(),
  dustAmount: z.number().int().positive(),
  bonusDust: z.number().int().min(0),
  priceUSD: z.number().positive(),
  storeProductId: z.string(),
});

export const PlatformSchema = z.enum(['ios', 'android', 'steam', 'web']);
export type Platform = z.infer<typeof PlatformSchema>;

// Get packages response
export const GetPackagesResponseSchema = z.object({
  packages: z.array(DustPackageSchema),
  firstPurchaseBonusAvailable: z.record(z.string(), z.boolean()), // packageId -> hasFirstPurchaseBonus
});
export type GetPackagesResponse = z.infer<typeof GetPackagesResponseSchema>;

// Grant dust request (admin only)
export const GrantDustRequestSchema = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1),
  transactionId: z.string().min(1),
  platform: PlatformSchema,
  receipt: z.string().optional(), // Store receipt for verification (future)
});
export type GrantDustRequest = z.infer<typeof GrantDustRequestSchema>;

// Grant dust response
export const GrantDustResponseSchema = z.object({
  success: z.boolean(),
  dustGranted: z.number().int(),
  bonusGranted: z.number().int(),
  newBalance: z.number().int(),
  isFirstPurchase: z.boolean(),
});
export type GrantDustResponse = z.infer<typeof GrantDustResponseSchema>;

// Transaction record
export const IAPTransactionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  packageId: z.string(),
  dustGranted: z.number().int(),
  bonusGranted: z.number().int(),
  transactionId: z.string(),
  platform: PlatformSchema,
  createdAt: z.string().datetime(),
});
export type IAPTransaction = z.infer<typeof IAPTransactionSchema>;

// Get user transactions
export const GetTransactionsResponseSchema = z.object({
  transactions: z.array(IAPTransactionSchema),
  total: z.number().int(),
});
export type GetTransactionsResponse = z.infer<typeof GetTransactionsResponseSchema>;
