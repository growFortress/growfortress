import { z } from 'zod';

// ============================================================================
// PRODUCT TYPES
// ============================================================================

export const ProductTypeSchema = z.enum([
  'dust',           // Premium currency pack
  'starter_pack',   // Limited starter bundle
  'hero',           // Direct hero purchase
  'cosmetic',       // Skins, themes
  'battle_pass',    // Season pass
  'booster',        // XP/Gold/Material boosts
  'convenience',    // Skip tokens, instant claims
  'gacha',          // Hero/Artifact summons
  'bundle',         // Value bundles (zestawy)
]);
export type ProductType = z.infer<typeof ProductTypeSchema>;

export const PurchaseStatusSchema = z.enum([
  'pending',      // Checkout created, waiting for payment
  'completed',    // Payment successful, rewards granted
  'failed',       // Payment failed
  'refunded',     // Refunded by admin
  'expired',      // Checkout session expired
]);
export type PurchaseStatus = z.infer<typeof PurchaseStatusSchema>;

// ============================================================================
// SHOP PRODUCTS
// ============================================================================

export interface ShopProduct {
  id: string;
  type: ProductType;
  name: string;
  description: string;
  pricePLN: number;        // Price in PLN (grosze stored as integer * 100)

  // Content (based on type)
  dustAmount?: number;
  bonusDust?: number;       // First-time bonus
  goldAmount?: number;
  heroId?: string;
  cosmeticId?: string;
  boosterType?: BoosterType;
  boosterDuration?: number; // in hours

  // Limits
  isLimited: boolean;
  maxPurchasesPerUser?: number;

  // Display
  badgeText?: string;       // e.g., "BEST VALUE", "LIMITED"
  iconUrl?: string;
  sortOrder: number;
}

export const ShopProductSchema = z.object({
  id: z.string(),
  type: ProductTypeSchema,
  name: z.string(),
  description: z.string(),
  pricePLN: z.number().positive(),

  dustAmount: z.number().int().min(0).optional(),
  bonusDust: z.number().int().min(0).optional(),
  goldAmount: z.number().int().min(0).optional(),
  heroId: z.string().optional(),
  cosmeticId: z.string().optional(),
  boosterType: z.string().optional(),
  boosterDuration: z.number().int().positive().optional(),

  isLimited: z.boolean(),
  maxPurchasesPerUser: z.number().int().positive().optional(),

  badgeText: z.string().optional(),
  iconUrl: z.string().optional(),
  sortOrder: z.number().int(),
});

// ============================================================================
// DUST PACKAGES (PLN pricing)
// ============================================================================

export interface DustPackagePLN {
  id: string;
  dustAmount: number;
  bonusDust: number;
  pricePLN: number;         // e.g., 4.99
  priceGrosze: number;      // e.g., 499 (for Stripe)
  stripePriceId?: string;   // Stripe Price ID
}

// 4 dust packages: 5 PLN to 100 PLN range
export const DUST_PACKAGES_PLN: DustPackagePLN[] = [
  { id: 'dust_mini', dustAmount: 100, bonusDust: 0, pricePLN: 4.99, priceGrosze: 499 },
  { id: 'dust_small', dustAmount: 450, bonusDust: 0, pricePLN: 19.99, priceGrosze: 1999 },
  { id: 'dust_large', dustAmount: 1200, bonusDust: 0, pricePLN: 49.99, priceGrosze: 4999 },
  { id: 'dust_mega', dustAmount: 2800, bonusDust: 0, pricePLN: 99.99, priceGrosze: 9999 },
];
// mini = 4.99/100, small = 4.44/100 (~11% off), large = 4.17/100 (~16% off), mega = 3.57/100 (~28% off)

export const DustPackagePLNSchema = z.object({
  id: z.string(),
  dustAmount: z.number().int().positive(),
  bonusDust: z.number().int().min(0),
  pricePLN: z.number().positive(),
  priceGrosze: z.number().int().positive(),
  stripePriceId: z.string().optional(),
});

