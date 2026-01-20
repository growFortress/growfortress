import { getClassById, type SkillDefinition, type SkillEffect } from '@arcade/sim-core';
import { gameState, gamePhase, selectedFortressClass, selectedTargetedSkill, selectSkillForTargeting, clearSelectedSkill } from '../../state/index.js';
import styles from './FortressSkillBar.module.css';

// Unique skill icons by skill ID (fortress skills)
const SKILL_ICONS_BY_ID: Record<string, string> = {
  // Standard (Natural)
  earthquake: '🌊',
  vine_snare: '🕸️',
  // Cryo (Ice)
  blizzard: '🌨️',
  ice_spike: '🧊',
  // Thermal (Fire)
  meteor_strike: '☄️',
  flame_wave: '🔥',
  // Electric (Lightning)
  thunderstorm: '⛈️',
  chain_lightning: '⚡',
  // Quantum (Tech)
  laser_barrage: '💥',
  emp_blast: '📡',
  // Void
  dimensional_tear: '🌀',
  void_collapse: '🕳️',
  // Plasma
  plasma_nova: '💫',
  overcharge_field: '⚡',
};

// Fallback icons by effect type
const SKILL_ICONS_BY_EFFECT: Record<string, string> = {
  damage: '⚔️',
  aoe: '💥',
  buff: '✨',
  debuff: '🔻',
  heal: '💚',
  shield: '🛡️',
  stun: '⚡',
  slow: '❄️',
  burn: '🔥',
  poison: '☠️',
  freeze: '🧊',
  summon: '👥',
  percent_current_hp_damage: '💀',
  default: '💠',
};

// Class icons
const CLASS_ICONS: Record<string, string> = {
  natural: '🌿',
  ice: '❄️',
  fire: '🔥',
  lightning: '⚡',
  poison: '☠️',
  magic: '✨',
  tech: '🔧',
};

/**
 * Format skill effect for tooltip display
 */
function formatEffect(effect: SkillEffect): string {
  switch (effect.type) {
    case 'damage':
      return `${effect.amount} obrażeń${effect.target === 'all' ? ' (wszyscy)' : effect.target === 'area' ? ' (obszar)' : ''}`;
    case 'slow':
      return `Spowolnienie ${effect.percent}% na ${((effect.duration || 0) / 30).toFixed(1)}s`;
    case 'stun':
      return `Ogłuszenie na ${((effect.duration || 0) / 30).toFixed(1)}s`;
    case 'freeze':
      return `Zamrożenie na ${((effect.duration || 0) / 30).toFixed(1)}s`;
    case 'burn':
      return `Podpalenie: ${effect.damagePerTick}/tick przez ${((effect.duration || 0) / 30).toFixed(1)}s`;
    case 'poison':
      return `Trucizna: ${effect.damagePerTick}/tick przez ${((effect.duration || 0) / 30).toFixed(1)}s${effect.stacks ? ` (${effect.stacks} stacków)` : ''}`;
    case 'heal':
      return `Leczenie: +${effect.amount} HP`;
    case 'shield':
      return `Tarcza: ${effect.amount} HP na ${((effect.duration || 0) / 30).toFixed(1)}s`;
    case 'buff':
      return `Buff: +${Math.round((effect.amount || 0) * 100 - 100)}% ${formatStat(effect.stat)} na ${((effect.duration || 0) / 30).toFixed(1)}s`;
    case 'summon':
      return `Przywołuje ${effect.count}x ${effect.unitType}`;
    case 'percent_current_hp_damage':
      return `${effect.percent}% aktualnego HP (wszyscy)`;
    default:
      return effect.type;
  }
}

function formatStat(stat: string | undefined): string {
  if (!stat) return '';
  const statNames: Record<string, string> = {
    damageMultiplier: 'DMG',
    attackSpeedMultiplier: 'Atak.Spd',
    hpRegen: 'Regen HP',
    maxHpMultiplier: 'Max HP',
  };
  return statNames[stat] || stat;
}

/**
 * Get icon for skill - prioritize skill ID, then effect type
 */
