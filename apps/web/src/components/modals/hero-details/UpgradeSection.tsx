import { Button } from '../../shared/Button.js';
import cardStyles from './cards.module.css';

// Upgrade costs
const HERO_UPGRADE_COSTS = {
  '1_to_2': { gold: 300, dust: 30 },
  '2_to_3': { gold: 800, dust: 100 },
} as const;

interface UpgradeSectionProps {
  currentTier: 1 | 2 | 3;
  playerGold: number;
  playerDust: number;
  onUpgrade: () => void;
}

export function UpgradeSection({ currentTier, playerGold, playerDust, onUpgrade }: UpgradeSectionProps) {
  const canUpgrade = currentTier < 3;

  if (!canUpgrade) {
    return (
      <div class={cardStyles.maxTierReached}>
        <span class={cardStyles.maxTierIcon}>👑</span>
        <span class={cardStyles.maxTierText}>Maksymalny Tier!</span>
      </div>
    );
  }

  const upgradeCost = currentTier === 1 ? HERO_UPGRADE_COSTS['1_to_2'] : HERO_UPGRADE_COSTS['2_to_3'];
  const canAffordGold = playerGold >= upgradeCost.gold;
  const canAffordDust = playerDust >= upgradeCost.dust;
  const canAfford = canAffordGold && canAffordDust;

  return (
    <div class={cardStyles.upgradeSection}>
      <div class={cardStyles.upgradeInfo}>
        <h4>Ulepsz do Tier {currentTier + 1}</h4>
        <div class={cardStyles.upgradeCost}>
          <span class={`${cardStyles.costItem} ${canAffordGold ? cardStyles.canAfford : cardStyles.cantAfford}`}>
            💰 {upgradeCost.gold}
          </span>
          <span class={`${cardStyles.costItem} ${canAffordDust ? cardStyles.canAfford : cardStyles.cantAfford}`}>
            ✨ {upgradeCost.dust}
          </span>
        </div>
      </div>
      <Button
        variant="primary"
        disabled={!canAfford}
        onClick={onUpgrade}
      >
        ULEPSZ
      </Button>
    </div>
  );
}
