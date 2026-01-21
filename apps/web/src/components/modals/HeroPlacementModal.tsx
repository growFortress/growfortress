import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { ActiveHero } from '@arcade/sim-core';
import { HEROES } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  heroPlacementModalVisible,
  heroPlacementSlotIndex,
  hubHeroes,
  unlockedHeroIds,
  showErrorToast,
} from '../../state/index.js';
import { Modal } from '../shared/Modal.js';
import { HeroAvatar } from '../shared/HeroAvatar.js';
import styles from './HeroPlacementModal.module.css';

const FP_SCALE = 1 << 16;

function createHubHero(heroId: string, x: number, y: number): ActiveHero {
  return {
    definitionId: heroId,
    tier: 1,
    state: 'idle',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: Math.round(1.0 * FP_SCALE),
    mass: Math.round(1.0 * FP_SCALE),
    movementModifiers: [],
    currentHp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    lastAttackTick: 0,
    lastDeployTick: 0,
    skillCooldowns: {},
    buffs: [],
    equippedItems: [],
  };
}

export function HeroPlacementModal() {
  const { t } = useTranslation('common');
  const slotIndex = heroPlacementSlotIndex.value;
  const heroes = hubHeroes.value;

  const currentHero = slotIndex !== null ? heroes[slotIndex] : null;
  const usedHeroIds = useMemo(() => {
    if (slotIndex === null) return heroes.map((hero) => hero.definitionId);
    return heroes
      .filter((_, index) => index !== slotIndex)
      .map((hero) => hero.definitionId);
  }, [heroes, slotIndex]);

  const availableHeroes = useMemo(() => {
    const unlocked = new Set(unlockedHeroIds.value);
    return HEROES.filter((hero) => unlocked.has(hero.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [unlockedHeroIds.value]);

  const handleClose = (e: JSX.TargetedMouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      heroPlacementModalVisible.value = false;
      heroPlacementSlotIndex.value = null;
    }
  };

  const handleSelect = (heroId: string) => {
    if (slotIndex === null) return;
    const existingHero = heroes[slotIndex];
    if (!existingHero) {
      showErrorToast(t('heroPlacement.slotMissing'));
      return;
    }

    const updatedHero = createHubHero(heroId, existingHero.x, existingHero.y);
    const nextHeroes = heroes.map((hero, index) =>
      index === slotIndex ? updatedHero : hero
    );

    hubHeroes.value = nextHeroes;
    heroPlacementModalVisible.value = false;
    heroPlacementSlotIndex.value = null;
  };

  return (
    <Modal
      visible={heroPlacementModalVisible.value}
      size="xlarge"
      onClick={handleClose}
    >
      <div class={styles.container}>
        <h2 class={styles.title}>{t('heroPlacement.title')}</h2>
        <p class={styles.subtitle}>
          {t('heroPlacement.subtitle', {
            slot: slotIndex !== null ? slotIndex + 1 : '?',
          })}
        </p>

        {availableHeroes.length === 0 ? (
          <div class={styles.emptyState}>{t('heroPlacement.noHeroes')}</div>
        ) : (
          <div class={styles.grid}>
            {availableHeroes.map((hero) => {
              const roleKey = hero.role === 'crowd_control' ? 'control' : hero.role;
              const isUsed = usedHeroIds.includes(hero.id);
              const isCurrent = currentHero?.definitionId === hero.id;
              const isDisabled = isUsed && !isCurrent;

              return (
                <button
                  key={hero.id}
                  class={`${styles.heroCard} ${isDisabled ? styles.disabled : ''}`}
                  onClick={() => !isDisabled && handleSelect(hero.id)}
                  disabled={isDisabled}
                >
                  <div class={styles.avatarWrap}>
                    <HeroAvatar heroId={hero.id} tier={1} size={70} />
                  </div>
                  <div class={styles.heroInfo}>
                    <div class={styles.heroName}>{hero.name}</div>
                    <div class={styles.heroMeta}>
                      <span>{t(`elements.${hero.class}`)}</span>
                      <span>•</span>
                      <span>{t(`roles.${roleKey}`)}</span>
                    </div>
                  </div>
                  {isUsed && !isCurrent && (
                    <span class={styles.usedBadge}>{t('heroPlacement.inUse')}</span>
                  )}
                  {isCurrent && (
                    <span class={styles.currentBadge}>{t('heroPlacement.current')}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <button
          class={styles.closeButton}
          onClick={() => {
            heroPlacementModalVisible.value = false;
            heroPlacementSlotIndex.value = null;
          }}
        >
          {t('heroPlacement.cancel')}
        </button>
      </div>
    </Modal>
  );
}
