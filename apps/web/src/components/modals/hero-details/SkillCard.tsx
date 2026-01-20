import type { JSX } from 'preact';
import type { HeroDefinition, HeroSkillDefinition } from '@arcade/sim-core';
import cardStyles from './cards.module.css';
import { useTranslation } from '../../../i18n/useTranslation.js';

interface SkillCardProps {
  heroId: string;
  skill: HeroSkillDefinition;
}

function getSkillType(skill: HeroSkillDefinition): 'passive' | 'combat' | 'ultimate' {
  if (skill.isPassive) return 'passive';
  if (skill.isUltimate) return 'ultimate';
  return 'combat';
}

function getSkillIcon(skill: HeroSkillDefinition): string {
  if (skill.isPassive) return '🛡️';
  if (skill.isUltimate) return '🔥';
  return '⚡';
}

function formatCooldown(cooldownTicks: number): string {
  return `${(cooldownTicks / 30).toFixed(1)}s`;
}

export function SkillCard({ heroId, skill }: SkillCardProps) {
  const { t } = useTranslation(['common', 'game']);
  const skillType = getSkillType(skill);
  const skillIcon = getSkillIcon(skill);

  const getSkillTypeLabel = () => {
    if (skill.isPassive) return t('common:heroDetails.skillTypes.passive');
    if (skill.isUltimate) return t('common:heroDetails.skillTypes.ultimate');
    return null;
  };

  const formatEffectValue = (type: string, value: number) => {
    const label = t(`common:heroDetails.effects.${type.toLowerCase()}`);
    return (
      <span class={cardStyles.effectValue}>
        {label}: <span class={cardStyles.number}>{value}</span>
      </span>
    );
  };

  const typeLabel = getSkillTypeLabel();

  return (
    <div class={`${cardStyles.skillCard} ${cardStyles[skillType]}`}>
      <div class={cardStyles.skillHeader}>
        <span class={cardStyles.skillIcon}>{skillIcon}</span>
        <div class={cardStyles.skillNameGroup}>
          <span class={cardStyles.skillName}>{t(`game:heroes.${heroId}.skills.${skill.id}.name`)}</span>
          {typeLabel && (
            <span class={`${cardStyles.skillType} ${skill.isUltimate ? cardStyles.ultimate : ''}`}>
              {typeLabel}
            </span>
          )}
        </div>
        {skill.unlockedAtLevel > 1 && (
          <span class={cardStyles.unlockLevel}>{t('common:heroDetails.levelLabel')} {skill.unlockedAtLevel}</span>
        )}
        {!skill.isPassive && (
          <span class={cardStyles.skillCooldown}>{formatCooldown(skill.cooldownTicks)}</span>
        )}
      </div>

      <p class={cardStyles.skillDescription}>{t(`game:heroes.${heroId}.skills.${skill.id}.description`)}</p>

      {skill.effects.length > 0 && (
        <div class={cardStyles.skillEffects}>
          {skill.effects.map((effect, idx) => (
            <div key={idx} class={cardStyles.effectItem}>
              {formatEffectValue(effect.type, effect.amount ?? 0)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
