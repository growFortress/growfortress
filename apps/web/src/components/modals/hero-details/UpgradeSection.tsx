import { Button } from '../../shared/Button.js';
import cardStyles from './cards.module.css';
import { HERO_UPGRADE_COSTS } from '@arcade/protocol';
import { useTranslation } from '../../../i18n/useTranslation.js';

interface UpgradeSectionProps {
  currentTier: 1 | 2 | 3;
  playerGold: number;
  playerDust: number;
  onUpgrade: () => void;
  onPreview?: () => void;
}

export function UpgradeSection({ currentTier, playerGold, playerDust, onUpgrade, onPreview }: UpgradeSectionProps) {
  const { t } = useTranslation('common');
  const canUpgrade = currentTier < 3;

  if (!canUpgrade) {
    return (
      <div class={cardStyles.maxTierReached}>
        <span class={cardStyles.maxTierIcon}>👑</span>
        <span class={cardStyles.maxTierText}>{t('heroDetails.maxTierReached')}</span>
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
        <h4>{t('heroDetails.upgradeToTier', { tier: currentTier + 1 })}</h4>
        <div class={cardStyles.upgradeCost}>
          <span class={`${cardStyles.costItem} ${canAffordGold ? cardStyles.canAfford : cardStyles.cantAfford}`}>
            🪙 {upgradeCost.gold}
          </span>
          <span class={`${cardStyles.costItem} ${canAffordDust ? cardStyles.canAfford : cardStyles.cantAfford}`}>
            🌫️ {upgradeCost.dust}
          </span>
        </div>
      </div>
      <div class={cardStyles.upgradeButtons}>
        {onPreview && (
          <Button variant="secondary" onClick={onPreview}>
            {t('heroDetails.preview')}
          </Button>
        )}
        <Button
          variant="primary"
          disabled={!canAfford}
          onClick={onUpgrade}
        >
          {t('heroDetails.upgrade')}
        </Button>
      </div>
    </div>
  );
}
