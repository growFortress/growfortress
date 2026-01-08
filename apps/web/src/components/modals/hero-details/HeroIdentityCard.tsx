import type { JSX } from 'preact';
import type { FortressClass, HeroDefinition, HeroRole } from '@arcade/sim-core';
import { HeroAvatar } from '../../shared/HeroAvatar.js';
import styles from './HeroIdentityCard.module.css';
import cardStyles from './cards.module.css';

// Class colors (simplified: 5 classes)
const CLASS_COLORS: Record<FortressClass, string> = {
  natural: '#228b22',
  ice: '#00bfff',
  fire: '#ff4500',
  lightning: '#9932cc',
  tech: '#00f0ff',
};

// Class icons
const CLASS_ICONS: Record<FortressClass, string> = {
  natural: '🌿',
  ice: '❄️',
  fire: '🔥',
  lightning: '⚡',
  tech: '🔧',
};

// Tier colors
const TIER_COLORS = {
  1: { bg: '#cd7f32', label: 'Bronze' },
  2: { bg: '#c0c0c0', label: 'Silver' },
  3: { bg: '#ffd700', label: 'Gold' },
} as const;

// Role translations
const ROLE_LABELS: Record<HeroRole, string> = {
  tank: 'TANK',
  dps: 'DPS',
  support: 'SUPPORT',
  crowd_control: 'KONTROLA',
};

interface HeroIdentityCardProps {
  heroDefinition: HeroDefinition;
  currentTier: 1 | 2 | 3;
  level: number;
}

export function HeroIdentityCard({ heroDefinition, currentTier, level }: HeroIdentityCardProps) {
  const classColor = CLASS_COLORS[heroDefinition.class];
  const classIcon = CLASS_ICONS[heroDefinition.class];
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

      {/* Badges Row */}
      <div class={styles.badgesRow}>
        <span
          class={`${cardStyles.badge} ${cardStyles.classBadge}`}
          style={{ '--class-color': classColor } as JSX.CSSProperties}
        >
          {classIcon} {heroDefinition.class.toUpperCase()}
        </span>
        <span class={`${cardStyles.badge} ${cardStyles.roleBadge}`}>
          {ROLE_LABELS[heroDefinition.role]}
        </span>
      </div>

      {/* Rarity Badge */}
      <span class={`${cardStyles.badge} ${cardStyles.rarityBadge} ${cardStyles[heroDefinition.rarity]}`}>
        {heroDefinition.rarity.toUpperCase()}
      </span>

      {/* Current Tier Display */}
      <div class={styles.tierDisplay}>
        <div class={styles.tierLabel}>TIER</div>
        <div
          class={styles.tierNumber}
          style={{
            color: tierColor.bg,
            textShadow: `0 0 20px ${tierColor.bg}`
          }}
        >
          {currentTier}
        </div>
        <div class={styles.tierName}>{tierDef.name}</div>
        <div class={styles.tierBadge} style={{ background: tierColor.bg }}>
          {tierColor.label}
        </div>
      </div>

      {/* Level Display */}
      <div class={styles.levelDisplay}>
        <span class={styles.levelLabel}>Poziom</span>
        <span class={styles.levelValue}>{level}</span>
      </div>
    </div>
  );
}
