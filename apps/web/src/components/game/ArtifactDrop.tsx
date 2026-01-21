import { getArtifactById } from '@arcade/sim-core';
import { recentArtifactDrops } from '../../state/artifacts.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './ArtifactDrop.module.css';

// Rarity colors (matching game theme)
const RARITY_COLORS: Record<string, string> = {
  common: '#808080',
  rare: '#0088ff',
  epic: '#9932cc',
  legendary: '#ffd700',
};

// Rarity glow intensity
const RARITY_GLOW: Record<string, string> = {
  common: '0 0 10px #808080',
  rare: '0 0 20px #0088ff, 0 0 40px #0088ff40',
  epic: '0 0 25px #9932cc, 0 0 50px #9932cc40',
  legendary: '0 0 30px #ffd700, 0 0 60px #ffd70060, 0 0 90px #ffd70030',
};

// Artifact slot icons
const SLOT_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  gadget: '🔧',
  book: '📖',
  special: '✨',
};

export function ArtifactDrop() {
  const { t } = useTranslation('game');
  const drops = recentArtifactDrops.value;

  if (drops.length === 0) {
    return null;
  }

  return (
    <div class={styles.container}>
      {drops.map((drop, index) => {
        const artifact = getArtifactById(drop.artifactId);
        if (!artifact) return null;

        const color = RARITY_COLORS[artifact.rarity] || '#808080';
        const glow = RARITY_GLOW[artifact.rarity] || RARITY_GLOW.common;
        const slotIcon = SLOT_ICONS[artifact.slot] || '📦';

        return (
          <div
            key={`${drop.artifactId}-${drop.timestamp}-${index}`}
            class={`${styles.dropNotification} ${styles[artifact.rarity]}`}
            style={{
              '--rarity-color': color,
              '--rarity-glow': glow,
            } as Record<string, string>}
          >
            {/* Animated background rays for legendary */}
            {artifact.rarity === 'legendary' && (
              <div class={styles.legendaryRays} />
            )}

            {/* Icon with glow */}
            <div class={styles.iconWrapper}>
              <span class={styles.icon}>{slotIcon}</span>
              <div class={styles.iconGlow} />
            </div>

            {/* Info */}
            <div class={styles.info}>
              <div class={styles.header}>
                <span class={styles.rarityLabel}>
                  {drop.isDuplicate ? t('artifactDrop.duplicate') : artifact.rarity.toUpperCase()}
                </span>
                {artifact.rarity === 'legendary' && !drop.isDuplicate && (
                  <span class={styles.starBurst}>★</span>
                )}
              </div>
              <span class={styles.name}>{artifact.polishName}</span>
              {drop.isDuplicate ? (
                <span class={styles.dustReward}>
                  {t('artifactDrop.dustReward', { amount: drop.dustValue })}
                </span>
              ) : (
                <span class={styles.newLabel}>{t('artifactDrop.newArtifact')}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
