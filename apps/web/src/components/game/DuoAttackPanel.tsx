/**
 * DuoAttackPanel - Shows available duo-attacks and their cooldowns
 *
 * Displays duo-attacks that are possible with the current hero composition.
 */

import { useMemo } from 'preact/hooks';
import {
  getAvailableDuoAttacks,
  getDuoAttackCooldownRemaining,
  getHeroById,
  type DuoAttackDefinition,
} from '@arcade/sim-core';
import { activeHeroes, gameState, gamePhase } from '../../state/index.js';
import styles from './DuoAttackPanel.module.css';

// Icons for duo-attack types based on effects
const DUO_ATTACK_ICONS: Record<string, string> = {
  thunder_guard: '⚡🛡️',
  void_storm: '🌀⚡',
  frozen_inferno: '❄️🔥',
  phase_strike: '👻⚔️',
  cryo_artillery: '🎯❄️',
  reality_tear: '🌌💥',
  // New duo-attacks
  inferno_storm: '🔥⚡',
  glacier_shield: '🧊🛡️',
  phantom_frost: '👻❄️',
  tech_void: '⚙️🌀',
  nature_fire: '🌡️💥', // Thermal Paradox
  plasma_phase: '💫👻',
};

interface DuoAttackPanelProps {
  compact?: boolean;
}

export function DuoAttackPanel({ compact = false }: DuoAttackPanelProps) {
  const heroes = activeHeroes.value;
  const state = gameState.value;
  const phase = gamePhase.value;

  // Only show during gameplay
  if (phase === 'idle' || heroes.length < 2 || !state) {
    return null;
  }

  // Get available duo-attacks for current hero composition
  const heroIds = heroes.map((h) => h.definitionId);
  const availableDuoAttacks = useMemo(() => {
    return getAvailableDuoAttacks(heroIds);
  }, [heroIds.join(',')]);

  if (availableDuoAttacks.length === 0) {
    return null;
  }

  return (
    <div class={`${styles.panel} ${compact ? styles.compact : ''}`}>
      {!compact && (
        <div class={styles.header}>
          <span class={styles.title}>Duo Attacks</span>
          <span class={styles.count}>{availableDuoAttacks.length}</span>
        </div>
      )}
      <div class={styles.duoList}>
        {availableDuoAttacks.map((duoAttack) => (
          <DuoAttackSlot
            key={duoAttack.id}
            duoAttack={duoAttack}
            currentTick={state.tick}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

interface DuoAttackSlotProps {
  duoAttack: DuoAttackDefinition;
  currentTick: number;
  compact?: boolean;
}

function DuoAttackSlot({ duoAttack, currentTick, compact }: DuoAttackSlotProps) {
  const cooldownRemaining = getDuoAttackCooldownRemaining(duoAttack.id, currentTick);
  const cooldownPercent = cooldownRemaining / duoAttack.cooldownTicks;
  const isReady = cooldownRemaining === 0;

  const hero1 = getHeroById(duoAttack.heroes[0]);
  const hero2 = getHeroById(duoAttack.heroes[1]);

  const icon = DUO_ATTACK_ICONS[duoAttack.id] || '⚔️⚔️';

  // Format cooldown as seconds
  const cooldownSeconds = Math.ceil(cooldownRemaining / 30);

  return (
    <div
      class={`${styles.slot} ${isReady ? styles.ready : styles.onCooldown}`}
      title={`${duoAttack.name}: ${duoAttack.description}\n${hero1?.name || duoAttack.heroes[0]} + ${hero2?.name || duoAttack.heroes[1]}`}
    >
      {/* Cooldown fill */}
      <div
        class={styles.cooldownFill}
        style={{ width: `${cooldownPercent * 100}%` }}
      />

      {/* Content */}
      <div class={styles.content}>
        {/* Icon */}
        <span class={styles.icon}>{icon}</span>

        {!compact && (
          <div class={styles.info}>
            <span class={styles.name}>{duoAttack.name}</span>
            <span class={styles.heroes}>
              {hero1?.name.slice(0, 3) || '???'} + {hero2?.name.slice(0, 3) || '???'}
            </span>
          </div>
        )}

        {/* Cooldown text */}
        {!isReady && (
          <span class={styles.cooldownText}>{cooldownSeconds}s</span>
        )}

        {/* Ready indicator */}
        {isReady && <span class={styles.readyIndicator}>!</span>}
      </div>
    </div>
  );
}

export default DuoAttackPanel;