// ============================================================================
// STARTER PACK
// ============================================================================

export interface StarterPackContent {
  dustAmount: number;
  goldAmount: number;
  rareMaterialsCount: number;
  cosmeticId: string;          // Founder badge
}

// Starter pack at 20 PLN - good value impulse purchase for new players
// ONE TIME ONLY per account!
export const STARTER_PACK: StarterPackContent = {
  dustAmount: 600,
  goldAmount: 3000,
  rareMaterialsCount: 3,
  cosmeticId: 'badge_founder',
};

export const STARTER_PACK_PRICE_PLN = 19.99;
export const STARTER_PACK_PRICE_GROSZE = 1999;

// ============================================================================
// VALUE BUNDLES (zestawy)
// ============================================================================

export interface BundleProduct {
  id: string;
  name: string;
  description: string;
  pricePLN: number;
  priceGrosze: number;
  // Contents
  dustAmount: number;
  goldAmount: number;
  randomHeroCount: number;      // Number of random heroes to unlock
  randomArtifactCount: number;  // Number of random artifacts to grant
  // Display
  badgeText?: string;
}

// Zestawy wartościowe - lepszy value niż kupowanie osobno
export const BUNDLES: BundleProduct[] = [
  {
    id: 'bundle_bronze',
    name: 'Zestaw Brązowy',
    description: '250 Dust, 2000 Gold, 3 losowe artefakty',
    pricePLN: 29.99,
    priceGrosze: 2999,
    dustAmount: 250,
    goldAmount: 2000,
    randomHeroCount: 0,
    randomArtifactCount: 3,
  },
  {
    id: 'bundle_silver',
    name: 'Zestaw Srebrny',
    description: '700 Dust, 5000 Gold, 1 losowa jednostka, 5 losowych artefaktów',
    pricePLN: 69.99,
    priceGrosze: 6999,
    dustAmount: 700,
    goldAmount: 5000,
    randomHeroCount: 1,
    randomArtifactCount: 5,
    badgeText: 'POPULAR',
  },
  {
    id: 'bundle_gold',
    name: 'Zestaw Złoty',
    description: '1500 Dust, 12000 Gold, 2 losowe jednostki, 8 losowych artefaktów',
    pricePLN: 119.99,
    priceGrosze: 11999,
    dustAmount: 1500,
    goldAmount: 12000,
    randomHeroCount: 2,
    randomArtifactCount: 8,
    badgeText: 'BEST VALUE',
  },
];

// ============================================================================
// BATTLE PASS
// ============================================================================

export interface BattlePassProduct {
  id: string;
  name: string;
  description: string;
  pricePLN: number;
  priceGrosze: number;
  seasonNumber: number;
  durationDays: number;
}

export const BATTLE_PASS: BattlePassProduct = {
  id: 'battle_pass_premium',
  name: 'Battle Pass Premium',
  description: 'Odblokuj ścieżkę premium z ekskluzywnymi nagrodami przez cały sezon!',
  pricePLN: 39.99,
  priceGrosze: 3999,
  seasonNumber: 1,
  durationDays: 30,
};

// ============================================================================
// BOOSTERS (simplified for MVP - can expand later)
// ============================================================================

// Boosters are 1.5x (not 2x!) - balanced, not OP
export const BoosterTypeSchema = z.enum([
  'xp_1.5x',
  'gold_1.5x',
  'material_1.5x',
  'ultimate_1.5x',    // All above
]);
export type BoosterType = z.infer<typeof BoosterTypeSchema>;

export interface BoosterDefinition {
  id: string;
  type: BoosterType;
  durationHours: number;
  dustCost: number;
  weeklyLimit: number;  // Max purchases per week
}

