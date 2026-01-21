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
import { useTranslation } from '../../i18n/useTranslation.js';
import { Tooltip } from '../shared/Tooltip.js';
import styles from './HeroPanel.module.css';

// Unit display names
const HERO_NAMES: Record<string, string> = {
  storm: 'Unit-7 "Storm"',
  forge: 'Unit-3 "Forge"',
  titan: 'Unit-1 "Titan"',
  vanguard: 'Unit-0 "Vanguard"',
  rift: 'Unit-9 "Rift"',
  frost_unit: 'Unit-5 "Frost"',
  // Legacy IDs for backwards compatibility
  thunderlord: 'Unit-7 "Storm"',
  iron_sentinel: 'Unit-3 "Forge"',
  jade_titan: 'Unit-1 "Titan"',
  spider_sentinel: 'Unit-4 "Spider"',
  shield_captain: 'Unit-0 "Vanguard"',
  scarlet_mage: 'Unit-9 "Rift"',
  frost_archer: 'Unit-5 "Frost"',
  flame_phoenix: 'Unit-8 "Phoenix"',
  venom_assassin: 'Unit-6 "Venom"',
  arcane_sorcerer: 'Unit-2 "Arcane"',
  frost_giant: 'Unit-11 "Glacier"',
  cosmic_guardian: 'Unit-10 "Cosmos"',
};

