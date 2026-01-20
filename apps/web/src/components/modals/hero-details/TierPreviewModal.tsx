import type { JSX } from 'preact';
import { createPortal } from 'preact/compat';
import type { HeroDefinition, HeroTier, FortressClass } from '@arcade/sim-core';
import { calculateHeroStats } from '@arcade/sim-core';
import { HERO_UPGRADE_COSTS } from '@arcade/protocol';
import { HeroAvatar } from '../../shared/HeroAvatar.js';
import { Button } from '../../shared/Button.js';
import { SkillCard } from './SkillCard.js';
import { useTranslation } from '../../../i18n/useTranslation.js';
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
  heroLevel: number;
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
  heroLevel,
  playerGold,
  playerDust,
  onClose,
  onUpgrade,
}: TierPreviewModalProps) {
  const { t } = useTranslation('common');
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
  
  // Calculate stat deltas between current and next tier
  const currentStats = calculateHeroStats(heroDefinition, currentTier, heroLevel);
  const nextStats = calculateHeroStats(heroDefinition, nextTierNum, heroLevel);
  const statDeltas = {
    hp: { from: currentStats.hp, to: nextStats.hp, delta: nextStats.hp - currentStats.hp },
    damage: { from: currentStats.damage, to: nextStats.damage, delta: nextStats.damage - currentStats.damage },
    attackSpeed: { from: currentStats.attackSpeed, to: nextStats.attackSpeed, delta: nextStats.attackSpeed - currentStats.attackSpeed },
  };

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
            {t('heroDetails.back')}
          </button>
          <h2 class={styles.title}>
            <span class={styles.tierBadge} style={{ background: nextTierColor }}>
              {t('heroDetails.tierLabel', { tier: nextTierNum })}
            </span>
            {nextTier.name}
          </h2>
        </div>

        {/* Content */}
        <div class={styles.content}>
          {/* Hero Strip */}
          <div class={styles.heroStrip}>
            <div class={styles.avatarContainer}>
              <div class={styles.avatarGlow} />
              <HeroAvatar heroId={heroDefinition.id} tier={nextTierNum} size={96} />
            </div>
            <div class={styles.heroStripInfo}>
              <div class={styles.heroName}>{heroDefinition.name}</div>
              <div class={styles.heroStripMeta}>
                {t('heroDetails.tierWithNumber', { tier: currentTier })} → {t('heroDetails.tierWithNumber', { tier: nextTierNum })}
              </div>
            </div>
          </div>

          {/* Change Grid */}
          <div class={styles.changeGrid}>
            <div class={styles.card}>
              <div class={styles.cardHeader}>{t('heroDetails.statMultiplier')}</div>
              <div class={styles.multiplierComparison}>
                <div class={styles.multiplierFrom}>
                  <span class={styles.multiplierLabel}>{t('heroDetails.tierWithNumber', { tier: currentTier })}</span>
                  <span class={styles.multiplierValue}>×{currentTierDef.statMultiplier.toFixed(1)}</span>
                </div>
                <div class={styles.multiplierArrow}>
                  <div class={styles.arrowLine} />
                  <span class={styles.arrowHead}>▶</span>
                </div>
                <div class={styles.multiplierTo}>
                  <span class={styles.multiplierLabel}>{t('heroDetails.tierWithNumber', { tier: nextTierNum })}</span>
                  <span class={styles.multiplierValue}>×{nextTier.statMultiplier.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div class={styles.card}>
              <div class={styles.cardHeader}>{t('heroDetails.statChanges')}</div>
              <div class={styles.statDeltaCompact}>
                <div class={styles.statDeltaItem}>
                  <span class={styles.statDeltaIcon}>❤️</span>
                  <span class={styles.statDeltaValues}>
                    {Math.round(statDeltas.hp.from)} → <strong>{Math.round(statDeltas.hp.to)}</strong>
                  </span>
                  <span class={styles.statDeltaBadge}>+{Math.round(statDeltas.hp.delta)}</span>
                </div>
                <div class={styles.statDeltaItem}>
                  <span class={styles.statDeltaIcon}>⚔️</span>
                  <span class={styles.statDeltaValues}>
                    {Math.round(statDeltas.damage.from)} → <strong>{Math.round(statDeltas.damage.to)}</strong>
                  </span>
                  <span class={styles.statDeltaBadge}>+{Math.round(statDeltas.damage.delta)}</span>
                </div>
                <div class={styles.statDeltaItem}>
                  <span class={styles.statDeltaIcon}>⚡</span>
                  <span class={styles.statDeltaValues}>
                    {statDeltas.attackSpeed.from.toFixed(2)} → <strong>{statDeltas.attackSpeed.to.toFixed(2)}</strong>
                  </span>
                  <span class={styles.statDeltaBadge}>+{statDeltas.attackSpeed.delta.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* New Skills */}
          {newSkills.length > 0 && (
            <div class={styles.card}>
              <div class={styles.cardHeader}>{t('heroDetails.newSkills')}</div>
              <div class={styles.skillsList}>
                {newSkills.map((skill, index) => (
                  <div
                    key={skill.id}
                    class={styles.skillItem}
                    style={{ animationDelay: `${0.1 + index * 0.05}s` }}
                  >
                    <SkillCard skill={skill} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual Changes */}
          <div class={styles.card}>
            <div class={styles.cardHeader}>{t('heroDetails.visualChanges')}</div>
            <div class={styles.visualChanges}>
              <div class={styles.visualItem}>
                <span class={styles.visualLabel}>{t('heroDetails.visualSize')}</span>
                <span class={styles.visualValue}>
                  ×{sizeChange.from.toFixed(1)} → ×{sizeChange.to.toFixed(1)}
                </span>
              </div>
              <div class={styles.visualItem}>
                <span class={styles.visualLabel}>{t('heroDetails.visualGlow')}</span>
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
                  <span class={styles.visualLabel}>{t('heroDetails.newEffects')}</span>
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
        </div>

        {/* Upgrade Footer */}
        <div class={styles.footer}>
          <div class={styles.upgradeCost}>
            <span class={`${styles.costItem} ${canAffordGold ? styles.canAfford : styles.cantAfford}`}>
              🪙 {upgradeCost.gold}
            </span>
            <span class={`${styles.costItem} ${canAffordDust ? styles.canAfford : styles.cantAfford}`}>
              🌫️ {upgradeCost.dust}
            </span>
          </div>
          <Button
            variant="primary"
            disabled={!canAfford}
            onClick={onUpgrade}
            class={styles.upgradeButton}
          >
            {t('heroDetails.upgradeToTier', { tier: nextTierNum })}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
