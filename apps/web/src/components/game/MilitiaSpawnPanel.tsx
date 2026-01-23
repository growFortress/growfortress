import { gamePhase, displayGold, gameState } from '../../state/index.js';
import { spawnMilitiaFn } from '../../state/gameActions.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { FP } from '@arcade/sim-core';
import styles from './MilitiaSpawnPanel.module.css';

// Militia type definitions (sci-fi themed)
const MILITIA_TYPES = {
  infantry: {
    nameKey: 'game:militia.infantry.name',
    icon: '🤖',
    hp: 50,
    damage: 15,
    cost: 10,  // Reduced from 30
    durationSeconds: 10,
    descriptionKey: 'game:militia.infantry.description',
  },
  archer: {
    nameKey: 'game:militia.archer.name',
    icon: '🎯',
    hp: 30,
    damage: 20,
    cost: 15,  // Reduced from 40
    durationSeconds: 10,
    descriptionKey: 'game:militia.archer.description',
  },
  shield_bearer: {
    nameKey: 'game:militia.shieldBearer.name',
    icon: '🦾',
    hp: 100,
    damage: 5,
    cost: 20,  // Reduced from 60
    durationSeconds: 15,
    descriptionKey: 'game:militia.shieldBearer.description',
  },
} as const;

type MilitiaType = keyof typeof MILITIA_TYPES;

// Fortress spawn position
const FORTRESS_SPAWN_X = FP.fromInt(3);
const FORTRESS_SPAWN_Y = FP.fromFloat(7.5);

export function MilitiaSpawnPanel() {
  const { t } = useTranslation('game');
  const phase = gamePhase.value;
  const gold = displayGold.value;
  const state = gameState.value;

  // Only show during gameplay
  if (phase === 'idle') {
    return null;
  }

  const militiaCount = state?.militiaCount ?? 0;
  const maxMilitiaCount = state?.maxMilitiaCount ?? 8;
  const militiaSpawnCooldowns = state?.militiaSpawnCooldowns ?? {};
  const currentTick = state?.tick ?? 0;

  const handleMilitiaClick = (type: MilitiaType) => {
    const militiaDef = MILITIA_TYPES[type];

    // Check if player can afford it
    if (gold < militiaDef.cost) {
      return;
    }

    // Check if at max count
    if (militiaCount >= maxMilitiaCount) {
      return;
    }

    // Check if on cooldown
    const cooldown = militiaSpawnCooldowns[type] ?? 0;
    if (cooldown > currentTick) {
      return;
    }

    // Spawn militia immediately at fortress position
    const fn = spawnMilitiaFn.value;
    if (fn) {
      fn(type, FORTRESS_SPAWN_X, FORTRESS_SPAWN_Y);
    }
  };

  const atMaxCount = militiaCount >= maxMilitiaCount;

  return (
    <div class={styles.panel}>
      <div class={styles.header}>
        <span class={styles.icon}>🤖</span>
        <span class={styles.title}>{t('militia.title')}</span>
        <span class={styles.militiaCounter}>
          {militiaCount}/{maxMilitiaCount}
        </span>
      </div>

      <div class={styles.militiaList}>
        {(Object.keys(MILITIA_TYPES) as MilitiaType[]).map((type) => {
          const militia = MILITIA_TYPES[type];
          const canAfford = gold >= militia.cost;
          const cooldown = militiaSpawnCooldowns[type] ?? 0;
          const onCooldown = cooldown > currentTick;
          const cooldownRemaining = onCooldown ? Math.ceil((cooldown - currentTick) / 30) : 0;
          const isDisabled = !canAfford || atMaxCount || onCooldown;

          return (
            <button
              key={type}
              class={`${styles.militiaButton} ${isDisabled ? styles.disabled : ''}`}
              onClick={() => handleMilitiaClick(type)}
              disabled={isDisabled}
              title={t(militia.descriptionKey)}
            >
              <span class={styles.militiaIcon}>{militia.icon}</span>
              <div class={styles.militiaInfo}>
                <span class={styles.militiaName}>{t(militia.nameKey)}</span>
                <div class={styles.militiaStats}>
                  <span class={`${styles.stat} ${styles.statHp}`}>
                    ♥ {militia.hp}
                  </span>
                  <span class={`${styles.stat} ${styles.statDmg}`}>
                    ⚔ {militia.damage}
                  </span>
                </div>
                <span class={styles.militiaCost}>
                  <span class={styles.goldIcon}>🪙</span>
                  {militia.cost}
                </span>
                {onCooldown && (
                  <span class={styles.cooldownBadge}>
                    ⏱ {cooldownRemaining}s
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {atMaxCount && (
        <div class={styles.hint}>
          <span class={styles.hintIcon}>⚠️</span>
          Max militia reached ({maxMilitiaCount})
        </div>
      )}
    </div>
  );
}
