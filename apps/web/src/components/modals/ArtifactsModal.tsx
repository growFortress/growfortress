import { signal } from '@preact/signals';
import {
  artifactsModalVisible,
  hideArtifactsModal,
  artifactsWithDefs,
  itemsWithDefs,
  unequippedArtifacts,
  showCraftingModal,
  powerState,
  baseGold,
  updateItemTier,
  updateTotalPower,
  displayGold,
  showErrorToast,
} from '../../state/index.js';
import {
  ITEM_TIER_CONFIG,
  getNextItemTier,
  isMaxItemTier,
  type ItemTier,
} from '@arcade/sim-core';
import { useState } from 'preact/hooks';
import { Modal } from '../shared/Modal.js';
import { getAccessToken } from '../../api/auth.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './ArtifactsModal.module.css';

// Timeout for async operations (10 seconds)
const ASYNC_TIMEOUT_MS = 10000;

/**
 * Wraps a promise with a timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Przekroczono limit czasu operacji')), timeoutMs)
    ),
  ]);
}

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

// API functions
async function upgradeItem(itemId: string): Promise<{
  success: boolean;
  newTier?: ItemTier;
  goldSpent?: number;
  newGold?: number;
  newTotalPower?: number;
  error?: string;
}> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch('/api/v1/power/item', {
    method: 'POST',
    headers,
    body: JSON.stringify({ itemId }),
  });
  return response.json();
}

export function ArtifactsModal() {
  const { t, language } = useTranslation(['common', 'data']);
  const isVisible = artifactsModalVisible.value;
  const getArtifactName = (artifactId: string, name: string, polishName: string) =>
    t(`data:artifacts.${artifactId}.name`, {
      defaultValue: language === 'pl' ? polishName : name,
    });
  const tab = activeTab.value;
  const artifacts = artifactsWithDefs.value;
  const items = itemsWithDefs.value;
  const unequipped = unequippedArtifacts.value;

  const equippedArtifacts = artifacts.filter((a) => a.equippedToHeroId);

  const gold = displayGold.value;
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  const handleUpgradeItem = async (itemId: string) => {
    setLoadingItem(itemId);
    try {
      const result = await withTimeout(upgradeItem(itemId), ASYNC_TIMEOUT_MS);
      if (result.success && result.newTier) {
        updateItemTier(itemId, result.newTier);
        if (result.newGold !== undefined) baseGold.value = result.newGold;
        if (result.newTotalPower !== undefined) updateTotalPower(result.newTotalPower);
      } else if (result.error) {
        showErrorToast(result.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nie udało się ulepszyć przedmiotu';
      showErrorToast(message);
    } finally {
      setLoadingItem(null);
    }
  };

  const getTierColor = (tier: ItemTier): string => {
    const colorHex = ITEM_TIER_CONFIG[tier].color.toString(16).padStart(6, '0');
    return `#${colorHex}`;
  };

  const handleCraftClick = () => {
    hideArtifactsModal();
    showCraftingModal();
  };

  return (
    <Modal
      visible={isVisible}
      title="Inventory"
      onClose={hideArtifactsModal}
      class={styles.modalContent}
      ariaLabel="Player Inventory"
    >
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
                    <span class={styles.artifactName}>
                      {getArtifactName(
                        artifact.definition.id,
                        artifact.definition.name,
                        artifact.definition.polishName
                      )}
                    </span>
                    <span class={styles.artifactSlot}>
                      {t(`heroDetails.artifactSlots.${artifact.definition.slot}`)}
                    </span>
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
                    <span class={styles.artifactName}>
                      {getArtifactName(
                        artifact.definition.id,
                        artifact.definition.name,
                        artifact.definition.polishName
                      )}
                    </span>
                    <span class={styles.artifactSlot}>
                      {t(`heroDetails.artifactSlots.${artifact.definition.slot}`)}
                    </span>
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
                    
                    {/* Item Tier & Upgrade */}
                    {(() => {
                      const itemState = powerState.value.itemTiers.find(i => i.itemId === item.itemId);
                      const currentTier = itemState?.tier || 'common';
                      const tierConfig = ITEM_TIER_CONFIG[currentTier];
                      const nextTier = getNextItemTier(currentTier);
                      const isMaxed = isMaxItemTier(currentTier);
                      const cost = tierConfig.upgradeCost;
                      const canAfford = cost !== null && gold >= cost;

                      return (
                        <div class={styles.itemTierSection}>
                          <div class={styles.tierInfo}>
                            <span class={styles.tierName} style={{ color: getTierColor(currentTier) }}>
                              {tierConfig.name}
                            </span>
                            <span class={styles.tierBonus}>x{tierConfig.effectMultiplier.toFixed(2)}</span>
                          </div>
                          
                          {nextTier && (
                            <div class={styles.upgradeInfo}>
                              <span class={styles.nextBonus}>→ x{ITEM_TIER_CONFIG[nextTier].effectMultiplier.toFixed(2)}</span>
                              <button 
                                class={styles.upgradeButton}
                                disabled={!canAfford || loadingItem === item.itemId}
                                onClick={() => handleUpgradeItem(item.itemId)}
                              >
                                {loadingItem === item.itemId ? '...' : `${cost} 🪙`}
                              </button>
                            </div>
                          )}
                          {isMaxed && <span class={styles.maxLabel}>MAX</span>}
                        </div>
                      );
                    })()}
                  </div>
                  <span class={styles.itemAmount}>×{item.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
