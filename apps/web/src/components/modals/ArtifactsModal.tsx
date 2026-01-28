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
import { useState, useEffect, useCallback } from 'preact/hooks';
import { Modal } from '../shared/Modal.js';
import { getAccessToken } from '../../api/auth.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { DamageIcon, ArmorIcon, SpeedIcon } from '../icons/index.js';
import type { ComponentChildren } from 'preact';
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

// Active tab and selection signals
const activeTab = signal<'artifacts' | 'items'>('artifacts');
const selectedArtifactId = signal<string | null>(null);
const selectedItemId = signal<string | null>(null);

// Artifact slot icons - using SVG for weapon and armor
function getSlotIcon(slot: string, size: number = 20): ComponentChildren {
  switch (slot) {
    case 'weapon':
      return <DamageIcon size={size} />;
    case 'armor':
      return <ArmorIcon size={size} />;
    case 'accessory':
      return '💍';
    case 'gadget':
      return '🔧';
    case 'book':
      return '📖';
    case 'special':
      return '⭐';
    default:
      return '📦';
  }
}

// Item icons - using SVG for damage_boost and speed_elixir
function getItemIcon(itemId: string, size: number = 20): ComponentChildren {
  switch (itemId) {
    case 'damage_boost':
      return <DamageIcon size={size} />;
    case 'speed_elixir':
      return <SpeedIcon size={size} />;
    case 'health_potion':
      return '🧪';
    case 'shield_charm':
      return '🔮';
    case 'xp_tome':
      return '📚';
    case 'crit_crystal':
      return '💎';
    default:
      return '📦';
  }
}

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
  const { t, language } = useTranslation(['common', 'data', 'modals']);
  const isVisible = artifactsModalVisible.value;
  const tab = activeTab.value;
  const artifacts = artifactsWithDefs.value;
  const items = itemsWithDefs.value;
  const unequipped = unequippedArtifacts.value;
  const selectedArtifact = selectedArtifactId.value;
  const selectedItem = selectedItemId.value;

  const equippedArtifacts = artifacts.filter((a) => a.equippedToHeroId);
  const allArtifacts = [...equippedArtifacts, ...unequipped];

  const gold = displayGold.value;
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  // Helper functions
  const getArtifactName = useCallback(
    (artifactId: string, name: string, polishName: string) =>
      t(`data:artifacts.${artifactId}.name`, {
        defaultValue: language === 'pl' ? polishName : name,
      }),
    [t, language]
  );

  const getTierColor = useCallback((tier: ItemTier): string => {
    const colorHex = ITEM_TIER_CONFIG[tier].color.toString(16).padStart(6, '0');
    return `#${colorHex}`;
  }, []);

  // Reset selection when modal closes
  useEffect(() => {
    if (!isVisible) {
      selectedArtifactId.value = null;
      selectedItemId.value = null;
    }
  }, [isVisible]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (tab === 'artifacts') {
        if (!allArtifacts.length) return;
        const currentIndex = allArtifacts.findIndex((a) => a.id === selectedArtifact);

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = currentIndex < allArtifacts.length - 1 ? currentIndex + 1 : 0;
          selectedArtifactId.value = allArtifacts[nextIndex].id;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : allArtifacts.length - 1;
          selectedArtifactId.value = allArtifacts[prevIndex].id;
        }
      } else if (tab === 'items') {
        if (!items.length) return;
        const currentIndex = items.findIndex((i) => i.itemId === selectedItem);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          selectedItemId.value = items[nextIndex].itemId;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          selectedItemId.value = items[prevIndex].itemId;
        }
      }

      // Tab switching with number keys
      if (e.key === '1') {
        activeTab.value = 'artifacts';
      } else if (e.key === '2') {
        activeTab.value = 'items';
      }
    },
    [tab, allArtifacts, items, selectedArtifact, selectedItem]
  );

  useEffect(() => {
    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
    return undefined;
  }, [isVisible, handleKeyDown]);

  // API handlers
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
      const message = error instanceof Error ? error.message : t('artifacts.errors.upgradeFailed');
      showErrorToast(message);
    } finally {
      setLoadingItem(null);
    }
  };

  const handleCraftClick = () => {
    hideArtifactsModal();
    showCraftingModal();
  };

  const itemsCount = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <Modal
      visible={isVisible}
      title={t('artifacts.title')}
      onClose={hideArtifactsModal}
      class={styles.modalContent}
      ariaLabel={t('artifacts.ariaLabel')}
    >
      {/* Tabs */}
      <div class={styles.tabs} role="tablist">
        <button
          class={`${styles.tab} ${tab === 'artifacts' ? styles.active : ''}`}
          onClick={() => (activeTab.value = 'artifacts')}
          role="tab"
          aria-selected={tab === 'artifacts'}
          aria-controls="artifacts-panel"
        >
          {t('artifacts.tabs.artifacts')} ({artifacts.length})
        </button>
        <button
          class={`${styles.tab} ${tab === 'items' ? styles.active : ''}`}
          onClick={() => (activeTab.value = 'items')}
          role="tab"
          aria-selected={tab === 'items'}
          aria-controls="items-panel"
        >
          {t('artifacts.tabs.items')} ({itemsCount})
        </button>
      </div>

      {/* Artifacts Tab */}
      {tab === 'artifacts' && (
        <div id="artifacts-panel" role="tabpanel" class={styles.contentWrapper}>
          {equippedArtifacts.length > 0 && (
            <div class={styles.section}>
              <div class={styles.sectionTitle}>
                {t('artifacts.sections.equipped')}{' '}
                <span class={styles.count}>{equippedArtifacts.length}</span>
              </div>
              <div class={styles.grid} role="listbox" aria-label={t('artifacts.sections.equipped')}>
                {equippedArtifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    class={`${styles.artifactCard} ${styles.equipped} ${styles[artifact.definition.rarity]} ${selectedArtifact === artifact.id ? styles.selected : ''}`}
                    onClick={() => (selectedArtifactId.value = artifact.id)}
                    role="option"
                    aria-selected={selectedArtifact === artifact.id}
                  >
                    <span class={styles.equippedBadge}>✓</span>
                    <span class={styles.artifactIcon}>
                      {getSlotIcon(artifact.definition.slot, 24)}
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
                  </button>
                ))}
              </div>
            </div>
          )}

          <div class={styles.section}>
            <div class={styles.sectionTitle}>
              {t('artifacts.sections.available')}{' '}
              <span class={styles.count}>{unequipped.length}</span>
            </div>
            {unequipped.length === 0 ? (
              <div class={styles.empty}>
                <span class={styles.emptyIcon}>📦</span>
                <span>{t('artifacts.empty.artifacts')}</span>
              </div>
            ) : (
              <div class={styles.grid} role="listbox" aria-label={t('artifacts.sections.available')}>
                {unequipped.map((artifact) => (
                  <button
                    key={artifact.id}
                    class={`${styles.artifactCard} ${styles[artifact.definition.rarity]} ${selectedArtifact === artifact.id ? styles.selected : ''}`}
                    onClick={() => (selectedArtifactId.value = artifact.id)}
                    role="option"
                    aria-selected={selectedArtifact === artifact.id}
                  >
                    <span class={styles.artifactIcon}>
                      {getSlotIcon(artifact.definition.slot, 24)}
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
                  </button>
                ))}
              </div>
            )}
          </div>

          <button class={styles.craftButton} onClick={handleCraftClick}>
            ⚒️ {t('artifacts.craftButton')}
          </button>
        </div>
      )}

      {/* Items Tab */}
      {tab === 'items' && (
        <div id="items-panel" role="tabpanel" class={styles.contentWrapper}>
          <div class={styles.section}>
            {items.length === 0 ? (
              <div class={styles.empty}>
                <span class={styles.emptyIcon}>🛒</span>
                <span>{t('artifacts.empty.items')}</span>
              </div>
            ) : (
              <div class={styles.grid} role="listbox" aria-label={t('artifacts.tabs.items')}>
                {items.map((item) => (
                  <ItemCard
                    key={item.itemId}
                    item={item}
                    isSelected={selectedItem === item.itemId}
                    isLoading={loadingItem === item.itemId}
                    gold={gold}
                    onSelect={() => (selectedItemId.value = item.itemId)}
                    onUpgrade={() => handleUpgradeItem(item.itemId)}
                    getTierColor={getTierColor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================
// ItemCard Component
// ============================================
interface ItemCardProps {
  item: (typeof itemsWithDefs)['value'][number];
  isSelected: boolean;
  isLoading: boolean;
  gold: number;
  onSelect: () => void;
  onUpgrade: () => void;
  getTierColor: (tier: ItemTier) => string;
}

function ItemCard({
  item,
  isSelected,
  isLoading,
  gold,
  onSelect,
  onUpgrade,
  getTierColor,
}: ItemCardProps) {
  const { t, language } = useTranslation(['common', 'data']);
  const itemState = powerState.value.itemTiers.find((i) => i.itemId === item.itemId);
  const currentTier = itemState?.tier || 'common';
  const tierConfig = ITEM_TIER_CONFIG[currentTier];
  const nextTier = getNextItemTier(currentTier);
  const isMaxed = isMaxItemTier(currentTier);
  const cost = tierConfig.upgradeCost;
  const canAfford = cost !== null && gold >= cost;

  const itemName = t(`data:items.${item.itemId}.name`, {
    defaultValue: language === 'pl' ? item.definition.polishName : item.definition.name,
  });

  const itemDesc = t(`data:items.${item.itemId}.description`, {
    defaultValue: item.definition.description,
  });

  return (
    <button
      class={`${styles.itemCard} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
      role="option"
      aria-selected={isSelected}
    >
      <span class={styles.itemIcon}>{getItemIcon(item.itemId, 24)}</span>
      <div class={styles.itemInfo}>
        <div class={styles.itemName}>{itemName}</div>
        <div class={styles.itemDesc}>{itemDesc}</div>

        {/* Item Tier Section */}
        <div class={styles.itemTierSection}>
          <div class={styles.tierInfo}>
            <span class={styles.tierName} style={{ color: getTierColor(currentTier) }}>
              {t(`tiers.${currentTier}`, { defaultValue: tierConfig.name })}
            </span>
            <span class={styles.tierBonus}>×{tierConfig.effectMultiplier.toFixed(2)}</span>
          </div>

          {nextTier && (
            <div class={styles.upgradeInfo}>
              <span class={styles.nextBonus}>
                → ×{ITEM_TIER_CONFIG[nextTier].effectMultiplier.toFixed(2)}
              </span>
              <button
                class={styles.upgradeButton}
                disabled={!canAfford || isLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpgrade();
                }}
                aria-label={t('artifacts.upgradeItem', { cost })}
              >
                {isLoading ? '...' : `${cost} 🪙`}
              </button>
            </div>
          )}
          {isMaxed && (
            <span class={styles.maxLabel}>{t('common:labels.max', { defaultValue: 'MAX' })}</span>
          )}
        </div>
      </div>
      <span class={styles.itemAmount}>×{item.amount}</span>
    </button>
  );
}
