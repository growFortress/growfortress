import { signal, computed } from '@preact/signals';
import type { MaterialType } from '@arcade/sim-core';

// Types
export interface MaterialDrop {
  materialId: MaterialType;
  amount: number;
  timestamp: number;
}

export interface MaterialInfo {
  id: MaterialType;
  name: string;
  polishName: string;
  amount: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  color: number;
}

// Player materials inventory (persistent, from profile)
export const playerMaterials = signal<Record<string, number>>({});

// Recent material drops (for notifications)
export const recentDrops = signal<MaterialDrop[]>([]);

// Materials modal visibility
export const materialsModalVisible = signal(false);

// Total unique materials count
export const uniqueMaterialsCount = computed(() => {
  return Object.keys(playerMaterials.value).filter(
    key => playerMaterials.value[key] > 0
  ).length;
});

// Add a material drop notification
export function addMaterialDrop(materialId: MaterialType, amount: number): void {
  const drop: MaterialDrop = {
    materialId,
    amount,
    timestamp: Date.now(),
  };

  recentDrops.value = [...recentDrops.value, drop];

  // Auto-remove after 3 seconds
  setTimeout(() => {
    recentDrops.value = recentDrops.value.filter(d => d !== drop);
  }, 3000);
}

// Update player materials from profile
export function updatePlayerMaterials(materials: Record<string, number>): void {
  playerMaterials.value = { ...materials };
}

// Add materials to inventory
export function addMaterials(materialId: MaterialType, amount: number): void {
  playerMaterials.value = {
    ...playerMaterials.value,
    [materialId]: (playerMaterials.value[materialId] || 0) + amount,
  };
}

// Remove materials from inventory
export function removeMaterials(materialId: MaterialType, amount: number): boolean {
  const current = playerMaterials.value[materialId] || 0;
  if (current < amount) return false;

  playerMaterials.value = {
    ...playerMaterials.value,
    [materialId]: current - amount,
  };
  return true;
}

// Check if player has enough materials
export function hasMaterials(materialId: MaterialType, amount: number): boolean {
  return (playerMaterials.value[materialId] || 0) >= amount;
}

// Open/close materials modal
export function showMaterialsModal(): void {
  materialsModalVisible.value = true;
}

export function hideMaterialsModal(): void {
  materialsModalVisible.value = false;
}
