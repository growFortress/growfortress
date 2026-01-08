import type { JSX } from 'preact';
import type { ActiveHero } from '@arcade/sim-core';
import {
  activeHeroes,
  maxHeroSlots,
  selectedHeroId,
  upgradePanelVisible,
  upgradeTarget,
  gamePhase,
  commandSelectedHeroId,
  selectHeroForCommand,
  cancelCommand,
} from '../../state/index.js';
import styles from './HeroPanel.module.css';

// Hero display names
const HERO_NAMES: Record<string, string> = {
  thunderlord: 'Thunderlord',
  iron_sentinel: 'Iron Sentinel',
  jade_titan: 'Jade Titan',
  spider_sentinel: 'Spider Sentinel',
  shield_captain: 'Shield Captain',
  scarlet_mage: 'Scarlet Mage',
  frost_archer: 'Frost Archer',
  flame_phoenix: 'Flame Phoenix',
  venom_assassin: 'Venom Assassin',
  arcane_sorcerer: 'Arcane Sorcerer',
  frost_giant: 'Frost Giant',
  cosmic_guardian: 'Cosmic Guardian',
};

// Hero icons (emoji placeholders)
const HERO_ICONS: Record<string, string> = {
  thunderlord: '⚡',
  iron_sentinel: '🤖',
  jade_titan: '💪',
  spider_sentinel: '🕷️',
  shield_captain: '🛡️',
  scarlet_mage: '🔮',
  frost_archer: '🏹',
  flame_phoenix: '🔥',
  venom_assassin: '🗡️',
  arcane_sorcerer: '📖',
  frost_giant: '🧊',
  cosmic_guardian: '🌟',
};

// Hero colors
const HERO_COLORS: Record<string, string> = {
  thunderlord: '#1e90ff',
  iron_sentinel: '#b22222',
  jade_titan: '#228b22',
  spider_sentinel: '#ff0000',
  shield_captain: '#0000cd',
  scarlet_mage: '#dc143c',
  frost_archer: '#4b0082',
  flame_phoenix: '#ff4500',
  venom_assassin: '#1a1a1a',
  arcane_sorcerer: '#4b0082',
  frost_giant: '#00ced1',
  cosmic_guardian: '#8b4513',
};

// State colors
const STATE_COLORS: Record<string, string> = {
  idle: '#888888',
  deploying: '#00ff00',
  combat: '#ff4444',
  returning: '#ffaa00',
  cooldown: '#4444ff',
  dead: '#333333',
  commanded: '#00ffff', // Cyan for player-commanded state
};

interface HeroPanelProps {
  compact?: boolean;
}

export function HeroPanel({ compact = false }: HeroPanelProps) {
  const heroes = activeHeroes.value;
  const slots = maxHeroSlots.value;

  const handleHeroClick = (hero: ActiveHero) => {
    const phase = gamePhase.value;

    // In hub (idle) - open the hero details modal
    if (phase === 'idle') {
      selectedHeroId.value = hero.definitionId;
      upgradeTarget.value = { type: 'hero', heroId: hero.definitionId };
      upgradePanelVisible.value = true;
      return;
    }

    // During combat waves - enter command mode
    if (phase === 'playing' || phase === 'boss_rush') {
      // Toggle selection - if already selected, deselect
      if (commandSelectedHeroId.value === hero.definitionId) {
        cancelCommand();
        return;
      }

      // Can only command heroes that are alive and not on cooldown
      if (hero.state !== 'dead' && hero.state !== 'cooldown') {
        selectHeroForCommand(hero.definitionId);
      }
    }
  };

  const renderHeroSlot = (index: number) => {
    const hero = heroes[index];

    if (!hero) {
      return (
        <div key={index} class={`${styles.heroSlot} ${styles.empty}`}>
          <div class={styles.emptyIcon}>+</div>
          <span class={styles.emptyText}>Empty</span>
        </div>
      );
    }

    const name = HERO_NAMES[hero.definitionId] || hero.definitionId;
    const icon = HERO_ICONS[hero.definitionId] || '?';
    const color = HERO_COLORS[hero.definitionId] || '#888888';
    const stateColor = STATE_COLORS[hero.state] || '#888888';
    const hpPercent = hero.maxHp > 0 ? (hero.currentHp / hero.maxHp) * 100 : 100;
    const isSelected = commandSelectedHeroId.value === hero.definitionId;

    return (
      <button
        key={hero.definitionId}
        class={`${styles.heroSlot} ${styles.filled} ${isSelected ? styles.selected : ''}`}
        style={{ '--hero-color': color } as JSX.CSSProperties}
        onClick={() => handleHeroClick(hero)}
      >
        <div class={styles.heroIcon}>{icon}</div>

        {!compact && (
          <>
            <div class={styles.heroName}>{name}</div>
            <div class={styles.tierBadge}>T{hero.tier}</div>
          </>
        )}

        {/* HP Bar */}
        <div class={styles.hpBar}>
          <div
            class={styles.hpFill}
            style={{
              width: `${hpPercent}%`,
              background: hpPercent > 60 ? '#00ff00' : hpPercent > 30 ? '#ffcc00' : '#ff4444',
            }}
          />
        </div>

        {/* State indicator */}
        <div
          class={styles.stateIndicator}
          style={{ background: stateColor }}
          title={hero.state}
        />

        {/* Cooldown overlay */}
        {hero.state === 'cooldown' && (
          <div class={styles.cooldownOverlay}>
            <span class={styles.cooldownText}>CD</span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div class={`${styles.heroPanel} ${compact ? styles.compact : ''}`}>
      <div class={styles.header}>
        <span class={styles.title}>Heroes</span>
        <span class={styles.count}>{heroes.length}/{slots}</span>
      </div>
      <div class={styles.heroGrid}>
        {Array.from({ length: slots }, (_, i) => renderHeroSlot(i))}
      </div>
    </div>
  );
}
