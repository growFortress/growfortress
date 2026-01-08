/**
 * Artifacts State Signals
 *
 * State management for player artifacts and items
 */

import { signal, computed } from '@preact/signals';
import type { PlayerArtifact, PlayerItem } from '@arcade/protocol';
import { getArtifactById, getItemById, type ArtifactDefinition, type ItemDefinition, type ArtifactRarity } from '@arcade/sim-core';

// ============================================================================
// CORE SIGNALS
// ============================================================================

/** Player's owned artifacts */
export const playerArtifacts = signal<PlayerArtifact[]>([]);

/** Player's owned items */
export const playerItems = signal<PlayerItem[]>([]);

/** Artifacts modal visibility */
export const artifactsModalVisible = signal(false);

/** Crafting modal visibility */
export const craftingModalVisible = signal(false);

/** Selected artifact for details */
export const selectedArtifactId = signal<string | null>(null);

/** Loading state */
export const artifactsLoading = signal(false);

/** Error state */
export const artifactsError = signal<string | null>(null);

// ============================================================================
// ARTIFACT DROP NOTIFICATIONS
// ============================================================================

/** Artifact drop notification */
export interface ArtifactDropNotification {
  artifactId: string;
  isDuplicate: boolean;
  dustValue: number;
  timestamp: number;
  rarity: ArtifactRarity;
}

/** Recent artifact drops for UI notifications */
export const recentArtifactDrops = signal<ArtifactDropNotification[]>([]);

/** Duration to show artifact drop notification (ms) */
const ARTIFACT_DROP_DURATION = 4000;

/**
 * Add an artifact drop notification
 */
export function addArtifactDrop(
  artifactId: string,
  isDuplicate: boolean,
  dustValue: number
): void {
  const artifact = getArtifactById(artifactId);
  if (!artifact) return;

  const drop: ArtifactDropNotification = {
    artifactId,
    isDuplicate,
    dustValue,
    timestamp: Date.now(),
    rarity: artifact.rarity,
  };

  recentArtifactDrops.value = [...recentArtifactDrops.value, drop];

  // Auto-remove after duration
  setTimeout(() => {
    recentArtifactDrops.value = recentArtifactDrops.value.filter(
      (d) => d.timestamp !== drop.timestamp
    );
  }, ARTIFACT_DROP_DURATION);
}

// ============================================================================
// COMPUTED SIGNALS
// ============================================================================

/** Artifacts with their definitions */
export const artifactsWithDefs = computed(() => {
  return playerArtifacts.value
    .map((artifact) => {
      const def = getArtifactById(artifact.artifactId);
      return def ? { ...artifact, definition: def } : null;
    })
    .filter((a): a is PlayerArtifact & { definition: ArtifactDefinition } => a !== null);
});

/** Items with their definitions */
export const itemsWithDefs = computed(() => {
  return playerItems.value
    .map((item) => {
      const def = getItemById(item.itemId);
      return def ? { ...item, definition: def } : null;
    })
    .filter((i): i is PlayerItem & { definition: ItemDefinition } => i !== null);
});

/** Equipped artifacts by hero ID */
export const equippedArtifactsByHero = computed(() => {
  const map: Record<string, PlayerArtifact & { definition: ArtifactDefinition }> = {};

  for (const artifact of artifactsWithDefs.value) {
    if (artifact.equippedToHeroId) {
      map[artifact.equippedToHeroId] = artifact;
    }
  }

  return map;
});

/** Unequipped artifacts */
export const unequippedArtifacts = computed(() => {
  return artifactsWithDefs.value.filter((a) => !a.equippedToHeroId);
});

/** Total artifact count */
export const totalArtifacts = computed(() => playerArtifacts.value.length);

/** Total item count */
export const totalItems = computed(() =>
  playerItems.value.reduce((sum, item) => sum + item.amount, 0)
);

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Update artifacts from API response
 */
export function updateArtifacts(artifacts: PlayerArtifact[]): void {
  playerArtifacts.value = artifacts;
}

/**
 * Update items from API response
 */
export function updateItems(items: PlayerItem[]): void {
  playerItems.value = items;
}

/**
 * Add a new artifact locally (after crafting/acquiring)
 */
export function addArtifact(artifact: PlayerArtifact): void {
  playerArtifacts.value = [...playerArtifacts.value, artifact];
}

/**
 * Update an artifact locally (after equip/unequip)
 */
export function updateArtifact(artifact: PlayerArtifact): void {
  playerArtifacts.value = playerArtifacts.value.map((a) =>
    a.id === artifact.id ? artifact : a
  );
}

/**
 * Update item amount locally (after using)
 */
export function updateItemAmount(itemId: string, newAmount: number): void {
  if (newAmount <= 0) {
    playerItems.value = playerItems.value.filter((i) => i.itemId !== itemId);
  } else {
    const existing = playerItems.value.find((i) => i.itemId === itemId);
    if (existing) {
      playerItems.value = playerItems.value.map((i) =>
        i.itemId === itemId ? { ...i, amount: newAmount } : i
      );
    } else {
      playerItems.value = [...playerItems.value, { itemId, amount: newAmount }];
    }
  }
}

/**
 * Show artifacts modal
 */
export function showArtifactsModal(): void {
  artifactsModalVisible.value = true;
}

/**
 * Hide artifacts modal
 */
export function hideArtifactsModal(): void {
  artifactsModalVisible.value = false;
  selectedArtifactId.value = null;
}

/**
 * Show crafting modal
 */
export function showCraftingModal(): void {
  craftingModalVisible.value = true;
}

/**
 * Hide crafting modal
 */
export function hideCraftingModal(): void {
  craftingModalVisible.value = false;
}

/**
 * Select an artifact for details view
 */
export function selectArtifact(artifactId: string | null): void {
  selectedArtifactId.value = artifactId;
}

/**
 * Get artifact equipped to a specific hero
 */
export function getArtifactForHero(heroId: string): (PlayerArtifact & { definition: ArtifactDefinition }) | null {
  return equippedArtifactsByHero.value[heroId] ?? null;
}

/**
 * Check if player has a specific artifact
 */
export function hasArtifact(artifactId: string): boolean {
  return playerArtifacts.value.some((a) => a.artifactId === artifactId);
}

/**
 * Get item amount
 */
export function getItemAmount(itemId: string): number {
  return playerItems.value.find((i) => i.itemId === itemId)?.amount ?? 0;
}