function getSkillIcon(skill: SkillDefinition): string {
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

/**
 * Generate detailed tooltip for skill
 */
function getSkillTooltip(skill: SkillDefinition): string {
  const lines: string[] = [];
  lines.push(`${skill.name}`);
  lines.push(`─────────────`);
  lines.push(skill.description);
  lines.push('');

  if (skill.damage > 0) {
    lines.push(`Obrażenia bazowe: ${skill.damage}`);
  }

  lines.push(`Cooldown: ${(skill.cooldownTicks / 30).toFixed(0)}s`);

  if (skill.effects && skill.effects.length > 0) {
    lines.push('');
    lines.push('Efekty:');
    for (const effect of skill.effects) {
      lines.push(`• ${formatEffect(effect)}`);
    }
  }

  return lines.join('\n');
}

interface FortressSkillBarProps {
  compact?: boolean;
}

export function FortressSkillBar({ compact = false }: FortressSkillBarProps) {
  const state = gameState.value;
  const phase = gamePhase.value;
  const fortressClass = selectedFortressClass.value;
  const currentSelectedSkill = selectedTargetedSkill.value;

  // Only show during gameplay with a selected class
  if (phase === 'idle' || !fortressClass) {
    return null;
  }

  const classDef = getClassById(fortressClass);
  if (!classDef) {
    return null;
  }

  const activeSkills = state?.fortressActiveSkills || [];
  const skillCooldowns = state?.fortressSkillCooldowns || {};

  /**
   * Handle click on a skill slot
   */
  const handleSkillClick = (skill: SkillDefinition) => {
    const cooldown = skillCooldowns[skill.id] || 0;
    const isReady = cooldown === 0;

    if (!isReady) return; // Can't select skill on cooldown

    if (skill.requiresTarget) {
      // Toggle selection for targeted skills
      if (currentSelectedSkill === skill.id) {
        clearSelectedSkill();
      } else {
        selectSkillForTargeting(skill.id);
      }
    }
    // Non-targeted skills (target: 'all') are auto-used, no click action needed
  };

  // Filter to only show unlocked skills
  const unlockedSkills = classDef.skills.filter(skill =>
    activeSkills.includes(skill.id)
  );

  if (unlockedSkills.length === 0) {
    return null;
  }

  const classIcon = CLASS_ICONS[fortressClass] || '🏰';

  return (
    <div class={`${styles.skillBar} ${compact ? styles.compact : ''}`} data-tutorial="fortress-skills">
      {!compact && (
        <div class={styles.header}>
          <span class={styles.title}>Twierdza {classIcon}</span>
        </div>
      )}
      <div class={styles.skillList}>
        {unlockedSkills.map((skill) => {
          const cooldown = skillCooldowns[skill.id] || 0;
          const maxCooldown = skill.cooldownTicks || 300;
          const cooldownPercent = cooldown / maxCooldown;
          const isReady = cooldown === 0;
          const icon = getSkillIcon(skill);
          const isSelected = currentSelectedSkill === skill.id;
          const isTargetable = skill.requiresTarget && isReady;

          return (
            <div
              key={skill.id}
              class={`${styles.skillSlot} ${isReady ? styles.ready : ''} ${isSelected ? styles.selected : ''} ${isTargetable ? styles.targetable : ''}`}
              title={getSkillTooltip(skill) + (skill.requiresTarget ? '\n\n🎯 Kliknij aby wybrać, potem kliknij na mapę' : '')}
              onClick={() => handleSkillClick(skill)}
            >
              {/* Cooldown fill */}
              <div
                class={styles.cooldownFill}
                style={{ height: `${(1 - cooldownPercent) * 100}%` }}
              />
              {/* Skill icon */}
              <span class={styles.skillIcon}>{icon}</span>
              {/* Target indicator for targetable skills */}
              {isTargetable && !isSelected && (
                <span class={styles.targetIndicator}>🎯</span>
              )}
              {/* Selection indicator */}
              {isSelected && (
                <span class={styles.selectedIndicator}>✓</span>
              )}
              {/* Skill name (compact only shows icon) */}
              {!compact && (
                <span class={styles.skillName}>{skill.name.slice(0, 8)}</span>
              )}
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
