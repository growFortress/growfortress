/**
 * Shop Service - Handles Stripe payments, purchases, and dust-based buying
 */
import { prisma } from '../lib/prisma.js';
import {
  createCheckoutSession,
  getCheckoutSession,
  isSessionPaid,
  isStripeConfigured,
  verifyWebhookSignature,
  type Stripe,
} from '../lib/stripe.js';
import {
  DUST_PACKAGES_PLN,
  STARTER_PACK,
  STARTER_PACK_PRICE_GROSZE,
  BOOSTER_DEFINITIONS,
  CONVENIENCE_ITEMS,
  SHOP_ERROR_CODES,
  PREMIUM_HEROES,
  type DustPackagePLN,
  type GetShopResponse,
  type CreateCheckoutResponse,
  type GetPurchasesResponse,
  type Purchase,
  type BuyWithDustResponse,
  type GetActiveBoostersResponse,
  type BoosterType,
  type ConvenienceItemType,
  type PremiumHeroProduct,
} from '@arcade/protocol';

// Rare materials for Starter Pack (pick 3 random)
const RARE_MATERIALS = ['mutant_dna', 'pym_particles', 'extremis', 'cosmic_dust'];

// ============================================================================
// SHOP OVERVIEW
// ============================================================================

/**
 * Get shop overview with products and user purchase info
 */
export async function getShopOverview(userId: string): Promise<GetShopResponse> {
  // Get user's purchase counts for limited items
  const purchaseLimits = await prisma.userPurchaseLimit.findMany({
    where: { userId },
  });
  const userPurchases: Record<string, number> = {};
  for (const limit of purchaseLimits) {
    userPurchases[limit.productId] = limit.purchaseCount;
  }

  // Check first-purchase bonus availability for dust packages
  const purchasedPackages = await prisma.shopPurchase.findMany({
    where: { userId, status: 'COMPLETED', productType: 'DUST' },
    select: { productId: true },
    distinct: ['productId'],
  });
  const purchasedSet = new Set(purchasedPackages.map((p: { productId: string }) => p.productId));
  const firstPurchaseBonusAvailable: Record<string, boolean> = {};
  for (const pkg of DUST_PACKAGES_PLN) {
    firstPurchaseBonusAvailable[pkg.id] = !purchasedSet.has(pkg.id);
  }

  // Check if starter pack is available
  const starterPackPurchased = purchaseLimits.some(
    (l) => l.productId === 'starter_pack' && l.purchaseCount > 0
  );

  // Get user's unlocked heroes for premium hero availability
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
    select: { unlockedHeroIds: true },
  });
  const unlockedHeroIds = new Set(inventory?.unlockedHeroIds ?? []);

  return {
    categories: [
      {
        id: 'featured',
        name: 'Polecane',
        products: starterPackPurchased ? [] : [
          {
            id: 'starter_pack',
            type: 'starter_pack',
            name: 'Starter Pack',
            description: `${STARTER_PACK.dustAmount} Dust + ${STARTER_PACK.goldAmount} Gold + ${STARTER_PACK.rareMaterialsCount}x Rare Materials + Founder Badge`,
            pricePLN: STARTER_PACK_PRICE_GROSZE / 100,
            isLimited: true,
            maxPurchasesPerUser: 1,
            badgeText: 'BEST VALUE',
            sortOrder: 0,
          },
        ],
      },
      {
        id: 'heroes',
        name: 'Jednostki Premium',
        products: PREMIUM_HEROES
          .filter((hero) => !unlockedHeroIds.has(hero.heroId))
          .map((hero, idx) => ({
            id: hero.id,
            type: 'hero' as const,
            name: hero.name,
            description: hero.description,
            pricePLN: hero.pricePLN,
            heroId: hero.heroId,
            isLimited: true,
            maxPurchasesPerUser: 1,
            badgeText: 'PREMIUM',
            sortOrder: idx,
          })),
      },
      {
        id: 'dust',
        name: 'Dust',
        products: DUST_PACKAGES_PLN.map((pkg, idx) => ({
          id: pkg.id,
          type: 'dust' as const,
          name: `${pkg.dustAmount} Dust`,
          description: firstPurchaseBonusAvailable[pkg.id]
            ? `+${pkg.bonusDust} bonus przy pierwszym zakupie!`
            : `Premium waluta`,
          pricePLN: pkg.pricePLN,
          dustAmount: pkg.dustAmount,
          bonusDust: firstPurchaseBonusAvailable[pkg.id] ? pkg.bonusDust : 0,
          isLimited: false,
          badgeText: pkg.id === 'dust_medium' ? 'POPULAR' : undefined,
          sortOrder: idx,
        })),
      },
      {
        id: 'boosters',
        name: 'Boostery',
        products: BOOSTER_DEFINITIONS.map((booster, idx) => ({
          id: booster.id,
          type: 'booster' as const,
          name: getBoosterName(booster.type),
          description: `${booster.durationHours}h boost`,
          pricePLN: 0, // Bought with dust
          dustAmount: booster.dustCost,
          boosterType: booster.type,
          boosterDuration: booster.durationHours,
          isLimited: false,
          sortOrder: idx,
        })),
      },
      {
        id: 'convenience',
        name: 'Przyspieszacze',
        products: CONVENIENCE_ITEMS.map((item, idx) => ({
          id: item.id,
          type: 'convenience' as const,
          name: item.name,
          description: item.description,
          pricePLN: 0, // Bought with dust
          dustAmount: item.dustCost,
          isLimited: false,
          sortOrder: idx,
        })),
      },
    ],
    userPurchases,
    firstPurchaseBonusAvailable,
    starterPackAvailable: !starterPackPurchased,
  };
}