// Nerfed: 1.5x instead of 2x, weekly limits (dust costs reduced ~25%)
export const BOOSTER_DEFINITIONS: BoosterDefinition[] = [
  { id: 'xp_3h', type: 'xp_1.5x', durationHours: 3, dustCost: 110, weeklyLimit: 3 },
  { id: 'gold_3h', type: 'gold_1.5x', durationHours: 3, dustCost: 110, weeklyLimit: 3 },
  { id: 'material_3h', type: 'material_1.5x', durationHours: 3, dustCost: 150, weeklyLimit: 2 },
  { id: 'ultimate_3h', type: 'ultimate_1.5x', durationHours: 3, dustCost: 300, weeklyLimit: 1 },
];

// ============================================================================
// CONVENIENCE ITEMS
// ============================================================================

export const ConvenienceItemTypeSchema = z.enum([
  'idle_extender',      // +4h cap
  'idle_doubler',       // 2x rewards (single claim)
  'instant_claim',      // Claim idle rewards now
  'quest_refresh',      // Reset daily quests
  'boss_ticket',        // Extra Boss Rush attempt
  'pvp_reset',          // Reset PvP cooldown
  'craft_accelerator',  // Instant craft
]);
export type ConvenienceItemType = z.infer<typeof ConvenienceItemTypeSchema>;

export interface ConvenienceItem {
  id: ConvenienceItemType;
  name: string;
  description: string;
  dustCost: number;
}

// Dust costs reduced ~25% to match economy rebalance
export const CONVENIENCE_ITEMS: ConvenienceItem[] = [
  { id: 'idle_extender', name: 'Idle Extender', description: 'Zwiększ limit idle z 8h do 12h', dustCost: 185 },
  { id: 'idle_doubler', name: 'Idle Doubler', description: '2x nagrody przy następnym odbiorze', dustCost: 260 },
  { id: 'instant_claim', name: 'Instant Claim', description: 'Odbierz nagrody idle teraz', dustCost: 110 },
  { id: 'quest_refresh', name: 'Quest Refresh', description: 'Zresetuj dzienne zadania', dustCost: 220 },
  { id: 'boss_ticket', name: 'Boss Ticket', description: '+1 próba Boss Rush', dustCost: 150 },
  { id: 'pvp_reset', name: 'PvP Reset', description: 'Zresetuj cooldown PvP', dustCost: 110 },
  { id: 'craft_accelerator', name: 'Craft Accelerator', description: 'Natychmiastowy craft', dustCost: 375 },
];

// ============================================================================
// CHECKOUT / PAYMENT FLOW
// ============================================================================

