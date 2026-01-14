import type { ActiveHero } from '@arcade/sim-core';
import { getHeroById } from '@arcade/sim-core';
import { activeHeroes, gamePhase } from '../../state/index.js';
import styles from './HeroSkillBar.module.css';

// Skill icons by type
const SKILL_ICONS: Record<string, string> = {
  damage: '⚔️',
  aoe: '💥',
  buff: '✨',
  debuff: '🔻',
  summon: '👥',
  heal: '💚',
  shield: '🛡️',
  stun: '⚡',
  slow: '❄️',
  burn: '🔥',
  poison: '☠️',
  chain: '⛓️',
  pierce: '🎯',
  default: '💠',
};

// Get appropriate icon for skill based on effects
function getSkillIcon(skill: { id: string; effects?: Array<{ type: string }> }): string {
  if (skill.effects && skill.effects.length > 0) {
    const effectType = skill.effects[0].type;
    return SKILL_ICONS[effectType] || SKILL_ICONS.default;
  }
  // Fallback based on skill id patterns
  if (skill.id.includes('smash') || skill.id.includes('throw')) return SKILL_ICONS.damage;
  if (skill.id.includes('wave') || skill.id.includes('storm')) return SKILL_ICONS.aoe;
  if (skill.id.includes('buff') || skill.id.includes('boost')) return SKILL_ICONS.buff;
  if (skill.id.includes('heal')) return SKILL_ICONS.heal;
  if (skill.id.includes('shield')) return SKILL_ICONS.shield;
  return SKILL_ICONS.default;
}

interface HeroSkillBarProps {
  compact?: boolean;
}

export function HeroSkillBar({ compact = false }: HeroSkillBarProps) {
  const heroes = activeHeroes.value;
  const phase = gamePhase.value;

  // Only show during gameplay
  if (phase === 'idle' || heroes.length === 0) {
    return null;
  }

  return (
    <div class={`${styles.skillBar} ${compact ? styles.compact : ''}`}>
      {!compact && (
        <div class={styles.header}>
          <span class={styles.title}>Skills</span>
        </div>
      )}
      <div class={styles.heroSkills}>
        {heroes.map((hero) => (
          <HeroSkillGroup key={hero.definitionId} hero={hero} compact={compact} />
        ))}
      </div>
    </div>
  );
}

interface HeroSkillGroupProps {
  hero: ActiveHero;
  compact?: boolean;
}

function HeroSkillGroup({ hero, compact }: HeroSkillGroupProps) {
  const heroDef = getHeroById(hero.definitionId);
  if (!heroDef) return null;

  // Get skills for current tier
  const tierInfo = heroDef.tiers.find(t => t.tier === hero.tier);
  const skills = tierInfo?.skills || [];

  if (skills.length === 0) {
    return null;
  }

  return (
    <div class={styles.heroGroup}>
      {!compact && (
        <span class={styles.heroName}>{heroDef.name.slice(0, 3)}</span>
      )}
      <div class={styles.skillSlots}>
        {skills.slice(0, 3).map((skill) => {
          const cooldown = hero.skillCooldowns[skill.id] || 0;
          const maxCooldown = skill.cooldownTicks || 300;
          const cooldownPercent = cooldown / maxCooldown;
          const isReady = cooldown === 0;
          const icon = getSkillIcon(skill);

          return (
            <div
              key={skill.id}
              class={`${styles.skillSlot} ${isReady ? styles.ready : ''}`}
              title={`${skill.name}: ${skill.description || 'No description'}`}
            >
              {/* Cooldown fill */}
              <div
                class={styles.cooldownFill}
                style={{ height: `${(1 - cooldownPercent) * 100}%` }}
              />
              {/* Skill icon */}
              <span class={styles.skillIcon}>{icon}</span>
              {/* Cooldown text */}
              {!isReady && (
                <span class={styles.cooldownText}>
                  {Math.ceil(cooldown / 30)}s
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
