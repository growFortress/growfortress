/**
 * Auto-Play Hook
 *
 * Handles automated gameplay decisions:
 * - Auto-selecting relics during Boss Rush intermissions
 * - Auto-purchasing shop items
 * - Speed control
 */

import { useEffect, useCallback, useRef } from 'preact/hooks';
import {
  selectBestRelic,
  selectBestShopItem,
  type AutoPlayConfig,
} from '@arcade/sim-core';
import {
  autoPlaySettings,
  speedSettings,
} from '../state/settings.signals.js';
import {
  bossRushActive,
  bossRushIntermission,
  bossRushRelicOptions,
  bossRushRelicChosen,
  bossRushCollectedRelics,
  bossRushAvailableGold,
  bossRushGoldEarned,
  bossRushGoldSpent,
  bossRushShopStatBoosts,
  purchaseBossRushShopItem as purchaseShopItem,
} from '../state/boss-rush.signals.js';
import { fortressHp, fortressMaxHp } from '../state/game.signals.js';

interface UseAutoPlayOptions {
  /** Function to choose a relic by index */
  chooseRelicByIndex: (index: number) => void;
  /** Function to heal fortress */
  healFortress: (healPercent: number) => void;
  /** Function to reroll relics */
  rerollRelics: () => void;
}

interface UseAutoPlayReturn {
  /** Whether auto-play is currently enabled */
  isEnabled: boolean;
  /** Current speed multiplier */
  speedMultiplier: number;
  /** Manually trigger auto-play decisions */
  triggerAutoDecisions: () => void;
}

/**
 * Build AutoPlayConfig from settings signals
 */
function buildAutoPlayConfig(): AutoPlayConfig {
  const settings = autoPlaySettings.value;
  return {
    enabled: settings.enabled,
    relicPriority: settings.relicPriority,
    shopPriority: settings.shopPriority,
    skillActivation: settings.skillActivation,
    healThreshold: settings.healThreshold,
    relicCategoryOrder: [
      'build_defining',
      'synergy',
      'class',
      'standard',
      'economy',
      'pillar',
      'cursed',
    ],
  };
}

/**
 * Build a minimal BossRushState for auto-play decisions
 */
function buildBossRushState() {
  return {
    inIntermission: bossRushIntermission.value,
    relicOptions: bossRushRelicOptions.value,
    relicChosen: bossRushRelicChosen.value,
    collectedRelics: bossRushCollectedRelics.value,
    goldEarned: bossRushGoldEarned.value,
    goldSpent: bossRushGoldSpent.value,
    shopStatBoosts: bossRushShopStatBoosts.value,
    rerollsUsed: 0,
    shopPurchases: {},
  };
}

export function useAutoPlay(options: UseAutoPlayOptions): UseAutoPlayReturn {
  const { chooseRelicByIndex, healFortress, rerollRelics } = options;
  const processingRef = useRef(false);
  const lastProcessedRef = useRef<number>(0);

  const triggerAutoDecisions = useCallback(() => {
    // Prevent multiple simultaneous processing
    if (processingRef.current) return;

    const config = buildAutoPlayConfig();
    if (!config.enabled) return;

    // Only process during Boss Rush intermission
    if (!bossRushActive.value || !bossRushIntermission.value) return;

    // Throttle to prevent rapid decisions
    const now = Date.now();
    if (now - lastProcessedRef.current < 500) return;
    lastProcessedRef.current = now;

    processingRef.current = true;

    try {
      const state = buildBossRushState();
      const hpPercent = fortressMaxHp.value > 0 ? fortressHp.value / fortressMaxHp.value : 1;

      // 1. Choose relic if available and not chosen
      if (state.relicOptions.length > 0 && !state.relicChosen) {
        const bestRelic = selectBestRelic(
          state.relicOptions,
          config,
          state.collectedRelics
        );
        if (bestRelic) {
          // Find index of the best relic in options
          const relicIndex = state.relicOptions.indexOf(bestRelic);
          if (relicIndex !== -1) {
            chooseRelicByIndex(relicIndex);
          }
        }
      }

      // 2. Consider shop purchases
      const availableGold = bossRushAvailableGold.value;
      if (availableGold > 0) {
        const bossRushStateForShop = {
          ...state,
          shopPurchases: {},
          rerollsUsed: 0,
        } as any;

        const shopItem = selectBestShopItem(bossRushStateForShop, hpPercent, config);
        if (shopItem) {
          // Process the purchase
          let healAmount: number | undefined;
          let statBonus: { stat: 'damageBonus' | 'attackSpeedBonus' | 'critChance'; value: number } | undefined;

          if (shopItem.type === 'heal' && shopItem.effect.healPercent) {
            healAmount = shopItem.effect.healPercent;
          }

          if (shopItem.type === 'stat_boost' && shopItem.effect.statBonus) {
            statBonus = shopItem.effect.statBonus as typeof statBonus;
          }

          const success = purchaseShopItem(shopItem.id, shopItem.cost, healAmount, statBonus);

          if (success) {
            if (shopItem.type === 'heal' && shopItem.effect.healPercent) {
              healFortress(shopItem.effect.healPercent);
            }
            if (shopItem.type === 'reroll') {
              rerollRelics();
            }
          }
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [chooseRelicByIndex, healFortress, rerollRelics]);

  // Auto-trigger decisions when intermission state changes
  useEffect(() => {
    if (!autoPlaySettings.value.enabled) return;
    if (!bossRushActive.value || !bossRushIntermission.value) return;

    // Small delay to let UI update first
    const timer = setTimeout(() => {
      triggerAutoDecisions();
    }, 300);

    return () => clearTimeout(timer);
  }, [
    bossRushIntermission.value,
    bossRushRelicOptions.value,
    triggerAutoDecisions,
  ]);

  // Periodically check for decisions during intermission
  useEffect(() => {
    if (!autoPlaySettings.value.enabled) return;
    if (!bossRushActive.value || !bossRushIntermission.value) return;

    const interval = setInterval(() => {
      triggerAutoDecisions();
    }, 1000);

    return () => clearInterval(interval);
  }, [
    bossRushActive.value,
    bossRushIntermission.value,
    triggerAutoDecisions,
  ]);

  return {
    isEnabled: autoPlaySettings.value.enabled,
    speedMultiplier: speedSettings.value.speedMultiplier,
    triggerAutoDecisions,
  };
}

/**
 * Get auto-play status text for UI display
 */
export function getAutoPlayStatusText(): string {
  const settings = autoPlaySettings.value;
  if (!settings.enabled) return 'Auto-Play: OFF';

  const priority = settings.relicPriority.charAt(0).toUpperCase() + settings.relicPriority.slice(1);
  return `Auto-Play: ${priority}`;
}

/**
 * Get speed status text for UI display
 */
export function getSpeedStatusText(): string {
  const speed = speedSettings.value.speedMultiplier;
  return speed === 1 ? '1x' : `${speed}x`;
}
