import type { JSX } from 'preact';
import { createPortal } from 'preact/compat';
import type { HeroDefinition, HeroTier, FortressClass } from '@arcade/sim-core';
import { HERO_UPGRADE_COSTS } from '@arcade/protocol';
import { HeroAvatar } from '../../shared/HeroAvatar.js';
import { Button } from '../../shared/Button.js';
import { SkillCard } from './SkillCard.js';
import styles from './TierPreviewModal.module.css';

// Class colors
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
  1: '#cd7f32',
  2: '#c0c0c0',
  3: '#ffd700',
} as const;

interface TierPreviewModalProps {
  visible: boolean;
  heroDefinition: HeroDefinition;
  currentTier: 1 | 2;
  nextTier: HeroTier;
  playerGold: number;
  playerDust: number;
  onClose: () => void;
  onUpgrade: () => void;
}

export function TierPreviewModal({
  visible,
  heroDefinition,
  currentTier,
  nextTier,
  playerGold,
  playerDust,
  onClose,
  onUpgrade,
}: TierPreviewModalProps) {
  if (!visible) return null;

  const classColor = CLASS_COLORS[heroDefinition.class];
  const currentTierDef = heroDefinition.tiers[currentTier - 1];
  const nextTierNum = (currentTier + 1) as 2 | 3;
  const nextTierColor = TIER_COLORS[nextTierNum];

  const upgradeCost = currentTier === 1 ? HERO_UPGRADE_COSTS['1_to_2'] : HERO_UPGRADE_COSTS['2_to_3'];
  const canAffordGold = playerGold >= upgradeCost.gold;
  const canAffordDust = playerDust >= upgradeCost.dust;
  const canAfford = canAffordGold && canAffordDust;

  // Calculate new skills (skills in next tier that aren't in current)
  const currentSkillIds = new Set(currentTierDef.skills.map(s => s.id));
  const newSkills = nextTier.skills.filter(s => !currentSkillIds.has(s.id));

  // Visual changes comparison
  const sizeChange = {
    from: currentTierDef.visualChanges.sizeMultiplier,
    to: nextTier.visualChanges.sizeMultiplier,
  };
  const glowChange = {
    from: currentTierDef.visualChanges.glowIntensity,
    to: nextTier.visualChanges.glowIntensity,
  };
  const newParticles = nextTier.visualChanges.particleEffects.filter(
    p => !currentTierDef.visualChanges.particleEffects.includes(p)
  );

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      class={styles.overlay}
      onClick={handleBackdropClick}
      style={{ '--class-color': classColor, '--tier-color': nextTierColor } as JSX.CSSProperties}
    >
      <div class={styles.modal}>
        {/* Header */}
        <div class={styles.header}>
          <button class={styles.backButton} onClick={onClose}>
            <span class={styles.backIcon}>←</span>
            Wróć
          </button>
          <h2 class={styles.title}>
            <span class={styles.tierBadge} style={{ background: nextTierColor }}>
              TIER {nextTierNum}
            </span>
            {nextTier.name}
          </h2>
        </div>

        {/* Content */}
        <div class={styles.content}>
          {/* Hero Preview */}
          <div class={styles.heroPreview}>
            <div class={styles.avatarContainer}>
              <div class={styles.avatarGlow} />
              <HeroAvatar heroId={heroDefinition.id} tier={nextTierNum} size={120} />
            </div>
            <div class={styles.heroName}>{heroDefinition.name}</div>
          </div>

          {/* Stat Multiplier */}
          <div class={styles.section}>
            <h3 class={styles.sectionTitle}>MNOŻNIK STATYSTYK</h3>
            <div class={styles.multiplierComparison}>
              <div class={styles.multiplierFrom}>
                <span class={styles.multiplierLabel}>Tier {currentTier}</span>
                <span class={styles.multiplierValue}>×{currentTierDef.statMultiplier.toFixed(1)}</span>
              </div>
              <div class={styles.multiplierArrow}>
                <div class={styles.arrowLine} />
                <span class={styles.arrowHead}>▶</span>
              </div>
              <div class={styles.multiplierTo}>
                <span class={styles.multiplierLabel}>Tier {nextTierNum}</span>
                <span class={styles.multiplierValue}>×{nextTier.statMultiplier.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* New Skills */}
          {newSkills.length > 0 && (
            <div class={styles.section}>
              <h3 class={styles.sectionTitle}>NOWE UMIEJĘTNOŚCI</h3>
              <div class={styles.skillsList}>
                {newSkills.map((skill, index) => (
                  <div
                    key={skill.id}
                    class={styles.skillItem}
                    style={{ animationDelay: `${0.2 + index * 0.1}s` }}
                  >
                    <SkillCard skill={skill} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Changes */}
          <div class={styles.section}>
            <h3 class={styles.sectionTitle}>EFEKTY WIZUALNE</h3>
            <div class={styles.visualChanges}>
              <div class={styles.visualItem}>
                <span class={styles.visualLabel}>Rozmiar</span>
                <span class={styles.visualValue}>
                  ×{sizeChange.from.toFixed(1)} → ×{sizeChange.to.toFixed(1)}
                </span>
              </div>
              <div class={styles.visualItem}>
                <span class={styles.visualLabel}>Intensywność blasku</span>
                <div class={styles.glowBars}>
                  <div
                    class={styles.glowBar}
                    style={{ width: `${glowChange.from * 100}%`, background: TIER_COLORS[currentTier] }}
                  />
                  <span class={styles.glowArrow}>→</span>
                  <div
                    class={styles.glowBar}
                    style={{ width: `${glowChange.to * 100}%`, background: nextTierColor }}
                  />
                </div>
              </div>
              {newParticles.length > 0 && (
                <div class={styles.visualItem}>
                  <span class={styles.visualLabel}>Nowe efekty</span>
                  <div class={styles.particleList}>
                    {newParticles.map((particle) => (
                      <span key={particle} class={styles.particleBadge}>
                        ✨ {particle.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upgrade Section */}
          <div class={styles.upgradeSection}>
            <div class={styles.upgradeCost}>
              <span class={`${styles.costItem} ${canAffordGold ? styles.canAfford : styles.cantAfford}`}>
                💰 {upgradeCost.gold}
              </span>
              <span class={`${styles.costItem} ${canAffordDust ? styles.canAfford : styles.cantAfford}`}>
                ✨ {upgradeCost.dust}
              </span>
            </div>
            <Button
              variant="primary"
              disabled={!canAfford}
              onClick={onUpgrade}
              class={styles.upgradeButton}
            >
              ULEPSZ DO TIER {nextTierNum}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