// ============================================================================
// STRIPE CHECKOUT
// ============================================================================

/**
 * Create Stripe checkout session for a product
 */
export async function createCheckout(
  userId: string,
  productId: string,
  successUrl?: string,
  cancelUrl?: string,
): Promise<CreateCheckoutResponse> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured');
  }

  // Find the product
  const product = findProduct(productId);
  if (!product) {
    throw new Error(SHOP_ERROR_CODES.PRODUCT_NOT_FOUND);
  }

  // Check purchase limits
  const canPurchase = await checkPurchaseLimit(userId, productId, product.maxPurchases);
  if (!canPurchase) {
    throw new Error(SHOP_ERROR_CODES.PURCHASE_LIMIT_REACHED);
  }

  // Check if user already owns the hero (for hero products)
  if (product.type === 'HERO' && product.heroProduct) {
    const inventory = await prisma.inventory.findUnique({
      where: { userId },
      select: { unlockedHeroIds: true },
    });
    if (inventory?.unlockedHeroIds.includes(product.heroProduct.heroId)) {
      throw new Error(SHOP_ERROR_CODES.HERO_ALREADY_OWNED);
    }
  }

  // Create checkout session
  const session = await createCheckoutSession({
    userId,
    productId,
    productName: product.name,
    productDescription: product.description,
    priceGrosze: product.priceGrosze,
    successUrl,
    cancelUrl,
  });

  // Create pending purchase record
  await prisma.shopPurchase.create({
    data: {
      userId,
      productId,
      productType: product.type,
      productName: product.name,
      pricePLN: product.priceGrosze,
      status: 'PENDING',
      stripeSessionId: session.id,
    },
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url!,
    expiresAt: new Date(session.expires_at * 1000).toISOString(),
  };
}

/**
 * Handle Stripe webhook event
 */
export async function handleStripeWebhook(
  payload: string | Buffer,
  signature: string,
): Promise<void> {
  const event = verifyWebhookSignature(payload, signature);

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case 'checkout.session.expired':
      await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
      break;
    // Handle other events as needed
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (!isSessionPaid(session)) {
    return;
  }

  const purchase = await prisma.shopPurchase.findUnique({
    where: { stripeSessionId: session.id },
    include: { user: { include: { inventory: true } } },
  });

  if (!purchase || purchase.status !== 'PENDING') {
    return;
  }

  const userId = purchase.userId;
  const productId = purchase.productId;
  const product = findProduct(productId);

  if (!product) {
    await prisma.shopPurchase.update({
      where: { id: purchase.id },
      data: { status: 'FAILED' },
    });
    return;
  }

  // Grant rewards based on product type
  const rewards = await grantProductRewards(userId, productId, product);

  // Update purchase record
  await prisma.shopPurchase.update({
    where: { id: purchase.id },
    data: {
      status: 'COMPLETED',
      stripePaymentId: session.payment_intent as string,
      dustGranted: rewards.dust,
      goldGranted: rewards.gold,
      heroGranted: rewards.hero,
      cosmeticGranted: rewards.cosmetic,
      materialsGranted: rewards.materials,
      completedAt: new Date(),
    },
  });

  // Update purchase limit
  await prisma.userPurchaseLimit.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, purchaseCount: 1 },
    update: { purchaseCount: { increment: 1 }, lastPurchase: new Date() },
  });
}