// Create checkout session request
export const CreateCheckoutRequestSchema = z.object({
  productId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutRequest = z.infer<typeof CreateCheckoutRequestSchema>;

// Create checkout session response
export const CreateCheckoutResponseSchema = z.object({
  sessionId: z.string(),
  checkoutUrl: z.string().url(),
  expiresAt: z.string().datetime(),
});
export type CreateCheckoutResponse = z.infer<typeof CreateCheckoutResponseSchema>;

// ============================================================================
// PURCHASES
// ============================================================================

export const PurchaseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productType: ProductTypeSchema,
  productName: z.string(),
  pricePLN: z.number(),
  status: PurchaseStatusSchema,
  dustGranted: z.number().int().optional(),
  goldGranted: z.number().int().optional(),
  heroGranted: z.string().optional(),
  cosmeticGranted: z.string().optional(),
  materialsGranted: z.record(z.string(), z.number()).optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type Purchase = z.infer<typeof PurchaseSchema>;

// Get purchases history
export const GetPurchasesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type GetPurchasesQuery = z.infer<typeof GetPurchasesQuerySchema>;

export const GetPurchasesResponseSchema = z.object({
  purchases: z.array(PurchaseSchema),
  total: z.number().int(),
  hasMore: z.boolean(),
});
export type GetPurchasesResponse = z.infer<typeof GetPurchasesResponseSchema>;

// ============================================================================
// SHOP OVERVIEW
// ============================================================================

export const ShopCategorySchema = z.enum([
  'featured',       // Starter pack, limited offers, battle pass
  'heroes',         // Premium hero purchases
  'dust',           // Dust packages
  'bundles',        // Value bundles (zestawy)
  'boosters',       // XP/Gold boosts
  'convenience',    // Skip tokens
  'cosmetics',      // Skins, themes
]);
export type ShopCategory = z.infer<typeof ShopCategorySchema>;

export const GetShopResponseSchema = z.object({
  categories: z.array(z.object({
    id: ShopCategorySchema,
    name: z.string(),
    products: z.array(ShopProductSchema),
  })),
  userPurchases: z.record(z.string(), z.number().int()), // productId -> count
  firstPurchaseBonusAvailable: z.record(z.string(), z.boolean()),
  starterPackAvailable: z.boolean(),
});
export type GetShopResponse = z.infer<typeof GetShopResponseSchema>;

// ============================================================================
// BUY WITH DUST (in-game currency purchase)
// ============================================================================

export const BuyWithDustRequestSchema = z.object({
  itemType: z.enum(['booster', 'convenience', 'cosmetic']),
  itemId: z.string().min(1),
});
export type BuyWithDustRequest = z.infer<typeof BuyWithDustRequestSchema>;

export const BuyWithDustResponseSchema = z.object({
  success: z.boolean(),
  dustSpent: z.number().int(),
  newDustBalance: z.number().int(),
  itemGranted: z.string(),
  expiresAt: z.string().datetime().optional(), // For boosters
});
export type BuyWithDustResponse = z.infer<typeof BuyWithDustResponseSchema>;

// ============================================================================
// ACTIVE BOOSTERS
// ============================================================================

export const ActiveBoosterSchema = z.object({
  type: BoosterTypeSchema,
  expiresAt: z.string().datetime(),
  remainingSeconds: z.number().int(),
});
export type ActiveBooster = z.infer<typeof ActiveBoosterSchema>;

export const GetActiveBoostersResponseSchema = z.object({
  boosters: z.array(ActiveBoosterSchema),
});
export type GetActiveBoostersResponse = z.infer<typeof GetActiveBoostersResponseSchema>;

// ============================================================================
// SHOP ERROR CODES
// ============================================================================

export const SHOP_ERROR_CODES = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INSUFFICIENT_DUST: 'INSUFFICIENT_DUST',
  PURCHASE_LIMIT_REACHED: 'PURCHASE_LIMIT_REACHED',
  STARTER_PACK_ALREADY_PURCHASED: 'STARTER_PACK_ALREADY_PURCHASED',
  CHECKOUT_EXPIRED: 'CHECKOUT_EXPIRED',
  CHECKOUT_FAILED: 'CHECKOUT_FAILED',
  ALREADY_OWNED: 'ALREADY_OWNED',
  INVALID_PRODUCT_TYPE: 'INVALID_PRODUCT_TYPE',
  HERO_ALREADY_OWNED: 'HERO_ALREADY_OWNED',
} as const;

export type ShopErrorCode = typeof SHOP_ERROR_CODES[keyof typeof SHOP_ERROR_CODES];

// ============================================================================
// PREMIUM HEROES (PLN pricing - shop exclusive)
// ============================================================================

export interface PremiumHeroProduct {
  id: string;
  heroId: string;
  name: string;
  description: string;
  pricePLN: number;
  priceGrosze: number;
  class: string;
  role: string;
  rarity: 'epic';
}

export const PREMIUM_HEROES: PremiumHeroProduct[] = [
  {
    id: 'hero_inferno',
    heroId: 'inferno',
    name: 'Unit-6 "Inferno"',
    description: 'Ekskluzywna jednostka Fire/DPS z poteznym DMG i efektami podpalenia',
    pricePLN: 29.99,
    priceGrosze: 2999,
    class: 'fire',
    role: 'dps',
    rarity: 'epic',
  },
  {
    id: 'hero_glacier',
    heroId: 'glacier',
    name: 'Unit-8 "Glacier"',
    description: 'Ekskluzywna jednostka Ice/Tank z potezna obrona i kontrola tlumu',
    pricePLN: 29.99,
    priceGrosze: 2999,
    class: 'ice',
    role: 'tank',
    rarity: 'epic',
  },
];
