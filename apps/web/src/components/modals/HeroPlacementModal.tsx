import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import type { ActiveHero } from '@arcade/sim-core';
import { HEROES } from '@arcade/sim-core';
import { useTranslation } from '../../i18n/useTranslation.js';
import { updateBuildPresets } from '../../api/client.js';
import {
  heroPlacementModalVisible,
  heroPlacementSlotIndex,
  hubHeroes,
  unlockedHeroIds,
  purchasedHeroSlots,
  buildPresets,
  activePresetId,
  selectedFortressClass,
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

// Formation position helper - same as in actions.ts
function getFormationPosition(index: number, totalCount: number): { xOffset: number; yOffset: number } {
  const centerY = 7.5;
  const SLOT_X = [4, 7, 10]; // Same as turret offsetX values

  switch (totalCount) {
    case 1:
      return { xOffset: SLOT_X[0], yOffset: centerY };
    case 2:
      return [
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },
      ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
    case 3:
      return [
        { xOffset: SLOT_X[1], yOffset: centerY },
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },
      ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
    case 4:
      return [
        { xOffset: SLOT_X[1], yOffset: centerY },
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },
        { xOffset: SLOT_X[0], yOffset: centerY },
      ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
    case 5:
      return [
        { xOffset: SLOT_X[2], yOffset: centerY },
        { xOffset: SLOT_X[1], yOffset: centerY - 2 },
        { xOffset: SLOT_X[1], yOffset: centerY + 2 },
        { xOffset: SLOT_X[0], yOffset: centerY - 2 },
        { xOffset: SLOT_X[0], yOffset: centerY + 2 },
      ][index] || { xOffset: SLOT_X[0], yOffset: centerY };
    default: {
      const row = Math.floor(index / 3);
      const col = index % 3;
      const ySpread = 2.5;
      const yPositions = [centerY - ySpread, centerY, centerY + ySpread];
      return {
        xOffset: SLOT_X[Math.min(row, 2)],
        yOffset: yPositions[col] || centerY
      };
    }
  }
}

export function HeroPlacementModal() {
  const { t } = useTranslation('common');
  const slotIndex = heroPlacementSlotIndex.value;
  const heroes = hubHeroes.value;

  const currentHero = slotIndex !== null ? heroes[slotIndex] : null;
  const usedHeroIds = useMemo(() => {
    if (slotIndex === null) return heroes.filter(h => h !== null).map((hero) => hero!.definitionId);
    return heroes
      .filter((hero, index) => hero !== null && index !== slotIndex)
      .map((hero) => hero!.definitionId);
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

  const handleSelect = async (heroId: string) => {
    if (slotIndex === null) return;

    const existingHero = heroes[slotIndex];
    const maxSlots = purchasedHeroSlots.value;

    // Get formation position for this slot
    const formation = getFormationPosition(slotIndex, maxSlots);
    const heroX = 2 + formation.xOffset;
    const heroY = formation.yOffset;

    // Use existing hero position if available, otherwise use formation position
    const x = existingHero ? existingHero.x : Math.round(heroX * FP_SCALE);
    const y = existingHero ? existingHero.y : Math.round(heroY * FP_SCALE);

    const updatedHero = createHubHero(heroId, x, y);

    // If slot was empty, need to ensure array is long enough
    const nextHeroes = [...heroes];
    while (nextHeroes.length <= slotIndex) {
      nextHeroes.push(null);
    }
    nextHeroes[slotIndex] = updatedHero;

    hubHeroes.value = nextHeroes;
    heroPlacementModalVisible.value = false;
    heroPlacementSlotIndex.value = null;

    // Save to server - update active preset's startingHeroes
    const presets = buildPresets.value;
    const activeId = activePresetId.value;
    const fortressClass = selectedFortressClass.value;

    // Get hero IDs from updated hubHeroes
    const heroIds = nextHeroes
      .filter((h): h is ActiveHero => h !== null)
      .map(h => h.definitionId);

    if (activeId) {
      // Update existing active preset
      const updatedPresets = presets.map(preset =>
        preset.id === activeId
          ? { ...preset, startingHeroes: heroIds }
          : preset
      );
      try {
        const response = await updateBuildPresets({
          buildPresets: updatedPresets,
          activePresetId: activeId,
        });
        buildPresets.value = response.buildPresets;
        activePresetId.value = response.activePresetId;
      } catch (error) {
        console.error('Failed to save hero changes:', error);
      }
    } else if (fortressClass) {
      // Create a new default preset if none exists
      const newPreset = {
        id: `default-${Date.now()}`,
        name: 'Default',
        fortressClass,
        startingHeroes: heroIds,
        startingTurrets: presets[0]?.startingTurrets || [],
      };
      try {
        const response = await updateBuildPresets({
          buildPresets: [...presets, newPreset],
          activePresetId: newPreset.id,
        });
        buildPresets.value = response.buildPresets;
        activePresetId.value = response.activePresetId;
      } catch (error) {
        console.error('Failed to create preset:', error);
      }
    }
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
