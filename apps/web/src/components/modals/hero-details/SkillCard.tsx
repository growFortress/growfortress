import type { HeroSkillDefinition } from '@arcade/sim-core';
import { useTranslation } from '../../../i18n/useTranslation.js';
import cardStyles from './cards.module.css';

interface SkillCardProps {
  skill: HeroSkillDefinition;
}

function getSkillType(skill: HeroSkillDefinition): 'passive' | 'active' | 'ultimate' {
  if (skill.isPassive) return 'passive';
  if (skill.isUltimate) return 'ultimate';
  return 'active';
}

function getSkillIcon(skill: HeroSkillDefinition): string {
  if (skill.isPassive) return '⭐';
  if (skill.isUltimate) return '💥';
  return '⚡';
}

function formatCooldown(cooldownTicks: number): string {
  // Assuming 30 ticks per second
  return `${(cooldownTicks / 30).toFixed(1)}s`;
}

function formatEffectValue(
  effect: { type: string; amount?: number; percent?: number; duration?: number },
  t: (key: string, options?: Record<string, number | string>) => string
): string {
  switch (effect.type) {
    case 'damage':
      return t('heroDetails.skillEffects.damage', { amount: effect.amount ?? 0 });
    case 'stun':
      return t('heroDetails.skillEffects.stun', {
        seconds: Number(((effect.duration || 0) / 30).toFixed(1)),
      });
    case 'slow':
      return t('heroDetails.skillEffects.slow', { percent: effect.percent ?? 0 });
    case 'heal':
      return t('heroDetails.skillEffects.heal', { amount: effect.amount ?? 0 });
    case 'shield':
      return t('heroDetails.skillEffects.shield', { amount: effect.amount ?? 0 });
    case 'burn':
      return t('heroDetails.skillEffects.burn');
    case 'freeze':
      return t('heroDetails.skillEffects.freeze');
    case 'poison':
      return t('heroDetails.skillEffects.poison');
    case 'buff':
      return t('heroDetails.skillEffects.buff');
    case 'summon':
      return t('heroDetails.skillEffects.summon');
    default:
      return effect.type;
  }
}

export function SkillCard({ skill }: SkillCardProps) {
  const { t } = useTranslation(['common', 'data']);
  const skillType = getSkillType(skill);
  const skillIcon = getSkillIcon(skill);
  const skillTypeLabel = skill.isPassive
    ? t('heroDetails.skillTypes.passive')
    : skill.isUltimate
      ? t('heroDetails.skillTypes.ultimate')
      : '';
  const skillName = t(`data:skills.${skill.id}.name`, { defaultValue: skill.name });
  const skillDescription = t(`data:skills.${skill.id}.description`, { defaultValue: skill.description });

  return (
    <div class={`${cardStyles.skillCard} ${cardStyles[skillType]}`}>
      <div class={cardStyles.skillHeader}>
        <span class={cardStyles.skillIcon}>{skillIcon}</span>
        <span class={cardStyles.skillName}>{skillName}</span>
        {skillTypeLabel && (
          <span class={cardStyles.skillType}>{skillTypeLabel}</span>
        )}
        {!skill.isPassive && (
          <span class={cardStyles.skillCooldown}>{formatCooldown(skill.cooldownTicks)}</span>
        )}
      </div>

      <div class={cardStyles.skillDesc}>{skillDescription}</div>

      {skill.effects.length > 0 && (
        <div class={cardStyles.skillEffects}>
          {skill.effects.map((effect, index) => (
            <span key={index} class={cardStyles.effectBadge}>
              {formatEffectValue(effect, t)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
