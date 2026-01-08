import { signal } from '@preact/signals';
import {
  artifactsModalVisible,
  hideArtifactsModal,
  artifactsWithDefs,
  itemsWithDefs,
  unequippedArtifacts,
  showCraftingModal,
} from '../../state/index.js';
import styles from './ArtifactsModal.module.css';

// Active tab
const activeTab = signal<'artifacts' | 'items'>('artifacts');

// Artifact slot icons
const SLOT_ICONS: Record<string, string> = {
  weapon: '⚔️',
  armor: '🛡️',
  accessory: '💍',
  gadget: '🔧',
  book: '📖',
  special: '⭐',
};

// Item icons
const ITEM_ICONS: Record<string, string> = {
  health_potion: '🧪',
  damage_boost: '⚡',
  speed_elixir: '💨',
  shield_charm: '🔮',
  xp_tome: '📚',
  crit_crystal: '💎',
};

export function ArtifactsModal() {
  const isVisible = artifactsModalVisible.value;
  const tab = activeTab.value;
  const artifacts = artifactsWithDefs.value;
  const items = itemsWithDefs.value;
  const unequipped = unequippedArtifacts.value;

  if (!isVisible) return null;

  const equippedArtifacts = artifacts.filter((a) => a.equippedToHeroId);

  const handleOverlayClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains(styles.overlay)) {
      hideArtifactsModal();
    }
  };

  const handleCraftClick = () => {
    hideArtifactsModal();
    showCraftingModal();
  };

  return (
    <div class={styles.overlay} onClick={handleOverlayClick}>
      <div class={styles.modal}>
        <div class={styles.header}>
          <h2 class={styles.title}>Inventory</h2>
          <button class={styles.closeBtn} onClick={hideArtifactsModal}>
            ×
          </button>
        </div>

        <div class={styles.tabs}>
          <button
            class={`${styles.tab} ${tab === 'artifacts' ? styles.active : ''}`}
            onClick={() => (activeTab.value = 'artifacts')}
          >
            Artifacts ({artifacts.length})
          </button>
          <button
            class={`${styles.tab} ${tab === 'items' ? styles.active : ''}`}
            onClick={() => (activeTab.value = 'items')}
          >
            Items ({items.reduce((sum, i) => sum + i.amount, 0)})
          </button>
        </div>

        {tab === 'artifacts' && (
          <>
            {equippedArtifacts.length > 0 && (
              <div class={styles.section}>
                <div class={styles.sectionTitle}>
                  Equipped <span class={styles.count}>{equippedArtifacts.length}</span>
                </div>
                <div class={styles.grid}>
                  {equippedArtifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      class={`${styles.artifactCard} ${styles.equipped} ${styles[artifact.definition.rarity]}`}
                    >
                      <span class={styles.equippedBadge}>✓</span>
                      <span class={styles.artifactIcon}>
                        {SLOT_ICONS[artifact.definition.slot] || '📦'}
                      </span>
                      <span class={styles.artifactName}>{artifact.definition.polishName}</span>
                      <span class={styles.artifactSlot}>{artifact.definition.slot}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div class={styles.section}>
              <div class={styles.sectionTitle}>
                Available <span class={styles.count}>{unequipped.length}</span>
              </div>
              {unequipped.length === 0 ? (
                <div class={styles.empty}>
                  No artifacts available. Craft or find artifacts during gameplay!
                </div>
              ) : (
                <div class={styles.grid}>
                  {unequipped.map((artifact) => (
                    <div
                      key={artifact.id}
                      class={`${styles.artifactCard} ${styles[artifact.definition.rarity]}`}
                    >
                      <span class={styles.artifactIcon}>
                        {SLOT_ICONS[artifact.definition.slot] || '📦'}
                      </span>
                      <span class={styles.artifactName}>{artifact.definition.polishName}</span>
                      <span class={styles.artifactSlot}>{artifact.definition.slot}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button class={styles.craftButton} onClick={handleCraftClick}>
              ⚒️ Craft Artifacts
            </button>
          </>
        )}

        {tab === 'items' && (
          <div class={styles.section}>
            {items.length === 0 ? (
              <div class={styles.empty}>
                No items in inventory. Buy items from the shop!
              </div>
            ) : (
              <div class={styles.grid}>
                {items.map((item) => (
                  <div key={item.itemId} class={styles.itemCard}>
                    <span class={styles.itemIcon}>
                      {ITEM_ICONS[item.itemId] || '📦'}
                    </span>
                    <div class={styles.itemInfo}>
                      <div class={styles.itemName}>{item.definition.polishName}</div>
                      <div class={styles.itemDesc}>{item.definition.description}</div>
                    </div>
                    <span class={styles.itemAmount}>×{item.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
