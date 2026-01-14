/**
 * Shop Modal (MVP - Simplified)
 *
 * Display shop products and handle purchases.
 * MVP: Only Starter Pack (19.99 PLN) + 2 Dust packages.
 */

import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import { audioManager } from '../../game/AudioManager.js';
import {
  DUST_PACKAGES_PLN,
  STARTER_PACK_PRICE_PLN,
  PREMIUM_HEROES,
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
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import styles from './ShopModal.module.css';

// Category tab config
const CATEGORIES: { id: ShopCategory; labelKey: string; icon: string }[] = [
  { id: 'featured', labelKey: 'shop.categories.featured', icon: '🌟' },
  { id: 'heroes', labelKey: 'shop.categories.heroes', icon: '⚔️' },
  { id: 'dust', labelKey: 'shop.categories.dust', icon: '✨' },
];

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

  // Load shop data when modal opens
  useEffect(() => {
    if (isVisible && !data) {
      loadShop();
    }
  }, [isVisible, data]);

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

  // Render loading state
  if (loading) {
    return (
      <Modal
        visible={isVisible}
        title={t('shop.title')}
        onClose={hideShopModal}
        size="large"
        ariaLabel="Shop"
      >
        <div class={styles.loading}>{t('shop.loading')}</div>
      </Modal>
    );
  }

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
            <div class={styles.successIcon}>✓</div>
            <p>{t('shop.purchaseSuccess')}</p>
            {lastPurchase.value && (
              <div class={styles.purchaseRewards}>
                <h4>{t('shop.youReceived')}</h4>
                {lastPurchase.value.dustGranted && lastPurchase.value.dustGranted > 0 && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardIcon}>✨</span>
                    <span>+{lastPurchase.value.dustGranted} {t('shop.dust')}</span>
                  </div>
                )}
                {lastPurchase.value.goldGranted && lastPurchase.value.goldGranted > 0 && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardIcon}>🪙</span>
                    <span>+{lastPurchase.value.goldGranted} {t('shop.gold')}</span>
                  </div>
                )}
                {lastPurchase.value.materialsGranted && Object.keys(lastPurchase.value.materialsGranted).length > 0 && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardIcon}>📦</span>
                    <span>{t('shop.rareMaterials', { count: Object.values(lastPurchase.value.materialsGranted).reduce((a, b) => a + b, 0) })}</span>
                  </div>
                )}
                {lastPurchase.value.cosmeticGranted && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardIcon}>🏆</span>
                    <span>{t('shop.founderBadge')}</span>
                  </div>
                )}
                {lastPurchase.value.heroGranted && (
                  <div class={styles.rewardItem}>
                    <span class={styles.rewardIcon}>⚔️</span>
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
            <div class={styles.errorIcon}>✕</div>
            <p>{t('shop.purchaseFailed')}</p>
            <Button onClick={resetCheckoutStatus}>{t('shop.close')}</Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      visible={isVisible}
      title={t('shop.title')}
      onClose={hideShopModal}
      size="large"
      ariaLabel="Shop"
    >
      {renderStatusOverlay()}

      {/* User balance header */}
      <div class={styles.balanceHeader}>
        <div class={styles.balance}>
          <span class={styles.balanceIcon}>✨</span>
          <span class={styles.balanceValue}>{dust}</span>
          <span class={styles.balanceLabel}>{t('shop.dust')}</span>
        </div>
        <div class={styles.balance}>
          <span class={styles.balanceIcon}>🪙</span>
          <span class={styles.balanceValue}>{gold}</span>
          <span class={styles.balanceLabel}>{t('shop.gold')}</span>
        </div>
      </div>

      {/* Category tabs */}
      <div class={styles.categoryTabs}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            class={`${styles.categoryTab} ${category === cat.id ? styles.active : ''}`}
            onClick={() => selectCategory(cat.id)}
          >
            <span class={styles.categoryIcon}>{cat.icon}</span>
            <span class={styles.categoryLabel}>{t(cat.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Error display */}
      {error && <div class={styles.error}>{error}</div>}

      {/* Products grid */}
      <div class={styles.productsGrid}>
        {/* Featured: Starter Pack */}
        {category === 'featured' && starterPackAvailable.value && (
          <div class={styles.featuredProduct}>
            <div class={styles.productBadge}>{t('shop.bestValue')}</div>
            <h3 class={styles.productTitle}>{t('shop.starterPack')}</h3>
            <div class={styles.productContents}>
              <div>✨ 600 {t('shop.dust')}</div>
              <div>🪙 3,000 {t('shop.gold')}</div>
              <div>📦 {t('shop.starterPackMaterials')}</div>
              <div>🏆 {t('shop.founderBadge')}</div>
            </div>
            <div class={styles.productPrice}>{STARTER_PACK_PRICE_PLN} PLN</div>
            <Button
              onClick={() => handleBuyDust('starter_pack')}
              disabled={processing}
              variant="primary"
              class={styles.buyButton}
            >
              {processing ? t('shop.processingBtn') : t('shop.buyNow')}
            </Button>
          </div>
        )}

        {category === 'featured' && !starterPackAvailable.value && (
          <div class={styles.emptyMessage}>
            {t('shop.starterPackPurchased')}
          </div>
        )}

        {/* Premium Heroes */}
        {category === 'heroes' && (
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

              return (
                <div
                  key={hero.id}
                  class={`${styles.heroProduct} ${isOwned ? styles.owned : ''}`}
                >
                  <div class={styles.productBadge}>{t('shop.premium')}</div>
                  <div
                    class={styles.heroAvatar}
                    style={{ borderColor: classColors[hero.class] || '#8b5cf6' }}
                  >
                    <span class={styles.heroIcon}>
                      {hero.class === 'fire' ? '🔥' : '❄️'}
                    </span>
                  </div>
                  <h3 class={styles.productTitle}>{hero.name}</h3>
                  <div class={styles.heroClass}>
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
                    onClick={() => handleBuyDust(hero.id)}
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
        )}

        {/* Dust packages */}
        {category === 'dust' &&
          DUST_PACKAGES_PLN.map((pkg) => {
            const pricePerHundred = ((pkg.pricePLN / pkg.dustAmount) * 100).toFixed(2);
            // Mega has best PLN/dust ratio
            const isBestValue = pkg.id === 'dust_mega';

            return (
              <div key={pkg.id} class={styles.product}>
                {isBestValue && (
                  <div class={styles.productBadge}>{t('shop.bestValue')}</div>
                )}
                <h3 class={styles.productTitle}>✨ {pkg.dustAmount} {t('shop.dust')}</h3>
                <div class={styles.pricePerUnit}>{pricePerHundred} PLN / 100 {t('shop.dust').toLowerCase()}</div>
                <div class={styles.productPrice}>{pkg.pricePLN} PLN</div>
                <Button
                  onClick={() => handleBuyDust(pkg.id)}
                  disabled={processing}
                  variant="primary"
                  size="sm"
                  class={styles.buyButton}
                >
                  {t('shop.buy')}
                </Button>
              </div>
            );
          })}

      </div>
    </Modal>
  );
}
