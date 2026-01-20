import type { HeroSkillDefinition } from '@arcade/sim-core';
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

function getSkillTypeLabel(skill: HeroSkillDefinition): string {
  if (skill.isPassive) return 'Pasywna';
  if (skill.isUltimate) return 'ULTIMATE';
  return '';
}

function formatCooldown(cooldownTicks: number): string {
  // Assuming 30 ticks per second
  return `${(cooldownTicks / 30).toFixed(1)}s`;
}

function formatEffectValue(effect: { type: string; amount?: number; percent?: number; duration?: number }): string {
  switch (effect.type) {
    case 'damage':
      return `${effect.amount} DMG`;
    case 'stun':
      return `${((effect.duration || 0) / 30).toFixed(1)}s Stun`;
    case 'slow':
      return `${effect.percent}% Slow`;
    case 'heal':
      return `${effect.amount} Heal`;
    case 'shield':
      return `${effect.amount} Shield`;
    case 'burn':
      return `Burn`;
    case 'freeze':
      return `Freeze`;
    case 'poison':
      return `Poison`;
    case 'buff':
      return `Buff`;
    case 'summon':
      return `Summon`;
    default:
      return effect.type;
  }
}

export function SkillCard({ skill }: SkillCardProps) {
  const skillType = getSkillType(skill);
  const skillIcon = getSkillIcon(skill);
  const skillTypeLabel = getSkillTypeLabel(skill);

  return (
    <div class={`${cardStyles.skillCard} ${cardStyles[skillType]}`}>
      <div class={cardStyles.skillHeader}>
        <span class={cardStyles.skillIcon}>{skillIcon}</span>
        <span class={cardStyles.skillName}>{skill.name}</span>
        {skillTypeLabel && (
          <span class={cardStyles.skillType}>{skillTypeLabel}</span>
        )}
        {!skill.isPassive && (
          <span class={cardStyles.skillCooldown}>{formatCooldown(skill.cooldownTicks)}</span>
        )}
      </div>

      <div class={cardStyles.skillDesc}>{skill.description}</div>

      {skill.effects.length > 0 && (
        <div class={cardStyles.skillEffects}>
          {skill.effects.map((effect, index) => (
            <span key={index} class={cardStyles.effectBadge}>
              {formatEffectValue(effect)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
