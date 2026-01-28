import { BOSS_RUSH_SHOP_ITEMS, type BossRushShopItem } from '@arcade/sim-core';
import {
  showBossRushShop,
  closeBossRushShop,
  bossRushAvailableGold,
  purchaseBossRushShopItem,
  bossRushShopPurchases,
  formatDamage,
} from '../../state/index.js';
import { Button } from '../shared/Button.js';
import { GoldIcon } from '../icons/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './BossRushShopPanel.module.css';

/** Item type icons */
const TYPE_ICONS: Record<string, string> = {
  heal: '💚',
  reroll: '🎲',
  stat_boost: '⚡',
};

/** Get item description based on type */
function getItemDescription(item: BossRushShopItem, t: (key: string, params?: Record<string, unknown>) => string): string {
  switch (item.type) {
    case 'heal':
      return t('bossRush.shop.items.healPercent', { percent: Math.round((item.effect.healPercent || 0) * 100) });
    case 'reroll':
      return t('bossRush.shop.items.reroll');
    case 'stat_boost':
      if (item.effect.statBonus) {
        const { stat, value } = item.effect.statBonus;
        const percent = Math.round(value * 100);
        const statKey = stat === 'damageBonus' ? 'damage' : stat === 'attackSpeedBonus' ? 'attackSpeed' : 'critChance';
        const statName = t(`bossRush.shop.items.${statKey}`);
        return t('bossRush.shop.items.statBoost', { percent, stat: statName });
      }
      return t('bossRush.shop.items.boostStats');
    default:
      return '';
  }
}

interface ShopItemProps {
  item: BossRushShopItem;
  onPurchase: (item: BossRushShopItem) => void;
  disabled: boolean;
  purchaseCount: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}

function ShopItem({ item, onPurchase, disabled, purchaseCount, t }: ShopItemProps) {
  const icon = TYPE_ICONS[item.type] || '📦';
  const description = getItemDescription(item, t);
  const canAfford = bossRushAvailableGold.value >= item.cost;

  return (
    <button
      type="button"
      class={`${styles.shopItem} ${disabled || !canAfford ? styles.disabled : ''}`}
      onClick={() => !disabled && canAfford && onPurchase(item)}
      disabled={disabled || !canAfford}
    >
      <div class={styles.itemIcon}>{icon}</div>
      <div class={styles.itemInfo}>
        <span class={styles.itemName}>{item.name}</span>
        <span class={styles.itemDescription}>{description}</span>
      </div>
      <div class={styles.itemCost}>
        <span class={`${styles.cost} ${!canAfford ? styles.cantAfford : ''}`}>
          {item.cost}
        </span>
        <GoldIcon size={18} className={styles.goldIcon} />
      </div>
      {purchaseCount > 0 && (
        <div class={styles.purchaseCount}>x{purchaseCount}</div>
      )}
    </button>
  );
}

export interface BossRushShopPanelProps {
  onRerollRelics?: () => void;
  onHealFortress?: (healPercent: number) => void;
}

export function BossRushShopPanel({ onRerollRelics, onHealFortress }: BossRushShopPanelProps) {
  const { t } = useTranslation('game');

  if (!showBossRushShop.value) {
    return null;
  }

  const availableGold = bossRushAvailableGold.value;
  const purchases = bossRushShopPurchases.value;

  const handlePurchase = (item: BossRushShopItem) => {
    let healAmount: number | undefined;
    let statBonus: { stat: 'damageBonus' | 'attackSpeedBonus' | 'critChance'; value: number } | undefined;

    if (item.type === 'heal' && item.effect.healPercent) {
      healAmount = item.effect.healPercent;
    }

    if (item.type === 'stat_boost' && item.effect.statBonus) {
      statBonus = item.effect.statBonus as typeof statBonus;
    }

    const success = purchaseBossRushShopItem(item.id, item.cost, healAmount, statBonus);

    if (success) {
      if (item.type === 'reroll' && onRerollRelics) {
        onRerollRelics();
      }
      if (item.type === 'heal' && item.effect.healPercent && onHealFortress) {
        onHealFortress(item.effect.healPercent);
      }
    }
  };

  // Group items by type
  const healItems = BOSS_RUSH_SHOP_ITEMS.filter(i => i.type === 'heal');
  const statItems = BOSS_RUSH_SHOP_ITEMS.filter(i => i.type === 'stat_boost');
  const utilityItems = BOSS_RUSH_SHOP_ITEMS.filter(i => i.type === 'reroll');

  return (
    <div class={styles.panel}>
      <div class={styles.header}>
        <h3 class={styles.title}>🏪 {t('bossRush.shop.title')}</h3>
        <div class={styles.gold}>
          <GoldIcon size={18} className={styles.goldIcon} />
          <span class={styles.goldAmount}>{formatDamage(availableGold)}</span>
        </div>
        <button
          type="button"
          class={styles.closeButton}
          onClick={closeBossRushShop}
          aria-label={t('bossRush.shop.closeAriaLabel')}
        >
          ✕
        </button>
      </div>

      <div class={styles.content}>
        {/* Healing Section */}
        <div class={styles.section}>
          <h4 class={styles.sectionTitle}>💚 {t('bossRush.shop.sections.healing')}</h4>
          <div class={styles.itemGrid}>
            {healItems.map(item => (
              <ShopItem
                key={item.id}
                item={item}
                onPurchase={handlePurchase}
                disabled={false}
                purchaseCount={purchases[item.id] || 0}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* Stat Boosts Section */}
        <div class={styles.section}>
          <h4 class={styles.sectionTitle}>⚡ {t('bossRush.shop.sections.powerUps')}</h4>
          <div class={styles.itemGrid}>
            {statItems.map(item => (
              <ShopItem
                key={item.id}
                item={item}
                onPurchase={handlePurchase}
                disabled={false}
                purchaseCount={purchases[item.id] || 0}
                t={t}
              />
            ))}
          </div>
        </div>

        {/* Utility Section */}
        <div class={styles.section}>
          <h4 class={styles.sectionTitle}>🎲 {t('bossRush.shop.sections.utility')}</h4>
          <div class={styles.itemGrid}>
            {utilityItems.map(item => (
              <ShopItem
                key={item.id}
                item={item}
                onPurchase={handlePurchase}
                disabled={false}
                purchaseCount={purchases[item.id] || 0}
                t={t}
              />
            ))}
          </div>
        </div>
      </div>

      <div class={styles.footer}>
        <Button variant="secondary" size="sm" onClick={closeBossRushShop}>
          {t('bossRush.shop.close')}
        </Button>
      </div>
    </div>
  );
}
