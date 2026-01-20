import type { JSX } from 'preact';
import type { HeroTier } from '@arcade/sim-core';
import { useTranslation } from '../../../i18n/useTranslation.js';
import styles from './TierTabs.module.css';

// Tier colors
const TIER_COLORS = {
  1: '#cd7f32',
  2: '#c0c0c0',
  3: '#ffd700',
} as const;

interface TierTabsProps {
  tiers: [HeroTier, HeroTier, HeroTier];
  currentTier: 1 | 2 | 3;
  selectedTier: 1 | 2 | 3;
  onTierSelect: (tier: 1 | 2 | 3) => void;
}

export function TierTabs({ tiers, currentTier, selectedTier, onTierSelect }: TierTabsProps) {
  const { t } = useTranslation('common');
  return (
    <div class={styles.tabsContainer}>
      {tiers.map((tier) => {
        const isActive = tier.tier === selectedTier;
        const isCurrent = tier.tier === currentTier;
        const isLocked = tier.tier > currentTier;
        const tierColor = TIER_COLORS[tier.tier];

        return (
          <button
            key={tier.tier}
            class={`
              ${styles.tab}
              ${isActive ? styles.active : ''}
              ${isCurrent ? styles.current : ''}
              ${isLocked ? styles.locked : ''}
            `}
            style={{ '--tier-color': tierColor } as JSX.CSSProperties}
            onClick={() => onTierSelect(tier.tier as 1 | 2 | 3)}
            disabled={false} // Allow viewing locked tiers
          >
            <span class={styles.tierBadge}>T{tier.tier}</span>
            <span class={styles.tierName}>{tier.name}</span>
            {isCurrent && <span class={styles.currentBadge}>{t('heroDetails.currentBadge')}</span>}
            {isLocked && <span class={styles.lockIcon}>🔒</span>}
          </button>
        );
      })}
    </div>
  );
}
