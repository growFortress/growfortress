/**
 * Guild Preview state management using Preact Signals
 * Handles viewing other guilds' public information
 */
import { signal, computed } from '@preact/signals';
import type { GuildPreviewResponse } from '@arcade/protocol';
import { fetchGuildPreview } from '../api/guildPreview.js';

// ============================================================================
// MODAL STATE
// ============================================================================

/** Guild preview data for the viewed guild */
export const guildPreviewData = signal<GuildPreviewResponse | null>(null);

/** Loading state */
export const guildPreviewLoading = signal(false);

/** Error message */
export const guildPreviewError = signal<string | null>(null);

/** Whether the guild preview modal is visible */
export const guildPreviewModalOpen = signal(false);

/** Guild ID currently being previewed */
export const guildPreviewGuildId = signal<string | null>(null);

// ============================================================================
// COMPUTED VALUES
// ============================================================================

/** Whether guild preview modal should be visible */
export const isGuildPreviewVisible = computed(() => guildPreviewModalOpen.value);

/** Whether preview is ready to display */
export const isGuildPreviewReady = computed(
  () => !guildPreviewLoading.value && guildPreviewData.value !== null && !guildPreviewError.value
);

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Open guild preview modal for a specific guild
 * @param guildId - The guild ID to preview
 */
export async function openGuildPreview(guildId: string): Promise<void> {
  // Set modal state
  guildPreviewGuildId.value = guildId;
  guildPreviewModalOpen.value = true;
  guildPreviewError.value = null;
  guildPreviewLoading.value = true;
  guildPreviewData.value = null;

  try {
    const data = await fetchGuildPreview(guildId);
    if (data) {
      guildPreviewData.value = data;
    } else {
      guildPreviewError.value = 'Nie znaleziono gildii';
    }
  } catch (error) {
    console.error('Failed to fetch guild preview:', error);
    guildPreviewError.value = 'Nie udalo sie zaladowac danych';
  } finally {
    guildPreviewLoading.value = false;
  }
}

/**
 * Close the guild preview modal and reset state
 */
export function closeGuildPreview(): void {
  guildPreviewModalOpen.value = false;
  guildPreviewGuildId.value = null;
  guildPreviewData.value = null;
  guildPreviewError.value = null;
  guildPreviewLoading.value = false;
}
