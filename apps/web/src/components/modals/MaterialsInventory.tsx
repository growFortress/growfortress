import { signal } from '@preact/signals';
import { MATERIAL_DEFINITIONS, type MaterialRarity } from '@arcade/sim-core';
import {
  playerMaterials,
  materialsModalVisible,
  hideMaterialsModal,
  uniqueMaterialsCount,
} from '../../state/materials.signals.js';
import { Modal } from '../shared/Modal.js';
import styles from './MaterialsInventory.module.css';

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  common: '#808080',
  uncommon: '#00ff00',
  rare: '#0088ff',
  epic: '#9932cc',
  legendary: '#ffd700',
};

// Material icons (emoji fallbacks)
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

// Rarity filter options
const RARITY_FILTERS: { value: MaterialRarity | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'epic', label: 'Epic' },
  { value: 'legendary', label: 'Legendary' },
];

// Active filter
const activeFilter = signal<MaterialRarity | 'all'>('all');

export function MaterialsInventory() {
  const isVisible = materialsModalVisible.value;
  const materials = playerMaterials.value;
  const filter = activeFilter.value;

  // Get total materials count
  const totalMaterials = Object.values(materials).reduce((sum, amount) => sum + amount, 0);

  // Filter materials by rarity
  const filteredMaterials = MATERIAL_DEFINITIONS.filter((mat) => {
    const amount = materials[mat.id] ?? 0;
    if (amount === 0) return false;
    if (filter === 'all') return true;
    return mat.rarity === filter;
  });

  return (
    <Modal
      visible={isVisible}
      title="Materials"
      onClose={hideMaterialsModal}
      class={styles.modalContent}
      ariaLabel="Materials Inventory"
    >
      <div class={styles.stats}>
        <div class={styles.stat}>
          <span class={styles.statLabel}>Total Materials</span>
          <span class={styles.statValue}>{totalMaterials}</span>
        </div>
        <div class={styles.stat}>
          <span class={styles.statLabel}>Unique Types</span>
          <span class={styles.statValue}>{uniqueMaterialsCount.value}</span>
        </div>
      </div>

      <div class={styles.filters}>
        {RARITY_FILTERS.map((f) => (
          <button
            key={f.value}
            class={`${styles.filterBtn} ${filter === f.value ? styles.active : ''}`}
            onClick={() => (activeFilter.value = f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredMaterials.length === 0 ? (
        <div class={styles.empty}>
          {Object.keys(materials).length === 0
            ? 'No materials collected yet. Defeat enemies and complete waves to find materials!'
            : `No ${filter} materials found.`}
        </div>
      ) : (
        <div class={styles.grid}>
          {filteredMaterials.map((material) => {
            const amount = materials[material.id] ?? 0;
            const color = RARITY_COLORS[material.rarity] || '#808080';
            const icon = MATERIAL_ICONS[material.id] || '📦';

            return (
              <div
                key={material.id}
                class={styles.materialCard}
                style={{ '--rarity-color': color } as Record<string, string>}
                title={`${material.polishName}\n${material.description}\n\n${material.lore}`}
              >
                <span class={styles.materialIcon}>{icon}</span>
                <span class={styles.materialName}>{material.polishName}</span>
                <span class={styles.materialAmount}>×{amount}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
