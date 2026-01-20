import { signal } from '@preact/signals';
import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  ARTIFACT_DEFINITIONS,
  calculateArtifactCraftCost,
  type ArtifactDefinition,
  type ArtifactSlot,
} from '@arcade/sim-core';
import {
  craftingModalVisible,
  hideCraftingModal,
  hasArtifact,
  addArtifact as addArtifactToState,
  showErrorToast,
} from '../../state/index.js';
import { baseGold, playerMaterials } from '../../state/index.js';
import { craftArtifact } from '../../api/client.js';
import { Modal } from '../shared/Modal.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './CraftingModal.module.css';

// State signals
const activeSlotFilter = signal<ArtifactSlot | 'all'>('all');
const selectedArtifactId = signal<string | null>(null);
const crafting = signal<string | null>(null);
const craftSuccess = signal<string | null>(null);

// Slot icons
const SLOT_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  gadget: '🔧',
  book: '📖',
  special: '⭐',
};

// Material icons
const MATERIAL_ICONS: Record<string, string> = {
  adamantium: '🔩',
  vibranium: '💎',
  uru: '⚒️',
  darkforce: '🌑',
  cosmic_dust: '✨',
  mutant_dna: '🧬',
  pym_particles: '⚛️',
  extremis: '🧪',
  super_soldier_serum: '💉',
  boss_essence_streets: '🔥',
  boss_essence_science: '🔬',
  boss_essence_mutants: '☢️',
  boss_essence_cosmic: '🌌',
  boss_essence_mystic: '🔮',
  boss_essence_tech: '⚡',
  boss_essence_skill: '🎯',
};

// Slot filters config
const SLOT_FILTERS: { value: ArtifactSlot | 'all'; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '📦' },
  { value: 'weapon', label: 'Weapon', icon: '⚔️' },
  { value: 'armor', label: 'Armor', icon: '🛡️' },
  { value: 'accessory', label: 'Accessory', icon: '💍' },
  { value: 'gadget', label: 'Gadget', icon: '🔧' },
  { value: 'book', label: 'Book', icon: '📖' },
  { value: 'special', label: 'Special', icon: '⭐' },
];

// Material name formatting
const MATERIAL_NAMES: Record<string, string> = {
  adamantium: 'Adamantium',
  vibranium: 'Vibranium',
  uru: 'Uru',
  darkforce: 'Darkforce',
  cosmic_dust: 'Cosmic Dust',
  mutant_dna: 'Mutant DNA',
  pym_particles: 'Pym Particles',
  extremis: 'Extremis',
  super_soldier_serum: 'Super Soldier Serum',
  boss_essence_streets: 'Street Essence',
  boss_essence_science: 'Science Essence',
  boss_essence_mutants: 'Mutant Essence',
  boss_essence_cosmic: 'Cosmic Essence',
  boss_essence_mystic: 'Mystic Essence',
  boss_essence_tech: 'Tech Essence',
  boss_essence_skill: 'Skill Essence',
};

