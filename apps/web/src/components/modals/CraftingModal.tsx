import { signal } from '@preact/signals';
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
import styles from './CraftingModal.module.css';

// Filter state
const activeSlotFilter = signal<ArtifactSlot | 'all'>('all');
const crafting = signal<string | null>(null);

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
};

// Slot filters
const SLOT_FILTERS: { value: ArtifactSlot | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'gadget', label: 'Gadget' },
  { value: 'book', label: 'Book' },
  { value: 'special', label: 'Special' },
];

export function CraftingModal() {
  const isVisible = craftingModalVisible.value;
  const slotFilter = activeSlotFilter.value;
  const gold = baseGold.value;
  const materials = playerMaterials.value;
  const currentlyCrafting = crafting.value;

  if (!isVisible) return null;

  // Get craftable artifacts
  const craftableArtifacts = ARTIFACT_DEFINITIONS.filter(
    (a) => a.source.type === 'craft'
  );

  // Apply slot filter
  const filteredArtifacts =
    slotFilter === 'all'
      ? craftableArtifacts
      : craftableArtifacts.filter((a) => a.slot === slotFilter);

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains(styles.overlay)) {
      hideCraftingModal();
    }
  };

  const canCraftArtifact = (artifact: ArtifactDefinition): boolean => {
    if (hasArtifact(artifact.id)) return false;

    const cost = calculateArtifactCraftCost(artifact.id);
    if (!cost) return false;

    if (gold < cost.gold) return false;

    for (const { material, amount } of cost.materials) {
      const playerAmount = materials[material] ?? 0;
      if (playerAmount < amount) return false;
    }

    return true;
  };

  const handleCraft = async (artifactId: string) => {
    if (crafting.value) return;

    crafting.value = artifactId;

    try {
      const result = await craftArtifact({ artifactId });

      if (result.success && result.artifact) {
        addArtifactToState(result.artifact);

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

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.modal}>
        <div class={styles.header}>
          <h2 class={styles.title}>⚒️ Crafting</h2>
          <button class={styles.closeBtn} onClick={hideCraftingModal}>
            ×
          </button>
        </div>

        <div class={styles.filters}>
          {SLOT_FILTERS.map((f) => (
            <button
              key={f.value}
              class={`${styles.filterBtn} ${slotFilter === f.value ? styles.active : ''}`}
              onClick={() => (activeSlotFilter.value = f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredArtifacts.length === 0 ? (
          <div class={styles.empty}>No craftable artifacts in this category.</div>
        ) : (
          <div class={styles.recipeList}>
            {filteredArtifacts.map((artifact) => {
              const cost = calculateArtifactCraftCost(artifact.id);
              const owned = hasArtifact(artifact.id);
              const canCraft = canCraftArtifact(artifact);
              const isCrafting = currentlyCrafting === artifact.id;

              return (
                <div
                  key={artifact.id}
                  class={`${styles.recipeCard} ${styles[artifact.rarity]} ${owned ? styles.owned : ''} ${canCraft ? styles.canCraft : ''}`}
                >
                  <span class={styles.recipeIcon}>
                    {SLOT_ICONS[artifact.slot] || '📦'}
                  </span>

                  <div class={styles.recipeInfo}>
                    <div class={styles.recipeName}>{artifact.polishName}</div>
                    <div class={styles.recipeDesc}>{artifact.description}</div>

                    {cost && (
                      <>
                        <div class={styles.requirements}>
                          {cost.materials.map(({ material, amount }) => {
                            const playerAmount = materials[material] ?? 0;
                            const met = playerAmount >= amount;

                            return (
                              <div
                                key={material}
                                class={`${styles.requirement} ${met ? styles.met : styles.notMet}`}
                              >
                                <span class={styles.reqIcon}>
                                  {MATERIAL_ICONS[material] || '📦'}
                                </span>
                                {playerAmount}/{amount}
                              </div>
                            );
                          })}
                        </div>

                        <div class={styles.costs}>
                          <div class={styles.cost}>
                            <span class={styles.costIcon}>🪙</span>
                            <span style={{ color: gold >= cost.gold ? '#22c55e' : '#ef4444' }}>
                              {cost.gold}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {owned ? (
                    <span class={styles.ownedBadge}>Owned</span>
                  ) : (
                    <button
                      class={styles.craftBtn}
                      disabled={!canCraft || isCrafting}
                      onClick={() => handleCraft(artifact.id)}
                    >
                      {isCrafting ? 'Crafting...' : 'Craft'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
