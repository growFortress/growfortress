import type { ActiveHero } from '@arcade/sim-core';
import { getHeroById } from '@arcade/sim-core';
import { activeHeroes, gamePhase } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './HeroSkillBar.module.css';

// Unique skill icons by skill ID (hero skills)
const SKILL_ICONS_BY_ID: Record<string, string> = {
  // Storm (Lightning)
  arc_strike: '⚡',
  storm_passive: '🔗',
  chain_lightning: '⛓️',
  storm_lord: '👑',
  ion_cannon: '🔫',
  emp_storm: '💫',
  // Forge (Tech)
  laser_burst: '💥',
  thrusters: '🚀',
  missile_barrage: '🚀',
  targeting_system: '🎯',
  nano_swarm: '🤖',
  orbital_strike: '☄️',
  // Titan (Void)
  void_strike: '🌀',
  void_armor: '🛡️',
  gravity_well: '🕳️',
  event_horizon: '⭕',
  dimension_rift: '🌌',
  singularity: '💀',
  // Vanguard (Natural/Tank)
  shield_bash: '🛡️',
  fortify: '🏰',
  rallying_cry: '📢',
  last_stand: '⚔️',
  titan_shield: '🔰',
  immortal_will: '👊',
  // Rift (Fire/Mage)
  fire_bolt: '🔥',
  flame_shield: '🔶',
  inferno: '🌋',
  phoenix_form: '🐦',
  meteor_shower: '☄️',
  supernova: '💥',
  // Frost (Ice/Support)
  ice_shard: '❄️',
  frost_armor: '🧊',
  blizzard_aura: '🌨️',
  absolute_zero: '💠',
  ice_lance: '🔱',
  permafrost: '❄️',
  // Spectre (Plasma)
  plasma_bolt: '🔮',
  phase_shift: '👻',
  overload: '⚡',
  quantum_field: '🌐',
  annihilate: '💫',
  void_walker: '🌀',
  // Omega
  omega_blast: '⭐',
  omega_shield: '🌟',
  omega_fury: '💢',
};

// Fallback icons by effect type
const SKILL_ICONS_BY_EFFECT: Record<string, string> = {
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
  freeze: '🧊',
  default: '💠',
};

// Get appropriate icon for skill - prioritize skill ID, then effect type
function getSkillIcon(skill: { id: string; effects?: Array<{ type: string }> }): string {
  // First check for skill-specific icon
  if (SKILL_ICONS_BY_ID[skill.id]) {
    return SKILL_ICONS_BY_ID[skill.id];
  }
  // Then check effect type
  if (skill.effects && skill.effects.length > 0) {
    const effectType = skill.effects[0].type;
    return SKILL_ICONS_BY_EFFECT[effectType] || SKILL_ICONS_BY_EFFECT.default;
  }
  return SKILL_ICONS_BY_EFFECT.default;
}

interface HeroSkillBarProps {
  compact?: boolean;
}

export function HeroSkillBar({ compact = false }: HeroSkillBarProps) {
  const { t } = useTranslation('game');
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
          <span class={styles.title}>{t('heroSkills.title')}</span>
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
  const allSkills = tierInfo?.skills || [];
  
  // Filter out passive skills - they're always active and shouldn't show cooldowns
  const skills = allSkills.filter(skill => !skill.isPassive);

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