export function CraftingModal() {
  const { t, language } = useTranslation(['common', 'data']);
  const isVisible = craftingModalVisible.value;
  const slotFilter = activeSlotFilter.value;
  const gold = baseGold.value;
  const materials = playerMaterials.value;
  const currentlyCrafting = crafting.value;
  const selectedId = selectedArtifactId.value;
  const [showSuccess, setShowSuccess] = useState(false);

  // Get craftable artifacts
  const craftableArtifacts = ARTIFACT_DEFINITIONS.filter(
    (a) => a.source.type === 'craft'
  );

  // Apply slot filter
  const filteredArtifacts =
    slotFilter === 'all'
      ? craftableArtifacts
      : craftableArtifacts.filter((a) => a.slot === slotFilter);

  // Get selected artifact
  const selectedArtifact = filteredArtifacts.find((a) => a.id === selectedId) || null;

  // Auto-select first artifact when filter changes or modal opens
  useEffect(() => {
    if (isVisible && filteredArtifacts.length > 0) {
      if (!selectedId || !filteredArtifacts.find((a) => a.id === selectedId)) {
        selectedArtifactId.value = filteredArtifacts[0].id;
      }
    }
  }, [isVisible, filteredArtifacts, selectedId]);

  // Reset selection when modal closes
  useEffect(() => {
    if (!isVisible) {
      selectedArtifactId.value = null;
      craftSuccess.value = null;
    }
  }, [isVisible]);

  // Handle craft success animation
  useEffect(() => {
    if (craftSuccess.value) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        craftSuccess.value = null;
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [craftSuccess.value]);

  const canCraftArtifact = useCallback((artifact: ArtifactDefinition): boolean => {
    if (hasArtifact(artifact.id)) return false;

    const cost = calculateArtifactCraftCost(artifact.id);
    if (!cost) return false;

    if (gold < cost.gold) return false;

    for (const { material, amount } of cost.materials) {
      const playerAmount = materials[material] ?? 0;
      if (playerAmount < amount) return false;
    }

    return true;
  }, [gold, materials]);

  const handleCraft = async (artifactId: string) => {
    if (crafting.value) return;

    crafting.value = artifactId;

    try {
      const result = await craftArtifact({ artifactId });

      if (result.success && result.artifact) {
        addArtifactToState(result.artifact);
        craftSuccess.value = artifactId;

        if (result.newInventory) {
          baseGold.value = result.newInventory.gold;
          playerMaterials.value = result.newInventory.materials;
        }
      }
    } catch {
      showErrorToast('Crafting failed. Please try again.');
    } finally {
      crafting.value = null;
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedId) return;

    const currentIndex = filteredArtifacts.findIndex((a) => a.id === selectedId);

    if (e.key === 'ArrowDown' && currentIndex < filteredArtifacts.length - 1) {
      e.preventDefault();
      selectedArtifactId.value = filteredArtifacts[currentIndex + 1].id;
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      selectedArtifactId.value = filteredArtifacts[currentIndex - 1].id;
    } else if (e.key === 'Enter' && selectedArtifact && canCraftArtifact(selectedArtifact)) {
      e.preventDefault();
      handleCraft(selectedArtifact.id);
    }
  }, [selectedId, filteredArtifacts, selectedArtifact, canCraftArtifact]);

  useEffect(() => {
    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isVisible, handleKeyDown]);

  const getArtifactName = (artifactId: string, name: string, polishName: string) =>
    t(`data:artifacts.${artifactId}.name`, {
      defaultValue: language === 'pl' ? polishName : name,
    });

  return (
    <Modal
      visible={isVisible}
      title="Crafting"
      onClose={hideCraftingModal}
      class={styles.craftingModal}
      ariaLabel="Crafting Menu"
    >
      {/* Filters */}
      <div class={styles.filters}>
        {SLOT_FILTERS.map((f) => (
          <button
            key={f.value}
            class={`${styles.filterBtn} ${slotFilter === f.value ? styles.active : ''}`}
            onClick={() => (activeSlotFilter.value = f.value)}
          >
            <span class={styles.filterIcon}>{f.icon}</span>
            <span class={styles.filterLabel}>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Two-column content */}
      <div class={styles.craftingContent}>
        {/* Left panel - Recipe list */}
        <div class={styles.recipeListPanel}>
          {filteredArtifacts.length === 0 ? (
            <div class={styles.emptyList}>No recipes in this category</div>
          ) : (
            filteredArtifacts.map((artifact) => {
              const owned = hasArtifact(artifact.id);
              const canCraft = canCraftArtifact(artifact);
              const isSelected = selectedId === artifact.id;

              return (
                <button
                  key={artifact.id}
                  class={`${styles.recipeListItem} ${styles[artifact.rarity]} ${isSelected ? styles.selected : ''} ${owned ? styles.owned : ''} ${canCraft ? styles.canCraft : ''}`}
                  onClick={() => (selectedArtifactId.value = artifact.id)}
                  aria-selected={isSelected}
                >
                  <span class={styles.recipeListIcon}>
                    {SLOT_ICONS[artifact.slot] || '📦'}
                  </span>
                  <div class={styles.recipeListInfo}>
                    <span class={styles.recipeListName}>
                      {getArtifactName(artifact.id, artifact.name, artifact.polishName)}
                    </span>
                    <span class={styles.recipeListSlot}>
                      {t(`heroDetails.artifactSlots.${artifact.slot}`)}
                    </span>
                  </div>
                  {owned && <span class={styles.ownedBadgeSmall}>Owned</span>}
                </button>
              );
            })
          )}
        </div>

        {/* Right panel - Recipe details */}
        <div class={styles.detailPanel}>
          {!selectedArtifact ? (
            <div class={styles.emptyDetail}>
              <span class={styles.emptyIcon}>⚒️</span>
              <span>Select a recipe to view details</span>
            </div>
          ) : (
            <RecipeDetailView
              artifact={selectedArtifact}
              materials={materials}
              gold={gold}
              isOwned={hasArtifact(selectedArtifact.id)}
              canCraft={canCraftArtifact(selectedArtifact)}
              isCrafting={currentlyCrafting === selectedArtifact.id}
              showSuccess={showSuccess && craftSuccess.value === selectedArtifact.id}
              onCraft={() => handleCraft(selectedArtifact.id)}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

// Recipe detail view component
interface RecipeDetailViewProps {
  artifact: ArtifactDefinition;
  materials: Record<string, number>;
  gold: number;
  isOwned: boolean;
  canCraft: boolean;
  isCrafting: boolean;
  showSuccess: boolean;
  onCraft: () => void;
}

function RecipeDetailView({
  artifact,
  materials,
  gold,
  isOwned,
  canCraft,
  isCrafting,
  showSuccess,
  onCraft,
}: RecipeDetailViewProps) {
  const { t, language } = useTranslation(['common', 'data']);
  const cost = calculateArtifactCraftCost(artifact.id);
  const artifactName = t(`data:artifacts.${artifact.id}.name`, {
    defaultValue: language === 'pl' ? artifact.polishName : artifact.name,
  });
  const artifactDescription = t(`data:artifacts.${artifact.id}.description`, {
    defaultValue: artifact.description,
  });

  return (
    <>
      {/* Header with large icon */}
      <div class={`${styles.detailHeader} ${styles[artifact.rarity]}`}>
        <span class={styles.artifactIconLarge}>
          {SLOT_ICONS[artifact.slot] || '📦'}
        </span>
        <div class={styles.detailHeaderInfo}>
          <h3 class={styles.artifactName}>{artifactName}</h3>
          <div class={styles.artifactMeta}>
            <span class={`${styles.rarityTag} ${styles[artifact.rarity]}`}>
              {t(`rarity.${artifact.rarity}`)}
            </span>
            <span class={styles.slotTag}>{t(`heroDetails.artifactSlots.${artifact.slot}`)}</span>
          </div>
          <p class={styles.artifactDescription}>{artifactDescription}</p>
        </div>
      </div>

      {/* Effects section */}
      {artifact.effects && artifact.effects.length > 0 && (
        <div class={styles.effectsSection}>
          <h4 class={styles.sectionTitle}>Effects</h4>
          <div class={styles.effectsList}>
            {artifact.effects.map((effect, idx) => (
              <div key={idx} class={styles.effectTag}>
                {t(`data:artifacts.${artifact.id}.effects.${idx}`, {
                  defaultValue: effect.description || `${effect.stat}: +${effect.value}`,
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materials section */}
      {cost && (
        <div class={styles.materialsSection}>
          <h4 class={styles.sectionTitle}>Materials Required</h4>
          <div class={styles.materialsList}>
            {cost.materials.map(({ material, amount }) => {
              const owned = materials[material] ?? 0;
              const isMet = owned >= amount;
              const progressPercent = Math.min((owned / amount) * 100, 100);

              return (
                <div
                  key={material}
                  class={`${styles.materialRow} ${isMet ? styles.met : styles.notMet}`}
                >
                  <span class={styles.materialIndicator}>{isMet ? '✓' : '✗'}</span>
                  <span class={styles.materialIcon}>
                    {MATERIAL_ICONS[material] || '📦'}
                  </span>
                  <div class={styles.materialProgress}>
                    <div class={styles.materialHeader}>
                      <span class={styles.materialName}>
                        {MATERIAL_NAMES[material] || material}
                      </span>
                      <span class={styles.materialQuantity}>
                        {owned}/{amount}
                      </span>
                    </div>
                    <div class={styles.progressBarContainer}>
                      <div
                        class={`${styles.progressBar} ${isMet ? styles.complete : styles.incomplete}`}
                        style={{ width: `${progressPercent}%` }}
                        role="progressbar"
                        aria-valuenow={owned}
                        aria-valuemin={0}
                        aria-valuemax={amount}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gold cost */}
          <div class={`${styles.goldRow} ${gold >= cost.gold ? styles.met : styles.notMet}`}>
            <span class={styles.materialIndicator}>{gold >= cost.gold ? '✓' : '✗'}</span>
            <span class={styles.goldIcon}>🪙</span>
            <div class={styles.goldProgress}>
              <div class={styles.materialHeader}>
                <span class={styles.materialName}>Gold</span>
                <span class={styles.materialQuantity}>
                  {gold.toLocaleString()}/{cost.gold.toLocaleString()}
                </span>
              </div>
              <div class={styles.progressBarContainer}>
                <div
                  class={`${styles.progressBar} ${gold >= cost.gold ? styles.complete : styles.incomplete}`}
                  style={{ width: `${Math.min((gold / cost.gold) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Craft button */}
      <div class={styles.craftButtonContainer}>
        {isOwned ? (
          <div class={styles.ownedContainer}>
            <span class={styles.ownedBadgeLarge}>✓ Owned</span>
          </div>
        ) : (
          <button
            class={`${styles.craftBtn} ${canCraft ? styles.craftReady : ''} ${showSuccess ? styles.craftSuccess : ''}`}
            disabled={!canCraft || isCrafting}
            onClick={onCraft}
          >
            {showSuccess ? (
              <>
                <span class={styles.successIcon}>✓</span>
                Crafted!
              </>
            ) : isCrafting ? (
              <>
                <span class={styles.spinner} />
                Crafting...
              </>
            ) : canCraft ? (
              'Craft Artifact'
            ) : (
              'Missing Materials'
            )}
          </button>
        )}
        {showSuccess && <div class={styles.craftParticles} />}
      </div>
    </>
  );
}