async function handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
  await prisma.shopPurchase.updateMany({
    where: { stripeSessionId: session.id, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });
}

// ============================================================================
// BUY WITH DUST
// ============================================================================

/**
 * Buy a booster or convenience item with dust
 */
export async function buyWithDust(
  userId: string,
  itemType: 'booster' | 'convenience' | 'cosmetic',
  itemId: string,
): Promise<BuyWithDustResponse> {
  let dustCost = 0;
  let expiresAt: Date | undefined;

  if (itemType === 'booster') {
    const booster = BOOSTER_DEFINITIONS.find((b) => b.id === itemId);
    if (!booster) {
      throw new Error(SHOP_ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    dustCost = booster.dustCost;
    expiresAt = new Date(Date.now() + booster.durationHours * 60 * 60 * 1000);
  } else if (itemType === 'convenience') {
    const item = CONVENIENCE_ITEMS.find((i) => i.id === itemId);
    if (!item) {
      throw new Error(SHOP_ERROR_CODES.PRODUCT_NOT_FOUND);
    }
    dustCost = item.dustCost;
  } else {
    throw new Error(SHOP_ERROR_CODES.INVALID_PRODUCT_TYPE);
  }

  // Check if user has enough dust
  const inventory = await prisma.inventory.findUnique({
    where: { userId },
  });

  if (!inventory || inventory.dust < dustCost) {
    throw new Error(SHOP_ERROR_CODES.INSUFFICIENT_DUST);
  }

  // Deduct dust and grant item
  const result = await prisma.$transaction(async (tx) => {
    const updatedInventory = await tx.inventory.update({
      where: { userId },
      data: { dust: { decrement: dustCost } },
    });

    if (itemType === 'booster' && expiresAt) {
      // Create or extend booster
      const booster = BOOSTER_DEFINITIONS.find((b) => b.id === itemId)!;
      const existingBooster = await tx.activeBooster.findFirst({
        where: { userId, type: booster.type },
      });

      if (existingBooster && existingBooster.expiresAt > new Date()) {
        // Extend existing booster
        await tx.activeBooster.update({
          where: { id: existingBooster.id },
          data: {
            expiresAt: new Date(existingBooster.expiresAt.getTime() + booster.durationHours * 60 * 60 * 1000),
          },
        });
      } else {
        // Create new booster
        await tx.activeBooster.create({
          data: { userId, type: booster.type, expiresAt },
        });
      }
    }

    // Handle convenience items
    if (itemType === 'convenience') {
      await handleConvenienceItem(tx, userId, itemId as ConvenienceItemType);
    }

    return updatedInventory;
  });

  return {
    success: true,
    dustSpent: dustCost,
    newDustBalance: result.dust,
    itemGranted: itemId,
    expiresAt: expiresAt?.toISOString(),
  };
}

// ============================================================================
// ACTIVE BOOSTERS
// ============================================================================

/**
 * Get user's active boosters
 */
export async function getActiveBoosters(userId: string): Promise<GetActiveBoostersResponse> {
  const now = new Date();
  const boosters = await prisma.activeBooster.findMany({
    where: { userId, expiresAt: { gt: now } },
  });

  return {
    boosters: boosters.map((b) => ({
      type: b.type as BoosterType,
      expiresAt: b.expiresAt.toISOString(),
      remainingSeconds: Math.floor((b.expiresAt.getTime() - now.getTime()) / 1000),
    })),
  };
}

// ============================================================================
// PURCHASES HISTORY
// ============================================================================

/**
 * Get user's purchase history
 */
export async function getPurchases(
  userId: string,
  limit = 50,
  offset = 0,
): Promise<GetPurchasesResponse> {
  const [purchases, total] = await Promise.all([
    prisma.shopPurchase.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      skip: offset,
    }),
    prisma.shopPurchase.count({ where: { userId } }),
  ]);

  return {
    purchases: purchases.map((p): Purchase => ({
      id: p.id,
      productId: p.productId,
      productType: p.productType.toLowerCase() as Purchase['productType'],
      productName: p.productName,
      pricePLN: p.pricePLN / 100,
      status: p.status.toLowerCase() as Purchase['status'],
      dustGranted: p.dustGranted ?? undefined,
      goldGranted: p.goldGranted ?? undefined,
      heroGranted: p.heroGranted ?? undefined,
      cosmeticGranted: p.cosmeticGranted ?? undefined,
      materialsGranted: (p.materialsGranted as Record<string, number> | null) ?? undefined,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt?.toISOString(),
    })),
    total,
    hasMore: offset + purchases.length < total,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ProductInfo {
  name: string;
  description: string;
  priceGrosze: number;
  type: 'DUST' | 'STARTER_PACK' | 'HERO' | 'COSMETIC' | 'BATTLE_PASS' | 'BOOSTER' | 'CONVENIENCE' | 'GACHA';
  maxPurchases?: number;
  dustPackage?: DustPackagePLN;
  heroProduct?: PremiumHeroProduct;
}

function findProduct(productId: string): ProductInfo | null {
  // Check dust packages
  const dustPkg = DUST_PACKAGES_PLN.find((p) => p.id === productId);
  if (dustPkg) {
    return {
      name: `${dustPkg.dustAmount} Dust`,
      description: `+${dustPkg.bonusDust} bonus przy pierwszym zakupie`,
      priceGrosze: dustPkg.priceGrosze,
      type: 'DUST',
      dustPackage: dustPkg,
    };
  }

  // Check starter pack
  if (productId === 'starter_pack') {
    return {
      name: 'Starter Pack',
      description: `${STARTER_PACK.dustAmount} Dust + ${STARTER_PACK.goldAmount} Gold + ${STARTER_PACK.rareMaterialsCount}x Rare Materials + Founder Badge`,
      priceGrosze: STARTER_PACK_PRICE_GROSZE,
      type: 'STARTER_PACK',
      maxPurchases: 1,
    };
  }

  // Check premium heroes
  const heroProduct = PREMIUM_HEROES.find((h) => h.id === productId);
  if (heroProduct) {
    return {
      name: heroProduct.name,
      description: heroProduct.description,
      priceGrosze: heroProduct.priceGrosze,
      type: 'HERO',
      maxPurchases: 1,
      heroProduct,
    };
  }

  return null;
}

async function checkPurchaseLimit(
  userId: string,
  productId: string,
  maxPurchases?: number,
): Promise<boolean> {
  if (!maxPurchases) return true;

  const limit = await prisma.userPurchaseLimit.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  return !limit || limit.purchaseCount < maxPurchases;
}

interface Rewards {
  dust?: number;
  gold?: number;
  hero?: string;
  cosmetic?: string;
  materials?: Record<string, number>;
}

async function grantProductRewards(
  userId: string,
  productId: string,
  product: ProductInfo,
): Promise<Rewards> {
  const rewards: Rewards = {};

  if (product.type === 'DUST' && product.dustPackage) {
    // Check if first purchase for bonus
    const previousPurchase = await prisma.shopPurchase.findFirst({
      where: { userId, productId, status: 'COMPLETED' },
    });
    const isFirstPurchase = !previousPurchase;
    const bonusDust = isFirstPurchase ? product.dustPackage.bonusDust : 0;
    const totalDust = product.dustPackage.dustAmount + bonusDust;

    await prisma.inventory.update({
      where: { userId },
      data: { dust: { increment: totalDust } },
    });

    rewards.dust = totalDust;
  }

  if (product.type === 'STARTER_PACK') {
    // Pick random rare materials
    const shuffled = [...RARE_MATERIALS].sort(() => Math.random() - 0.5);
    const selectedMaterials = shuffled.slice(0, STARTER_PACK.rareMaterialsCount);
    const materialsToGrant: Record<string, number> = {};
    for (const mat of selectedMaterials) {
      materialsToGrant[mat] = (materialsToGrant[mat] || 0) + 1;
    }

    // Grant all starter pack contents
    await prisma.$transaction(async (tx) => {
      // Get current inventory
      const inventory = await tx.inventory.findUnique({
        where: { userId },
        select: { materials: true },
      });
      const currentMaterials = (inventory?.materials as Record<string, number>) || {};

      // Merge materials
      const updatedMaterials = { ...currentMaterials };
      for (const [matId, amount] of Object.entries(materialsToGrant)) {
        updatedMaterials[matId] = (updatedMaterials[matId] || 0) + amount;
      }

      // Grant dust, gold, and materials
      await tx.inventory.update({
        where: { userId },
        data: {
          dust: { increment: STARTER_PACK.dustAmount },
          gold: { increment: STARTER_PACK.goldAmount },
          materials: updatedMaterials,
        },
      });

      // Grant cosmetic (founder badge) - upsert to avoid duplicates
      await tx.userCosmetic.upsert({
        where: { userId_cosmeticId: { userId, cosmeticId: STARTER_PACK.cosmeticId } },
        create: { userId, cosmeticId: STARTER_PACK.cosmeticId },
        update: {},
      });
    });

    rewards.dust = STARTER_PACK.dustAmount;
    rewards.gold = STARTER_PACK.goldAmount;
    rewards.materials = materialsToGrant;
    rewards.cosmetic = STARTER_PACK.cosmeticId;
  }

  if (product.type === 'HERO' && product.heroProduct) {
    // Grant premium hero to user's inventory
    await prisma.inventory.update({
      where: { userId },
      data: {
        unlockedHeroIds: {
          push: product.heroProduct.heroId,
        },
      },
    });

    rewards.hero = product.heroProduct.heroId;
  }

  return rewards;
}

function getBoosterName(type: BoosterType): string {
  switch (type) {
    case 'xp_1.5x': return '1.5x XP Boost';
    case 'gold_1.5x': return '1.5x Gold Boost';
    case 'material_1.5x': return '1.5x Material Boost';
    case 'ultimate_1.5x': return '1.5x Ultimate Boost';
    default: return 'Unknown Booster';
  }
}

async function handleConvenienceItem(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  itemType: ConvenienceItemType,
): Promise<void> {
  switch (itemType) {
    case 'idle_doubler':
      // Set a flag that next idle claim is doubled (would need to add to user model)
      // For now, this is a placeholder
      break;
    case 'instant_claim':
      // Reset last idle claim time to force new calculation
      await tx.user.update({
        where: { id: userId },
        data: { lastIdleClaimAt: new Date(Date.now() - 8 * 60 * 60 * 1000) }, // 8 hours ago
      });
      break;
    case 'quest_refresh':
      // Delete today's quest progress to allow re-completion
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await tx.dailyQuestProgress.deleteMany({
        where: {
          userId,
          resetAt: { gte: today },
        },
      });
      break;
    // Other items would be handled by their respective systems
    default:
      break;
  }
}

/**
 * Verify a checkout session (for client polling)
 */
export async function verifyCheckout(
  sessionId: string,
  userId: string,
): Promise<{ status: string; purchase?: Purchase }> {
  const purchase = await prisma.shopPurchase.findFirst({
    where: { stripeSessionId: sessionId, userId },
  });

  if (!purchase) {
    // Try to fetch from Stripe directly
    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return { status: 'not_found' };
    }

    return {
      status: session.payment_status === 'paid' ? 'completed' : session.status || 'unknown',
    };
  }

  return {
    status: purchase.status.toLowerCase(),
    purchase: purchase.status === 'COMPLETED' ? {
      id: purchase.id,
      productId: purchase.productId,
      productType: purchase.productType.toLowerCase() as Purchase['productType'],
      productName: purchase.productName,
      pricePLN: purchase.pricePLN / 100,
      status: purchase.status.toLowerCase() as Purchase['status'],
      dustGranted: purchase.dustGranted ?? undefined,
      goldGranted: purchase.goldGranted ?? undefined,
      heroGranted: purchase.heroGranted ?? undefined,
      cosmeticGranted: purchase.cosmeticGranted ?? undefined,
      materialsGranted: (purchase.materialsGranted as Record<string, number> | null) ?? undefined,
      createdAt: purchase.createdAt.toISOString(),
      completedAt: purchase.completedAt?.toISOString(),
    } : undefined,
  };
}
