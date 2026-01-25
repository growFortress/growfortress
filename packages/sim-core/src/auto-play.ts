/**
 * Auto-Play System
 *
 * AI decision-making for automated gameplay:
 * - Relic selection during intermissions
 * - Shop purchases in Boss Rush mode
 * - Skill activation timing (future)
 *
 * Key principle: Auto-play produces the same event stream as manual play.
 * Server verification works identically for both.
 */

import type { ModifierSet, GameState } from './types.js';
import type { ExtendedRelicDef, RelicCategory } from './data/relics.js';
import { getRelicById } from './data/relics.js';
import type { BossRushState, BossRushShopItem } from './boss-rush.js';
import { BOSS_RUSH_SHOP_ITEMS, getAvailableGold } from './boss-rush.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

export type AutoPlayRelicPriority = 'damage' | 'defense' | 'gold' | 'balanced';
export type AutoPlayShopPriority = 'heal_first' | 'damage_first' | 'balanced';
export type AutoPlaySkillMode = 'on_cooldown' | 'save_for_emergencies' | 'manual';

export interface AutoPlayConfig {
  /** Whether auto-play is enabled */
  enabled: boolean;

  /** Priority for relic selection */
  relicPriority: AutoPlayRelicPriority;

  /** Priority for shop purchases */
  shopPriority: AutoPlayShopPriority;

  /** When to activate fortress skills */
  skillActivation: AutoPlaySkillMode;

  /** Minimum HP percentage before buying heals (0-1) */
  healThreshold: number;

  /** Category preference order for relic selection */
  relicCategoryOrder: RelicCategory[];
}

