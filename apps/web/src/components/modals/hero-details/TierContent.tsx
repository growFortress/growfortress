import type { JSX } from 'preact';
import type { HeroTier } from '@arcade/sim-core';
import { useTranslation } from '../../../i18n/useTranslation.js';
import { SkillCard } from './SkillCard.js';
import styles from './TierContent.module.css';
import cardStyles from './cards.module.css';

// Tier colors
const TIER_COLORS = {
  1: '#cd7f32',
  2: '#c0c0c0',
  3: '#ffd700',
} as const;

interface TierContentProps {
  tier: HeroTier;
  isCurrentTier: boolean;
  isLocked: boolean;
  classColor: string;
}

export function TierContent({ tier, isCurrentTier, isLocked, classColor }: TierContentProps) {
  const { t } = useTranslation('common');
  const tierColor = TIER_COLORS[tier.tier];

  // Separate skills by type
  const passiveSkills = tier.skills.filter(s => s.isPassive);
  const activeSkills = tier.skills.filter(s => !s.isPassive && !s.isUltimate);
  const ultimateSkill = tier.skills.find(s => s.isUltimate);

  return (
    <div
      class={`${styles.tierContent} ${isLocked ? styles.locked : ''}`}
      style={{ '--tier-color': tierColor } as JSX.CSSProperties}
    >
      {/* Locked Overlay */}
      {isLocked && (
        <div class={styles.lockedOverlay}>
          <span class={styles.lockedIcon}>🔒</span>
          <span class={styles.lockedText}>{t('heroDetails.tierLocked')}</span>
        </div>
      )}

      {/* Header with status */}
      <div class={styles.tierHeader}>
        <div class={styles.tierInfo}>
          <span class={styles.tierBadge} style={{ background: tierColor }}>T{tier.tier}</span>
          <span class={styles.tierName}>{tier.name}</span>
        </div>
        {isCurrentTier && <span class={styles.currentBadge}>{t('heroDetails.currentBadge')}</span>}
      </div>

      {/* Stat Multiplier */}
      <div class={cardStyles.multiplierDisplay} style={{ '--tier-color': tierColor } as JSX.CSSProperties}>
        <span class={cardStyles.multiplierLabel}>{t('heroDetails.statMultiplier')}</span>
        <span class={cardStyles.multiplierValue}>×{tier.statMultiplier.toFixed(1)}</span>
      </div>

      {/* Visual Changes */}
      <div class={styles.section}>
        <div class={cardStyles.sectionTitle}>{t('heroDetails.visualChanges')}</div>
        <div class={cardStyles.visualChanges}>
          <div class={cardStyles.visualItem}>
            <span class={cardStyles.visualLabel}>{t('heroDetails.visualSize')}</span>
            <span class={cardStyles.visualValue}>×{tier.visualChanges.sizeMultiplier.toFixed(1)}</span>
          </div>
          <div class={cardStyles.visualItem}>
            <span class={cardStyles.visualLabel}>{t('heroDetails.visualGlow')}</span>
            <div class={cardStyles.glowPreview}>
              <div
                class={cardStyles.glowBar}
                style={{
                  width: `${tier.visualChanges.glowIntensity * 100}%`,
                  background: classColor
                }}
              />
            </div>
          </div>
          {tier.visualChanges.particleEffects.length > 0 && (
            <div class={cardStyles.particleEffects}>
              {tier.visualChanges.particleEffects.map((effect) => (
                <span key={effect} class={cardStyles.particleBadge}>
                  ✨ {effect.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
          {tier.visualChanges.colorShift && (
            <div class={cardStyles.colorShift}>
              <span class={cardStyles.visualLabel}>{t('heroDetails.visualColorShift')}</span>
              <div
                class={cardStyles.colorPreview}
                style={{ background: `#${tier.visualChanges.colorShift.toString(16).padStart(6, '0')}` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Skills */}
      {tier.skills.length > 0 && (
        <div class={styles.section}>
          <div class={cardStyles.sectionTitle}>{t('heroDetails.skills')}</div>
          <div class={styles.skillsList}>
            {/* Passive skills first */}
            {passiveSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
            {/* Active skills */}
            {activeSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
            {/* Ultimate last */}
            {ultimateSkill && (
              <SkillCard key={ultimateSkill.id} skill={ultimateSkill} />
            )}
          </div>
        </div>
      )}

      {/* Unlock Requirements (for tier 2 and 3) */}
      {tier.tier > 1 && (
        <div class={styles.section}>
          <div class={cardStyles.sectionTitle}>{t('heroDetails.unlockRequirements')}</div>
          <div class={cardStyles.reqGrid}>
            <div class={cardStyles.reqItem}>
              <span class={cardStyles.reqLabel}>{t('labels.level')}</span>
              <span class={cardStyles.reqValue}>{tier.unlockRequirements.level}</span>
            </div>
            <div class={cardStyles.reqItem}>
              <span class={cardStyles.reqLabel}>{t('resources.gold')}</span>
              <span class={cardStyles.reqValue}>🪙 {tier.unlockRequirements.gold}</span>
            </div>
            <div class={cardStyles.reqItem}>
              <span class={cardStyles.reqLabel}>{t('resources.dust')}</span>
              <span class={cardStyles.reqValue}>🌫️ {tier.unlockRequirements.dust}</span>
            </div>
            {tier.unlockRequirements.material && (
              <div class={cardStyles.reqItem}>
                <span class={cardStyles.reqLabel}>{t('heroDetails.material')}</span>
                <span class={cardStyles.reqValue}>🔮 {tier.unlockRequirements.material.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
