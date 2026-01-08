import type { ActiveTurret } from '@arcade/sim-core';
import { getTurretById } from '@arcade/sim-core';
import { activeTurrets, gamePhase } from '../../state/index.js';
import styles from './TurretSkillBar.module.css';

// Ability icons by effect type
const ABILITY_ICONS: Record<string, string> = {
  damage_boost: '⚡',
  aoe_attack: '💥',
  guaranteed_crit: '🎯',
  chain_all: '⛓️',
  freeze_all: '❄️',
  zone_damage: '🔥',
  buff_allies: '✨',
  poison_all: '☠️',
  default: '💠',
};

// Get icon for ability based on effect type
function getAbilityIcon(effectType: string): string {
  return ABILITY_ICONS[effectType] || ABILITY_ICONS.default;
}

// Turret icons for compact display
const TURRET_ICONS: Record<string, string> = {
  arrow: '🏹',
  cannon: '💣',
  sniper: '🎯',
  tesla: '⚡',
  frost: '❄️',
  flame: '🔥',
  support: '✨',
  poison: '☠️',
};

interface TurretSkillBarProps {
  compact?: boolean;
}

export function TurretSkillBar({ compact = false }: TurretSkillBarProps) {
  const turrets = activeTurrets.value;
  const phase = gamePhase.value;

  // Only show during gameplay
  if (phase === 'idle' || turrets.length === 0) {
    return null;
  }

  return (
    <div class={`${styles.skillBar} ${compact ? styles.compact : ''}`}>
      <div class={styles.header}>
        <span class={styles.title}>Turret Abilities</span>
      </div>
      <div class={styles.turretSkills}>
        {turrets.map((turret) => (
          <TurretSkillSlot key={turret.slotIndex} turret={turret} compact={compact} />
        ))}
      </div>
    </div>
  );
}

interface TurretSkillSlotProps {
  turret: ActiveTurret;
  compact?: boolean;
}

function TurretSkillSlot({ turret, compact }: TurretSkillSlotProps) {
  const turretDef = getTurretById(turret.definitionId as 'arrow' | 'cannon' | 'sniper' | 'tesla' | 'frost' | 'flame' | 'support' | 'poison');
  if (!turretDef) return null;

  const ability = turretDef.ability;
  const cooldown = turret.specialCooldown || 0;
  const maxCooldown = ability.cooldown || 900;
  const cooldownPercent = cooldown / maxCooldown;
  const isReady = cooldown === 0;
  const icon = getAbilityIcon(ability.effect.type);
  const turretIcon = TURRET_ICONS[turret.definitionId] || '🗼';

  return (
    <div class={styles.turretGroup}>
      {!compact && (
        <span class={styles.turretIcon}>{turretIcon}</span>
      )}
      <div
        class={`${styles.skillSlot} ${isReady ? styles.ready : ''}`}
        title={`${ability.name}: ${ability.description}`}
      >
        {/* Cooldown fill */}
        <div
          class={styles.cooldownFill}
          style={{ height: `${(1 - cooldownPercent) * 100}%` }}
        />
        {/* Ability icon */}
        <span class={styles.abilityIcon}>{icon}</span>
        {/* Cooldown text */}
        {!isReady && (
          <span class={styles.cooldownText}>
            {Math.ceil(cooldown / 30)}s
          </span>
        )}
      </div>
    </div>
  );
}