// Unit icons (emoji placeholders)
const HERO_ICONS: Record<string, string> = {
  storm: '⚡',
  forge: '🤖',
  titan: '💪',
  vanguard: '🛡️',
  rift: '🔮',
  frost_unit: '🏹',
  // Legacy IDs
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

// Unit colors
const HERO_COLORS: Record<string, string> = {
  storm: '#9932cc',
  forge: '#00f0ff',
  titan: '#228b22',
  vanguard: '#228b22',
  rift: '#ff4500',
  frost_unit: '#00bfff',
  // Legacy IDs
  thunderlord: '#9932cc',
  iron_sentinel: '#00f0ff',
  jade_titan: '#228b22',
  spider_sentinel: '#ff0000',
  shield_captain: '#228b22',
  scarlet_mage: '#ff4500',
  frost_archer: '#00bfff',
  flame_phoenix: '#ff4500',
  venom_assassin: '#1a1a1a',
  arcane_sorcerer: '#4b0082',
  frost_giant: '#00ced1',
  cosmic_guardian: '#8b4513',
};

// State colors
const STATE_COLORS: Record<string, string> = {
  idle: '#888888',
  combat: '#ff4444',
  commanded: '#00ffff',
};

// State name translation keys (moved outside component to avoid recreation)
const STATE_NAME_KEYS: Record<string, string> = {
  idle: 'heroPanel.state.idle',
  combat: 'heroPanel.state.combat',
  commanded: 'heroPanel.state.commanded',
} as const;

// Cached slot arrays to avoid Array.from() on every render
const SLOT_ARRAYS_CACHE = new Map<number, number[]>();
function getSlotIndices(count: number): number[] {
  let arr = SLOT_ARRAYS_CACHE.get(count);
  if (!arr) {
    arr = Array.from({ length: count }, (_, i) => i);
    SLOT_ARRAYS_CACHE.set(count, arr);
  }
  return arr;
}

// Cached HP color thresholds
function getHpColor(percent: number): string {
  if (percent > 60) return '#00ff00';
  if (percent > 30) return '#ffcc00';
  return '#ff4444';
}

interface HeroPanelProps {
  compact?: boolean;
}

export function HeroPanel({ compact = false }: HeroPanelProps) {
  const { t } = useTranslation('game');
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

      // Heroes can always be commanded (they are immortal)
      selectHeroForCommand(hero.definitionId);
    }
  };

  const renderHeroSlot = (index: number) => {
    const hero = heroes[index];

    if (!hero) {
      return (
        <div
          key={index}
          class={`${styles.heroSlot} ${styles.empty}`}
          role="listitem"
          aria-label={t('heroPanel.slotEmpty', { index: index + 1 })}
        >
          <div class={styles.emptyIcon} aria-hidden="true">+</div>
          <span class={styles.emptyText}>{t('heroPanel.empty')}</span>
        </div>
      );
    }

    const name = HERO_NAMES[hero.definitionId] || hero.definitionId;
    const icon = HERO_ICONS[hero.definitionId] || '?';
    const color = HERO_COLORS[hero.definitionId] || '#888888';
    const stateColor = STATE_COLORS[hero.state] || '#888888';
    const hpPercent = hero.maxHp > 0 ? (hero.currentHp / hero.maxHp) * 100 : 100;
    const isSelected = commandSelectedHeroId.value === hero.definitionId;
    const stateKey = STATE_NAME_KEYS[hero.state] || hero.state;
    const stateName = t(stateKey);
    const hpLevelKey = hpPercent > 60 ? 'heroPanel.healthy' : hpPercent > 30 ? 'heroPanel.wounded' : 'heroPanel.critical';
    const hpLevel = t(hpLevelKey);

    // Build accessible description
    const accessibleLabel = `${name}, Tier ${hero.tier}, ${t('heroPanel.lifePercent', { percent: Math.round(hpPercent) })} (${hpLevel}), status: ${stateName}${isSelected ? t('heroPanel.selected') : ''}`;

    return (
      <button
        key={hero.definitionId}
        class={`${styles.heroSlot} ${styles.filled} ${isSelected ? styles.selected : ''}`}
        style={{ '--hero-color': color } as JSX.CSSProperties}
        onClick={() => handleHeroClick(hero)}
        aria-label={accessibleLabel}
        aria-pressed={isSelected}
        aria-disabled={false}
        role="listitem"
      >
        <div class={styles.heroIcon} aria-hidden="true">{icon}</div>

        {!compact && (
          <>
            <div class={styles.heroName}>{name}</div>
            <div class={styles.tierBadge} aria-hidden="true">T{hero.tier}</div>
          </>
        )}

        {/* HP Bar */}
        <div
          class={styles.hpBar}
          role="progressbar"
          aria-label={t('heroPanel.lifeOf', { name })}
          aria-valuenow={Math.round(hpPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            class={styles.hpFill}
            style={{
              width: `${hpPercent}%`,
              background: getHpColor(hpPercent),
            }}
          />
        </div>
        {/* Text percentage for accessibility */}
        <span class={styles.srOnly} style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
          {t('heroPanel.lifePercent', { percent: Math.round(hpPercent) })}
        </span>

        {/* State indicator */}
        <div
          class={styles.stateIndicator}
          style={{ background: stateColor }}
          title={stateName}
          aria-hidden="true"
        />

      </button>
    );
  };

  const isIdle = gamePhase.value === 'idle';

  return (
    <div
      class={`${styles.heroPanel} ${compact ? styles.compact : ''}`}
      role="region"
      aria-label={t('heroPanel.unitsPanel')}
    >
      <div class={styles.header}>
        <span class={styles.title} id="heroes-title">{t('heroPanel.units')}</span>
        <span class={styles.count} aria-label={t('heroPanel.slotsOccupied', { count: heroes.length, total: slots })}>
          {heroes.length}/{slots}
        </span>
      </div>
      <div
        class={styles.heroGrid}
        role="list"
        aria-labelledby="heroes-title"
      >
        {getSlotIndices(slots).map((i) => {
          const slot = renderHeroSlot(i);
          // In idle mode, wrap occupied slots with tooltip
          if (isIdle && heroes[i]) {
            return (
              <Tooltip key={i} content={t('heroPanel.clickToManage')} position="top">
                {slot}
              </Tooltip>
            );
          }
          return slot;
        })}
      </div>
      {/* Hint for idle mode */}
      {isIdle && heroes.length > 0 && !compact && (
        <p class={styles.hint}>
          {t('heroPanel.clickForDetails')}
        </p>
      )}
    </div>
  );
}
