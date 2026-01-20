/**
 * Shop View - WoT-Inspired Layout
 *
 * Features:
 * - Fullscreen layout with vertical sidebar navigation
 * - Left sidebar with icon categories (WoT-style)
 * - Main content area with product grid
 * - Interstitial Starter Pack offer
 * - Tier-based product cards
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import { audioManager } from '../../game/AudioManager.js';
import {
  DUST_PACKAGES_PLN,
  STARTER_PACK_PRICE_PLN,
  PREMIUM_HEROES,
  BUNDLES,
  BATTLE_PASS,
  type ShopCategory,
} from '@arcade/protocol';
import {
  shopModalVisible,
  shopData,
  isLoadingShop,
  isProcessingPurchase,
  selectedCategory,
  checkoutStatus,
  shopError,
  starterPackAvailable,
  lastPurchase,
  loadShop,
  hideShopModal,
  selectCategory,
  startCheckout,
  resetCheckoutStatus,
} from '../../state/shop.signals.js';
import { displayDust, displayGold } from '../../state/game.signals.js';
import { unlockedHeroIds } from '../../state/fortress.signals.js';
import { Button } from '../shared/Button.js';
import { Icon, type IconName } from '../icons/Icon.js';
import styles from './ShopModal.module.css';

// Session storage key for interstitial offer
const INTERSTITIAL_SHOWN_KEY = 'shop_interstitial_shown';

// Product detail types
type ProductDetailType = 'dust' | 'hero' | 'bundle' | 'starter_pack' | 'battle_pass';

interface ProductDetail {
  type: ProductDetailType;
  id: string;
  name: string;
  description: string;
  pricePLN: number;
  dustAmount?: number;
  goldAmount?: number;
  bonusPercent?: number;
  heroClass?: string;
  heroRole?: string;
  randomHeroCount?: number;
  randomArtifactCount?: number;
  durationDays?: number;
}

// Category config with Icon names
const CATEGORIES: { id: ShopCategory; labelKey: string; icon: IconName }[] = [
  { id: 'featured', labelKey: 'shop.categories.featured', icon: 'star' },
  { id: 'heroes', labelKey: 'shop.categories.heroes', icon: 'sword' },
  { id: 'dust', labelKey: 'shop.categories.dust', icon: 'dust' },
  { id: 'bundles', labelKey: 'shop.categories.bundles', icon: 'gem' },
];

// Dust package savings percentages
const DUST_SAVINGS: Record<string, number> = {
  dust_small: 0,
  dust_medium: 15,
  dust_large: 22,
  dust_mega: 28,
};

export function ShopModal() {
  const { t } = useTranslation('common');
  const isVisible = shopModalVisible.value;
  const data = shopData.value;
  const loading = isLoadingShop.value;
  const processing = isProcessingPurchase.value;
  const category = selectedCategory.value;
  const status = checkoutStatus.value;
  const error = shopError.value;
  const dust = displayDust.value;
  const gold = displayGold.value;

  // Interstitial offer state
  const [showInterstitial, setShowInterstitial] = useState(false);

  // Product detail modal state
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);

  // Load shop data when view opens
  useEffect(() => {
    if (isVisible && !data) {
      loadShop();
    }
  }, [isVisible, data]);

  // Show interstitial offer once per session when view opens
  useEffect(() => {
    if (isVisible && starterPackAvailable.value && !loading) {
      const alreadyShown = sessionStorage.getItem(INTERSTITIAL_SHOWN_KEY);
      if (!alreadyShown) {
        setShowInterstitial(true);
        sessionStorage.setItem(INTERSTITIAL_SHOWN_KEY, 'true');
      }
    }
  }, [isVisible, loading]);

  // Play success sound when status changes to 'success'
  const prevStatus = useRef(status);
  useEffect(() => {
    if (status === 'success' && prevStatus.current !== 'success') {
      audioManager.playSfx('purchase');
    }
    prevStatus.current = status;
  }, [status]);

  const handleBuyDust = async (productId: string) => {
    await startCheckout(productId);
  };

  const handleInterstitialBuy = async () => {
    setShowInterstitial(false);
    await startCheckout('starter_pack');
  };

  const handleInterstitialClose = () => {
    setShowInterstitial(false);
  };

  const handleBack = () => {
    hideShopModal();
  };

  const handleProductClick = (product: ProductDetail) => {
    audioManager.playSfx('ui_click');
    setSelectedProduct(product);
  };

  const handleCloseProductDetail = () => {
    setSelectedProduct(null);
  };

  const handleBuyFromDetail = async () => {
    if (selectedProduct) {
      setSelectedProduct(null);
      await startCheckout(selectedProduct.id);
    }
  };

  // Don't render if not visible
  if (!isVisible) return null;

  // Get current category info
  const currentCategory = CATEGORIES.find((c) => c.id === category);

  // Render loading state
  if (loading) {
    return (
      <div class={styles.shopContainer}>
        <header class={styles.shopHeader}>
          <div class={styles.headerLeft}>
            <button class={styles.backButton} onClick={handleBack}>
              <Icon name="close" size={16} />
              {t('buttons.back')}
            </button>
            <h1 class={styles.shopTitle}>{t('shop.title')}</h1>
          </div>
        </header>
        <div class={styles.loading}>{t('shop.loading')}</div>
      </div>
    );
  }

  // Render interstitial offer
  const renderInterstitialOffer = () => {
    if (!showInterstitial || !starterPackAvailable.value) return null;

    return (
      <div class={styles.interstitialOverlay}>
        <div class={styles.interstitialContent}>
          <button
            class={styles.interstitialClose}
            onClick={handleInterstitialClose}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>

          <div class={styles.interstitialIllustration}>
            <Icon name="gem" size={40} color="var(--color-primary)" />
          </div>

          <h2 class={styles.interstitialTitle}>{t('shop.starterPack')}</h2>
          <p class={styles.interstitialSubtitle}>{t('shop.starterPackDesc')}</p>

          <div class={styles.contentBar}>
            <div class={styles.contentItem}>
              <span class={styles.resourceEmoji}>🌫️</span>
              <span class={styles.contentValue}>600</span>
            </div>
            <div class={styles.contentItem}>
              <span class={styles.resourceEmoji}>🪙</span>
              <span class={styles.contentValue}>3,000</span>
            </div>
            <div class={styles.contentItem}>
              <Icon name="gem" size={18} color="var(--color-primary)" />
              <span class={styles.contentValue}>3x</span>
            </div>
            <div class={styles.contentItem}>
              <Icon name="trophy" size={18} color="var(--color-skill)" />
              <span class={styles.contentValue}>Badge</span>
            </div>
          </div>

          <div class={styles.interstitialPrice}>{STARTER_PACK_PRICE_PLN} PLN</div>

          <Button
            onClick={handleInterstitialBuy}
            disabled={processing}
            variant="primary"
            class={styles.interstitialBuyButton}
          >
            {processing ? t('shop.processingBtn') : t('shop.buyNow')}
          </Button>

          <button class={styles.interstitialSkip} onClick={handleInterstitialClose}>
            {t('shop.maybeLater')}
          </button>
        </div>
      </div>
    );
  };

  // Render checkout status overlay
  const renderStatusOverlay = () => {
    if (status === 'idle') return null;

    return (
      <div class={styles.statusOverlay}>
        {status === 'pending' && (
          <div class={styles.statusContent}>
            <div class={styles.spinner} />
            <p>{t('shop.processing')}</p>
          </div>
        )}
        {status === 'success' && (
          <div class={styles.statusContent}>
            <div class={styles.successIcon}>
              <Icon name="check" size={28} />
            </div>
            <p>{t('shop.purchaseSuccess')}</p>
            {lastPurchase.value && (
              <div class={styles.purchaseRewards}>
                <h4>{t('shop.youReceived')}</h4>
                {lastPurchase.value.dustGranted && lastPurchase.value.dustGranted > 0 && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardEmoji}>🌫️</span>
                    <span>+{lastPurchase.value.dustGranted} {t('shop.dust')}</span>
                  </div>
                )}
                {lastPurchase.value.goldGranted && lastPurchase.value.goldGranted > 0 && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardEmoji}>🪙</span>
                    <span>+{lastPurchase.value.goldGranted} {t('shop.gold')}</span>
                  </div>
                )}
                {lastPurchase.value.materialsGranted && Object.keys(lastPurchase.value.materialsGranted).length > 0 && (
                  <div class={styles.rewardItem}>
                    <Icon name="gem" size={24} color="var(--color-primary)" class={styles.rewardIcon} />
                    <span>{t('shop.rareMaterials', { count: Object.values(lastPurchase.value.materialsGranted).reduce((a, b) => a + b, 0) })}</span>
                  </div>
                )}
                {lastPurchase.value.cosmeticGranted && (
                  <div class={styles.rewardItem}>
                    <Icon name="trophy" size={24} color="var(--color-skill)" class={styles.rewardIcon} />
                    <span>{t('shop.founderBadge')}</span>
                  </div>
                )}
                {lastPurchase.value.heroGranted && (
                  <div class={styles.rewardItem}>
                    <Icon name="sword" size={24} color="var(--color-primary)" class={styles.rewardIcon} />
                    <span>{t('shop.heroUnlocked')}: {lastPurchase.value.heroGranted}</span>
                  </div>
                )}
              </div>
            )}
            <Button onClick={resetCheckoutStatus} variant="primary">
              {t('shop.awesome')}
            </Button>
          </div>
        )}
        {status === 'failed' && (
          <div class={styles.statusContent}>
            <div class={styles.errorIcon}>
              <Icon name="close" size={28} />
            </div>
            <p>{t('shop.purchaseFailed')}</p>
            <Button onClick={resetCheckoutStatus}>{t('shop.close')}</Button>
          </div>
        )}
      </div>
    );
  };

  // Render product detail modal
  const renderProductDetailModal = () => {
    if (!selectedProduct) return null;

    const classColors: Record<string, string> = {
      fire: '#ff4500',
      ice: '#1e90ff',
      natural: '#228b22',
      lightning: '#9932cc',
      tech: '#00f0ff',
      void: '#4b0082',
      plasma: '#00ffff',
    };

    const roleLabels: Record<string, string> = {
      dps: 'DPS',
      tank: 'TANK',
      support: 'SUPPORT',
      crowd_control: 'CC',
      assassin: 'ASSASSIN',
    };

    const isHeroOwned = selectedProduct.type === 'hero' && unlockedHeroIds.value.includes(selectedProduct.id.replace('hero_', ''));

    return (
      <div class={styles.productDetailOverlay} onClick={handleCloseProductDetail}>
        <div class={styles.productDetailModal} onClick={(e) => e.stopPropagation()}>
          <button
            class={styles.productDetailClose}
            onClick={handleCloseProductDetail}
            aria-label="Close"
          >
            <Icon name="close" size={18} />
          </button>

          {/* Product illustration */}
          <div class={styles.productDetailIllustration}>
            {selectedProduct.type === 'dust' && (
              <span class={styles.productDetailEmoji}>🌫️</span>
            )}
            {selectedProduct.type === 'hero' && (
              <div
                class={styles.productDetailHeroAvatar}
                style={{ '--hero-class-color': classColors[selectedProduct.heroClass || 'fire'] || '#8b5cf6' } as any}
              >
                <Icon
                  name={selectedProduct.heroClass === 'fire' ? 'fire' : 'frost'}
                  size={64}
                  color={classColors[selectedProduct.heroClass || 'fire'] || '#8b5cf6'}
                />
              </div>
            )}
            {selectedProduct.type === 'bundle' && (
              <Icon name="gem" size={64} color="var(--color-skill)" />
            )}
            {selectedProduct.type === 'starter_pack' && (
              <Icon name="gem" size={64} color="var(--color-primary)" />
            )}
            {selectedProduct.type === 'battle_pass' && (
              <Icon name="crown" size={64} color="var(--color-skill)" />
            )}
          </div>

          {/* Product name */}
          <h2 class={styles.productDetailTitle}>{selectedProduct.name}</h2>

          {/* Hero class/role badges */}
          {selectedProduct.type === 'hero' && (
            <div class={styles.productDetailBadges}>
              <span
                class={styles.classBadge}
                style={{ backgroundColor: classColors[selectedProduct.heroClass || 'fire'] || '#8b5cf6' }}
              >
                {(selectedProduct.heroClass || '').toUpperCase()}
              </span>
              <span class={styles.roleBadge}>
                {roleLabels[selectedProduct.heroRole || ''] || (selectedProduct.heroRole || '').toUpperCase()}
              </span>
            </div>
          )}

          {/* Description */}
          <p class={styles.productDetailDescription}>{selectedProduct.description}</p>

          {/* Contents breakdown */}
          <div class={styles.productDetailContents}>
            <h4 class={styles.productDetailContentsTitle}>{t('shop.contents')}</h4>
            <div class={styles.productDetailContentsList}>
              {selectedProduct.dustAmount && selectedProduct.dustAmount > 0 && (
                <div class={styles.productDetailContentItem}>
                  <span class={styles.resourceEmoji}>🌫️</span>
                  <span class={styles.productDetailContentValue}>
                    {selectedProduct.dustAmount.toLocaleString()} {t('shop.dust')}
                  </span>
                  {selectedProduct.bonusPercent && selectedProduct.bonusPercent > 0 && (
                    <span class={styles.productDetailBonus}>+{selectedProduct.bonusPercent}% bonus</span>
                  )}
                </div>
              )}
              {selectedProduct.goldAmount && selectedProduct.goldAmount > 0 && (
                <div class={styles.productDetailContentItem}>
                  <span class={styles.resourceEmoji}>🪙</span>
                  <span class={styles.productDetailContentValue}>
                    {selectedProduct.goldAmount.toLocaleString()} {t('shop.gold')}
                  </span>
                </div>
              )}
              {selectedProduct.randomHeroCount && selectedProduct.randomHeroCount > 0 && (
                <div class={styles.productDetailContentItem}>
                  <Icon name="sword" size={20} color="var(--color-primary)" />
                  <span class={styles.productDetailContentValue}>
                    {selectedProduct.randomHeroCount}x {t('shop.randomHero')}
                  </span>
                </div>
              )}
              {selectedProduct.randomArtifactCount && selectedProduct.randomArtifactCount > 0 && (
                <div class={styles.productDetailContentItem}>
                  <Icon name="star" size={20} color="var(--color-skill)" />
                  <span class={styles.productDetailContentValue}>
                    {selectedProduct.randomArtifactCount}x {t('shop.randomArtifact')}
                  </span>
                </div>
              )}
              {selectedProduct.type === 'starter_pack' && (
                <>
                  <div class={styles.productDetailContentItem}>
                    <Icon name="gem" size={20} color="var(--color-primary)" />
                    <span class={styles.productDetailContentValue}>3x {t('shop.rareMaterialsShort')}</span>
                  </div>
                  <div class={styles.productDetailContentItem}>
                    <Icon name="trophy" size={20} color="var(--color-skill)" />
                    <span class={styles.productDetailContentValue}>{t('shop.founderBadge')}</span>
                  </div>
                </>
              )}
              {selectedProduct.type === 'battle_pass' && (
                <>
                  <div class={styles.productDetailContentItem}>
                    <Icon name="trophy" size={20} color="var(--color-skill)" />
                    <span class={styles.productDetailContentValue}>{t('shop.premiumRewards')}</span>
                  </div>
                  <div class={styles.productDetailContentItem}>
                    <Icon name="clock" size={20} color="var(--color-text-60)" />
                    <span class={styles.productDetailContentValue}>
                      {selectedProduct.durationDays} {t('shop.days')}
                    </span>
                  </div>
                </>
              )}
              {selectedProduct.type === 'hero' && (
                <div class={styles.productDetailContentItem}>
                  <Icon name="sword" size={20} color="var(--color-primary)" />
                  <span class={styles.productDetailContentValue}>{t('shop.permanentUnlock')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Price and buy button */}
          <div class={styles.productDetailActions}>
            <div class={styles.productDetailPrice}>{selectedProduct.pricePLN} PLN</div>
            <Button
              onClick={handleBuyFromDetail}
              disabled={processing || isHeroOwned}
              variant="primary"
              class={styles.productDetailBuyButton}
            >
              {isHeroOwned ? t('shop.owned') : processing ? t('shop.processingBtn') : t('shop.buyNow')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Render product cards based on category
  const renderProducts = () => {
    switch (category) {
      case 'featured': {
        const starterPackDetail: ProductDetail = {
          type: 'starter_pack',
          id: 'starter_pack',
          name: t('shop.starterPack'),
          description: t('shop.starterPackDesc'),
          pricePLN: STARTER_PACK_PRICE_PLN,
          dustAmount: 600,
          goldAmount: 3000,
        };

        const battlePassDetail: ProductDetail = {
          type: 'battle_pass',
          id: BATTLE_PASS.id,
          name: BATTLE_PASS.name,
          description: t('shop.battlePassDesc'),
          pricePLN: BATTLE_PASS.pricePLN,
          durationDays: BATTLE_PASS.durationDays,
        };

        return (
          <>
            {/* Starter Pack */}
            {starterPackAvailable.value && (
              <div
                class={`${styles.productCard} ${styles.clickable} ${styles.tierLegendary} ${styles.featuredCard}`}
                onClick={() => handleProductClick(starterPackDetail)}
              >
                <div class={`${styles.productBadge} ${styles.badgeBestValue}`}>
                  {t('shop.bestValue')}
                </div>

                <div class={styles.productIllustration}>
                  <Icon name="gem" size={36} color="var(--color-primary)" />
                </div>

                <div class={styles.featuredContent}>
                  <h3 class={styles.productTitle}>{t('shop.starterPack')}</h3>

                  <div class={styles.contentBar}>
                    <div class={styles.contentItem}>
                      <span class={styles.resourceEmoji}>🌫️</span>
                      <span>600</span>
                    </div>
                    <div class={styles.contentItem}>
                      <span class={styles.resourceEmoji}>🪙</span>
                      <span>3,000</span>
                    </div>
                    <div class={styles.contentItem}>
                      <Icon name="gem" size={16} color="var(--color-primary)" />
                      <span>3x</span>
                    </div>
                    <div class={styles.contentItem}>
                      <Icon name="trophy" size={16} color="var(--color-skill)" />
                      <span>Badge</span>
                    </div>
                  </div>

                  <div class={styles.featuredActions}>
                    <div class={styles.productPrice}>{STARTER_PACK_PRICE_PLN} PLN</div>
                    <Button
                      onClick={(e: MouseEvent) => { e.stopPropagation(); handleBuyDust('starter_pack'); }}
                      disabled={processing}
                      variant="primary"
                      class={styles.buyButton}
                    >
                      {processing ? t('shop.processingBtn') : t('shop.buyNow')}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Battle Pass */}
            <div
              class={`${styles.productCard} ${styles.clickable} ${styles.tierLegendary} ${styles.featuredCard}`}
              onClick={() => handleProductClick(battlePassDetail)}
            >
              <div class={`${styles.productBadge} ${styles.badgeSeason}`}>SEZON 1</div>

              <div class={styles.productIllustration}>
                <Icon name="crown" size={36} color="var(--color-skill)" />
              </div>

              <div class={styles.featuredContent}>
                <h3 class={styles.productTitle}>{BATTLE_PASS.name}</h3>

                <div class={styles.contentBar}>
                  <div class={styles.contentItem}>
                    <Icon name="trophy" size={18} color="var(--color-skill)" />
                    <span>Premium</span>
                  </div>
                  <div class={styles.contentItem}>
                    <Icon name="star" size={18} color="var(--color-gold)" />
                    <span>Exclusive</span>
                  </div>
                  <div class={styles.contentItem}>
                    <Icon name="clock" size={18} color="var(--color-text-60)" />
                    <span>{BATTLE_PASS.durationDays}d</span>
                  </div>
                </div>

                <div class={styles.featuredActions}>
                  <div class={styles.productPrice}>{BATTLE_PASS.pricePLN} PLN</div>
                  <Button
                    onClick={(e: MouseEvent) => { e.stopPropagation(); handleBuyDust(BATTLE_PASS.id); }}
                    disabled={processing}
                    variant="primary"
                    class={styles.buyButton}
                  >
                    {processing ? t('shop.processingBtn') : t('shop.buyNow')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        );
      }

      case 'heroes':
        return (
          <>
            {PREMIUM_HEROES.map((hero) => {
              const isOwned = unlockedHeroIds.value.includes(hero.heroId);
              const classColors: Record<string, string> = {
                fire: '#ff4500',
                ice: '#1e90ff',
              };
              const roleLabels: Record<string, string> = {
                dps: 'DPS',
                tank: 'TANK',
                support: 'SUPPORT',
                crowd_control: 'CC',
                assassin: 'ASSASSIN',
              };

              const productDetail: ProductDetail = {
                type: 'hero',
                id: hero.id,
                name: hero.name,
                description: hero.description,
                pricePLN: hero.pricePLN,
                heroClass: hero.class,
                heroRole: hero.role,
              };

              return (
                <div
                  key={hero.id}
                  class={`${styles.productCard} ${styles.clickable} ${styles.tierPremium} ${styles.heroProduct} ${isOwned ? styles.owned : ''}`}
                  onClick={() => handleProductClick(productDetail)}
                >
                  <div class={`${styles.productBadge} ${styles.badgePremium}`}>
                    {t('shop.premium')}
                  </div>

                  <div
                    class={styles.heroAvatar}
                    style={{ '--hero-class-color': classColors[hero.class] || '#8b5cf6' } as any}
                  >
                    <Icon
                      name={hero.class === 'fire' ? 'fire' : 'frost'}
                      size={40}
                      color={classColors[hero.class] || '#8b5cf6'}
                    />
                  </div>

                  <h3 class={styles.productTitle}>{hero.name}</h3>

                  <div class={styles.heroClassBadges}>
                    <span
                      class={styles.classBadge}
                      style={{ backgroundColor: classColors[hero.class] || '#8b5cf6' }}
                    >
                      {hero.class.toUpperCase()}
                    </span>
                    <span class={styles.roleBadge}>
                      {roleLabels[hero.role] || hero.role.toUpperCase()}
                    </span>
                  </div>

                  <p class={styles.heroDescription}>{hero.description}</p>

                  <div class={styles.productPrice}>{hero.pricePLN} PLN</div>

                  <Button
                    onClick={(e: MouseEvent) => { e.stopPropagation(); handleBuyDust(hero.id); }}
                    disabled={processing || isOwned}
                    variant="primary"
                    class={styles.buyButton}
                  >
                    {isOwned ? t('shop.owned') : t('shop.buyNow')}
                  </Button>
                </div>
              );
            })}
            {PREMIUM_HEROES.every((h) => unlockedHeroIds.value.includes(h.heroId)) && (
              <div class={styles.emptyMessage}>
                {t('shop.allHeroesOwned')}
              </div>
            )}
          </>
        );

      case 'dust':
        return DUST_PACKAGES_PLN.map((pkg) => {
          const savings = DUST_SAVINGS[pkg.id] || 0;
          const isBestValue = pkg.id === 'dust_mega';

          const productDetail: ProductDetail = {
            type: 'dust',
            id: pkg.id,
            name: `${pkg.dustAmount.toLocaleString()} ${t('shop.dust')}`,
            description: t('shop.dustDescription'),
            pricePLN: pkg.pricePLN,
            dustAmount: pkg.dustAmount,
            bonusPercent: savings,
          };

          return (
            <div
              key={pkg.id}
              class={`${styles.productCard} ${styles.clickable} ${isBestValue ? styles.tierEpic : styles.tierStandard} ${styles.dustProduct}`}
              onClick={() => handleProductClick(productDetail)}
            >
              {isBestValue && (
                <div class={`${styles.productBadge} ${styles.badgeBestValue}`}>
                  {t('shop.bestValue')}
                </div>
              )}
              {savings > 0 && !isBestValue && (
                <div class={`${styles.productBadge} ${styles.badgeSavings}`}>
                  -{savings}%
                </div>
              )}

              <div class={styles.productIllustration}>
                <span class={styles.productEmoji}>🌫️</span>
              </div>

              <h3 class={styles.productTitle}>
                {pkg.dustAmount.toLocaleString()} {t('shop.dust')}
              </h3>

              {savings > 0 && (
                <div class={styles.savingsText}>
                  {t('shop.save')} {savings}%
                </div>
              )}

              <div class={styles.productPrice}>{pkg.pricePLN} PLN</div>

              <Button
                onClick={(e: MouseEvent) => { e.stopPropagation(); handleBuyDust(pkg.id); }}
                disabled={processing}
                variant="primary"
                size="sm"
                class={styles.buyButton}
              >
                {t('shop.buy')}
              </Button>
            </div>
          );
        });

      case 'bundles':
        return BUNDLES.map((bundle) => {
          const productDetail: ProductDetail = {
            type: 'bundle',
            id: bundle.id,
            name: bundle.name,
            description: t('shop.bundleDescription'),
            pricePLN: bundle.pricePLN,
            dustAmount: bundle.dustAmount,
            goldAmount: bundle.goldAmount,
            randomHeroCount: bundle.randomHeroCount,
            randomArtifactCount: bundle.randomArtifactCount,
          };

          return (
            <div
              key={bundle.id}
              class={`${styles.productCard} ${styles.clickable} ${styles.tierEpic}`}
              onClick={() => handleProductClick(productDetail)}
            >
              {bundle.badgeText && (
                <div class={`${styles.productBadge} ${styles.badgeBestValue}`}>
                  {bundle.badgeText}
                </div>
              )}

              <div class={styles.productIllustration}>
                <Icon name="gem" size={40} color="var(--color-skill)" />
              </div>

              <h3 class={styles.productTitle}>{bundle.name}</h3>

              <div class={styles.contentBar}>
                <div class={styles.contentItem}>
                  <span class={styles.resourceEmoji}>🌫️</span>
                  <span>{bundle.dustAmount}</span>
                </div>
                <div class={styles.contentItem}>
                  <span class={styles.resourceEmoji}>🪙</span>
                  <span>{bundle.goldAmount.toLocaleString()}</span>
                </div>
                {bundle.randomHeroCount > 0 && (
                  <div class={styles.contentItem}>
                    <Icon name="sword" size={16} color="var(--color-primary)" />
                    <span>{bundle.randomHeroCount}x</span>
                  </div>
                )}
                {bundle.randomArtifactCount > 0 && (
                  <div class={styles.contentItem}>
                    <Icon name="star" size={16} color="var(--color-skill)" />
                    <span>{bundle.randomArtifactCount}x</span>
                  </div>
                )}
              </div>

              <div class={styles.productPrice}>{bundle.pricePLN} PLN</div>

              <Button
                onClick={(e: MouseEvent) => { e.stopPropagation(); handleBuyDust(bundle.id); }}
                disabled={processing}
                variant="primary"
                class={styles.buyButton}
              >
                {processing ? t('shop.processingBtn') : t('shop.buyNow')}
              </Button>
            </div>
          );
        });

      default:
        return null;
    }
  };

  return (
    <div class={styles.shopContainer}>
      {renderInterstitialOffer()}
      {renderStatusOverlay()}
      {renderProductDetailModal()}

      {/* Top Header Bar */}
      <header class={styles.shopHeader}>
        <div class={styles.headerLeft}>
          <button class={styles.backButton} onClick={handleBack}>
            <Icon name="close" size={16} />
            {t('buttons.back')}
          </button>
          <h1 class={styles.shopTitle}>{t('shop.title')}</h1>
        </div>

        <div class={styles.headerBalance}>
          <div class={styles.balance}>
            <span class={styles.balanceIcon}>🌫️</span>
            <span class={styles.balanceValue}>{dust}</span>
            <span class={styles.balanceLabel}>{t('shop.dust')}</span>
          </div>
          <div class={styles.balance}>
            <span class={styles.balanceIcon}>🪙</span>
            <span class={styles.balanceValue}>{gold}</span>
            <span class={styles.balanceLabel}>{t('shop.gold')}</span>
          </div>
        </div>
      </header>

      {/* Main Layout: Sidebar + Content */}
      <div class={styles.shopMain}>
        {/* Vertical Sidebar Navigation (WoT-style) */}
        <nav class={styles.sidebar}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              class={`${styles.sidebarTab} ${category === cat.id ? styles.active : ''}`}
              onClick={() => selectCategory(cat.id)}
              title={t(cat.labelKey)}
            >
              <Icon
                name={cat.icon}
                size={24}
                class={styles.sidebarIcon}
                color={category === cat.id ? 'var(--color-primary)' : 'currentColor'}
              />
              <span class={styles.sidebarLabel}>{t(cat.labelKey)}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div class={styles.shopContent}>
          {/* Category Header */}
          <div class={styles.categoryHeader}>
            <h2 class={styles.categoryTitle}>
              {currentCategory && (
                <Icon
                  name={currentCategory.icon}
                  size={22}
                  color="var(--color-primary)"
                />
              )}
              {currentCategory ? t(currentCategory.labelKey) : ''}
            </h2>
          </div>

          {/* Error display */}
          {error && <div class={styles.error}>{error}</div>}

          {/* Products grid */}
          <div class={styles.productsGrid}>
            {renderProducts()}
          </div>
        </div>
      </div>
    </div>
  );
}
