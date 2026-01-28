import type { JSX } from 'preact';
import type { FortressClass, HeroDefinition } from '@arcade/sim-core';
import { getHeroTags } from '@arcade/sim-core';
import { HeroAvatar } from '../../shared/HeroAvatar.js';
import { TagList } from '../../common/TagBadge.js';
import { useTranslation } from '../../../i18n/useTranslation.js';
import styles from './HeroIdentityCard.module.css';

// Class colors (7 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
  void: '#4b0082',
  plasma: '#00ffff',
};


// Tier colors
const TIER_COLORS = {
  1: { bg: '#cd7f32', label: 'Bronze' },
  2: { bg: '#c0c0c0', label: 'Silver' },
  3: { bg: '#ffd700', label: 'Gold' },
} as const;

interface HeroIdentityCardProps {
  heroDefinition: HeroDefinition;
  currentTier: 1 | 2 | 3;
  level: number;
  power?: number;
}

export function HeroIdentityCard({ heroDefinition, currentTier, level, power }: HeroIdentityCardProps) {
  const { t } = useTranslation(['common', 'data']);
  const classColor = CLASS_COLORS[heroDefinition.class];
  const tierColor = TIER_COLORS[currentTier];
  const tierDef = heroDefinition.tiers[currentTier - 1];

  return (
    <div
      class={styles.identityCard}
      style={{ '--class-color': classColor } as JSX.CSSProperties}
    >
      {/* Hero Avatar */}
      <div class={styles.avatarContainer}>
        <div class={styles.avatarGlow} style={{ background: `radial-gradient(circle, ${classColor}40 0%, transparent 70%)` }} />
        <HeroAvatar heroId={heroDefinition.id} tier={currentTier} size={100} />
      </div>

      {/* Hero Name */}
      <h2 class={styles.heroName}>{heroDefinition.name}</h2>

      {/* Synergy Tags */}
      <div class={styles.tagsRow}>
        <TagList
          tags={getHeroTags(heroDefinition.id)}
          size="small"
          maxVisible={5}
        />
      </div>

      {/* Tier & Level Display - Compact */}
      <div class={styles.tierLevelRow}>
        <div class={styles.tierCompact}>
          <span class={styles.tierBadge} style={{ background: tierColor.bg }}>
            T{currentTier}
          </span>
          <span class={styles.tierName}>{tierDef.name}</span>
        </div>
        <div class={styles.levelCompact}>
          <span class={styles.levelLabel}>{t('heroDetails.levelShort')}</span>
          <span class={styles.levelValue}>{level}</span>
        </div>
      </div>

      {/* Power Display */}
      {power !== undefined && (
        <div class={styles.powerRow}>
          <span class={styles.powerIcon}>💪</span>
          <span class={styles.powerLabel}>{t('heroDetails.power')}</span>
          <span class={styles.powerValue}>{power.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