export const DEFAULT_AUTO_PLAY_CONFIG: AutoPlayConfig = {
  enabled: false,
  relicPriority: 'balanced',
  shopPriority: 'balanced',
  skillActivation: 'on_cooldown',
  healThreshold: 0.5,
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

// ============================================================================
// RELIC SELECTION
// ============================================================================

/**
 * Weights for different modifier types based on priority
 */
const MODIFIER_WEIGHTS: Record<AutoPlayRelicPriority, Partial<Record<keyof ModifierSet, number>>> = {
  damage: {
    damageBonus: 100,
    attackSpeedBonus: 80,
    critChance: 70,
    critDamageBonus: 60,
    eliteDamageBonus: 50,
    chainChance: 40,
    chainCount: 35,
    splashDamagePercent: 30,
    pierceCount: 25,
    executeThreshold: 20,
  },
  defense: {
    maxHpBonus: 100,
    incomingDamageReduction: 90,
    hpRegen: 80,
    lifesteal: 70,
    reflectDamage: 50,
    knockbackResistance: 40,
    ccResistance: 35,
    massBonus: 30,
  },
  gold: {
    goldBonus: 100,
    goldFindBonus: 90,
    dustBonus: 80,
    dropRateBonus: 70,
    relicQualityBonus: 60,
  },
  balanced: {
    damageBonus: 50,
    attackSpeedBonus: 45,
    critChance: 40,
    maxHpBonus: 50,
    incomingDamageReduction: 45,
    goldBonus: 30,
    lifesteal: 35,
    chainChance: 25,
    splashDamagePercent: 20,
  },
};

/**
 * Rarity score bonuses
 */
const RARITY_SCORES: Record<string, number> = {
  legendary: 50,
  epic: 30,
  rare: 15,
  common: 0,
};

/**
 * Category score bonuses (higher = more preferred)
 */
const CATEGORY_SCORES: Record<RelicCategory, number> = {
  build_defining: 100,
  synergy: 60,
  class: 50,
  standard: 40,
  economy: 30,
  pillar: 25,
  support: 20,
  cursed: -20,
};

/**
 * Calculate a score for a relic based on the auto-play priority
 */
export function scoreRelic(
  relicId: string,
  priority: AutoPlayRelicPriority,
  _collectedRelics: string[] = []
): number {
  const relic = getRelicById(relicId) as ExtendedRelicDef | undefined;
  if (!relic) return 0;

  let score = 0;
  const weights = MODIFIER_WEIGHTS[priority];

  // Score based on modifier values
  if (relic.modifiers) {
    for (const [key, weight] of Object.entries(weights)) {
      const value = relic.modifiers[key as keyof ModifierSet];
      if (typeof value === 'number' && value !== 0) {
        // Normalize the value (most bonuses are 0.1-0.5 range)
        const normalizedValue = Math.abs(value) * 100;
        score += normalizedValue * (weight || 0);
      }
    }
  }

  // Add rarity bonus
  score += RARITY_SCORES[relic.rarity] || 0;

  // Add category bonus
  score += CATEGORY_SCORES[relic.category] || 0;

  // Penalize cursed relics unless specifically wanted
  if (relic.curse) {
    score -= 50;
  }

  // Bonus for build-defining relics
  if (relic.isBuildDefining) {
    score += 75;
  }

  return Math.max(0, score);
}

/**
 * Select the best relic from available options
 */
export function selectBestRelic(
  options: string[],
  config: AutoPlayConfig,
  collectedRelics: string[] = []
): string | null {
  if (options.length === 0) return null;
  if (options.length === 1) return options[0];

  let bestRelic: string | null = null;
  let bestScore = -Infinity;

  for (const relicId of options) {
    const score = scoreRelic(relicId, config.relicPriority, collectedRelics);
    if (score > bestScore) {
      bestScore = score;
      bestRelic = relicId;
    }
  }

  return bestRelic;
}

// ============================================================================
// SHOP PURCHASES
// ============================================================================

/**
 * Score a shop item based on current state and priority
 */
export function scoreShopItem(
  item: BossRushShopItem,
  state: BossRushState,
  fortressHpPercent: number,
  config: AutoPlayConfig
): number {
  const availableGold = getAvailableGold(state);

  // Can't afford it
  if (availableGold < item.cost) {
    return -1;
  }

  let score = 0;

  switch (item.type) {
    case 'heal': {
      // Score heals based on how low HP is
      const hpDeficit = 1 - fortressHpPercent;
      const healAmount = item.effect.healPercent || 0;

      // Only valuable if we need healing
      if (fortressHpPercent >= 0.9) {
        score = -1; // Don't heal at high HP
      } else if (fortressHpPercent < config.healThreshold) {
        // Urgently need healing
        score = 200 + hpDeficit * 100;

        // Prefer larger heals when very low
        if (fortressHpPercent < 0.3) {
          score += healAmount * 200;
        }
      } else {
        // Nice to have
        score = 50 + hpDeficit * 50;
      }

      // Priority boost
      if (config.shopPriority === 'heal_first') {
        score += 100;
      }
      break;
    }

    case 'stat_boost': {
      const stat = item.effect.statBonus?.stat;
      const value = item.effect.statBonus?.value || 0;

      if (stat === 'damageBonus') {
        score = 80 + value * 500;
        if (config.shopPriority === 'damage_first') {
          score += 100;
        }
      } else if (stat === 'attackSpeedBonus') {
        score = 70 + value * 400;
        if (config.shopPriority === 'damage_first') {
          score += 50;
        }
      } else if (stat === 'critChance') {
        score = 60 + value * 800;
      }

      // Value decreases over time (diminishing returns)
      const existingBoost = state.shopStatBoosts[stat as keyof typeof state.shopStatBoosts] || 0;
      score -= existingBoost * 100;
      break;
    }

    case 'reroll': {
      // Only valuable if we haven't chosen a relic yet
      if (state.relicChosen) {
        score = -1;
      } else {
        // Moderate priority - might get better options
        score = 30;
        // Less valuable as we use more rerolls
        score -= state.rerollsUsed * 15;
      }
      break;
    }

    default:
      score = 0;
  }

  // Cost efficiency - prefer cheaper items for same benefit
  if (score > 0) {
    score += (300 - item.cost) / 10;
  }

  return score;
}

/**
 * Select the best shop item to purchase
 */
export function selectBestShopItem(
  state: BossRushState,
  fortressHpPercent: number,
  config: AutoPlayConfig
): BossRushShopItem | null {
  let bestItem: BossRushShopItem | null = null;
  let bestScore = 0; // Must be positive to consider

  for (const item of BOSS_RUSH_SHOP_ITEMS) {
    const score = scoreShopItem(item, state, fortressHpPercent, config);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
}

/**
 * Get all recommended shop purchases in priority order
 */
export function getShopPurchaseRecommendations(
  state: BossRushState,
  fortressHpPercent: number,
  config: AutoPlayConfig
): BossRushShopItem[] {
  const scored = BOSS_RUSH_SHOP_ITEMS
    .map(item => ({
      item,
      score: scoreShopItem(item, state, fortressHpPercent, config),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ item }) => item);
}

// ============================================================================
// AUTO-PLAY DECISIONS
// ============================================================================

export type AutoPlayDecisionType =
  | 'CHOOSE_RELIC'
  | 'SHOP_PURCHASE'
  | 'SKIP_SHOP'
  | 'ACTIVATE_SKILL';

export interface AutoPlayDecision {
  type: AutoPlayDecisionType;
  payload: {
    relicId?: string;
    shopItemId?: string;
    skillId?: string;
  };
}

/**
 * Get auto-play decisions for current game state
 * Called during intermission in Boss Rush mode
 */
export function getAutoPlayDecisions(
  bossRushState: BossRushState,
  fortressHp: number,
  fortressMaxHp: number,
  config: AutoPlayConfig
): AutoPlayDecision[] {
  if (!config.enabled) {
    return [];
  }

  const decisions: AutoPlayDecision[] = [];
  const fortressHpPercent = fortressMaxHp > 0 ? fortressHp / fortressMaxHp : 1;

  // Only make decisions during intermission
  if (!bossRushState.inIntermission) {
    return decisions;
  }

  // 1. Choose a relic if available and not chosen
  if (bossRushState.relicOptions.length > 0 && !bossRushState.relicChosen) {
    const bestRelic = selectBestRelic(
      bossRushState.relicOptions,
      config,
      bossRushState.collectedRelics
    );
    if (bestRelic) {
      decisions.push({
        type: 'CHOOSE_RELIC',
        payload: { relicId: bestRelic },
      });
    }
  }

  // 2. Consider shop purchases
  const availableGold = getAvailableGold(bossRushState);
  if (availableGold > 0) {
    const shopItem = selectBestShopItem(bossRushState, fortressHpPercent, config);
    if (shopItem) {
      decisions.push({
        type: 'SHOP_PURCHASE',
        payload: { shopItemId: shopItem.id },
      });
    }
  }

  return decisions;
}

/**
 * Check if auto-play should activate a skill
 * Called during active gameplay
 */
export function shouldActivateSkill(
  _state: GameState,
  _skillId: string,
  skillCooldownRemaining: number,
  config: AutoPlayConfig
): boolean {
  if (!config.enabled || config.skillActivation === 'manual') {
    return false;
  }

  if (skillCooldownRemaining > 0) {
    return false;
  }

  if (config.skillActivation === 'on_cooldown') {
    // Always use when available
    return true;
  }

  // 'save_for_emergencies' - only use when needed
  // This would need more context about the skill type and game state
  // For now, default to using when HP is low
  // TODO: Implement emergency detection based on skill type
  return false;
}

// ============================================================================
// UTILITY
// ============================================================================

/**
 * Check if auto-play should buy a heal
 */
export function shouldBuyHeal(
  fortressHpPercent: number,
  config: AutoPlayConfig
): boolean {
  return fortressHpPercent < config.healThreshold;
}

/**
 * Create a config preset for aggressive damage-focused play
 */
export function createAggressiveConfig(): AutoPlayConfig {
  return {
    ...DEFAULT_AUTO_PLAY_CONFIG,
    enabled: true,
    relicPriority: 'damage',
    shopPriority: 'damage_first',
    skillActivation: 'on_cooldown',
    healThreshold: 0.3,
  };
}

/**
 * Create a config preset for defensive play
 */
export function createDefensiveConfig(): AutoPlayConfig {
  return {
    ...DEFAULT_AUTO_PLAY_CONFIG,
    enabled: true,
    relicPriority: 'defense',
    shopPriority: 'heal_first',
    skillActivation: 'save_for_emergencies',
    healThreshold: 0.6,
  };
}

/**
 * Create a config preset for gold farming
 */
export function createFarmingConfig(): AutoPlayConfig {
  return {
    ...DEFAULT_AUTO_PLAY_CONFIG,
    enabled: true,
    relicPriority: 'gold',
    shopPriority: 'balanced',
    skillActivation: 'on_cooldown',
    healThreshold: 0.4,
  };
}
