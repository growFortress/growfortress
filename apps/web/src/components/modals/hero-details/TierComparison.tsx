import type { JSX } from 'preact';
import type { HeroDefinition } from '@arcade/sim-core';
import { calculateHeroStats } from '@arcade/sim-core';
import { useState } from 'preact/hooks';
import { useTranslation } from '../../../i18n/useTranslation.js';
import styles from './TierComparison.module.css';
import cardStyles from './cards.module.css';

// Tier colors
const TIER_COLORS = {
  1: '#cd7f32',
  2: '#c0c0c0',
  3: '#ffd700',
} as const;

interface TierComparisonProps {
  heroDefinition: HeroDefinition;
  currentTier: 1 | 2 | 3;
  selectedTier: 1 | 2 | 3;
  level: number;
}

interface StatComparison {
  label: string;
  values: [number, number, number];
  format?: (v: number) => string;
}

export function TierComparison({ heroDefinition, currentTier, selectedTier, level }: TierComparisonProps) {
  const { t } = useTranslation('common');
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate stats for all 3 tiers at current level
  const tier1Stats = calculateHeroStats(heroDefinition, 1, level);
  const tier2Stats = calculateHeroStats(heroDefinition, 2, level);
  const tier3Stats = calculateHeroStats(heroDefinition, 3, level);

  const stats: StatComparison[] = [
    { label: t('heroDetails.statsShort.hp'), values: [tier1Stats.hp, tier2Stats.hp, tier3Stats.hp] },
    { label: t('heroDetails.statsShort.damage'), values: [tier1Stats.damage, tier2Stats.damage, tier3Stats.damage] },
    {
      label: t('heroDetails.statsShort.attackSpeed'),
      values: [tier1Stats.attackSpeed, tier2Stats.attackSpeed, tier3Stats.attackSpeed],
      format: (v) => v.toFixed(2),
    },
  ];

  // Find max value for each stat to calculate bar widths
  const getBarWidth = (value: number, values: number[]) => {
    const max = Math.max(...values);
    return (value / max) * 100;
  };

  if (!isExpanded) {
    return (
      <button class={styles.toggleButton} onClick={() => setIsExpanded(true)}>
        📊 {t('heroDetails.showTierComparison')}
      </button>
    );
  }

  return (
    <div class={`${cardStyles.card} ${styles.comparisonCard}`}>
      <div class={styles.header}>
        <div class={cardStyles.cardHeader}>{t('heroDetails.tierComparisonTitle', { level })}</div>
        <button class={styles.closeButton} onClick={() => setIsExpanded(false)}>×</button>
      </div>

      {/* Legend */}
      <div class={styles.legend}>
        <div class={styles.legendItem}>
          <span class={`${styles.legendDot} ${styles.tier1}`} />
          <span>{t('heroDetails.tierShort', { tier: 1 })} ({heroDefinition.tiers[0].name})</span>
        </div>
        <div class={styles.legendItem}>
          <span class={`${styles.legendDot} ${styles.tier2}`} />
          <span>{t('heroDetails.tierShort', { tier: 2 })} ({heroDefinition.tiers[1].name})</span>
        </div>
        <div class={styles.legendItem}>
          <span class={`${styles.legendDot} ${styles.tier3}`} />
          <span>{t('heroDetails.tierShort', { tier: 3 })} ({heroDefinition.tiers[2].name})</span>
        </div>
      </div>

      {/* Stats Comparison */}
      <div class={styles.statsComparison}>
        {stats.map((stat) => (
          <div key={stat.label} class={cardStyles.comparisonRow}>
            <span class={cardStyles.comparisonLabel}>{stat.label}</span>
            <div class={cardStyles.comparisonBars}>
              {([1, 2, 3] as const).map((tier) => {
                const value = stat.values[tier - 1];
                const width = getBarWidth(value, stat.values);
                const isHighlighted = tier === selectedTier;
                const isCurrent = tier === currentTier;
                const formattedValue = stat.format ? stat.format(value) : Math.round(value);

                return (
                  <div
                    key={tier}
                    class={`
                      ${cardStyles.comparisonBar}
                      ${cardStyles[`tier${tier}`]}
                      ${isHighlighted ? cardStyles.highlighted : ''}
                    `}
                    style={{
                      width: `${width}%`,
                      '--tier-color': TIER_COLORS[tier]
                    } as JSX.CSSProperties}
                    data-value={formattedValue}
                  >
                    {isCurrent && <span class={styles.currentMarker}>●</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Multiplier Comparison */}
      <div class={styles.multiplierComparison}>
        <div class={styles.multiplierLabel}>{t('heroDetails.statMultiplier')}</div>
        <div class={styles.multipliers}>
          {([1, 2, 3] as const).map((tier) => {
            const multiplier = heroDefinition.tiers[tier - 1].statMultiplier;
            const isHighlighted = tier === selectedTier;
            const isCurrent = tier === currentTier;

            return (
              <div
                key={tier}
                class={`
                  ${styles.multiplierBox}
                  ${isHighlighted ? styles.highlighted : ''}
                  ${isCurrent ? styles.current : ''}
                `}
                style={{ '--tier-color': TIER_COLORS[tier] } as JSX.CSSProperties}
              >
                <span class={styles.tierLabel}>{t('heroDetails.tierShort', { tier })}</span>
                <span class={styles.multiplierValue}>×{multiplier.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
