import { signal } from '@preact/signals';

export type LegalTab = 'terms' | 'privacy' | 'cookies' | 'payment';

/** Modal visibility */
export const legalModalVisible = signal(false);

/** Active tab within the modal */
export const activeLegalTab = signal<LegalTab>('terms');

/** Open the legal modal to a specific tab */
export function openLegalModal(tab: LegalTab = 'terms'): void {
  activeLegalTab.value = tab;
  legalModalVisible.value = true;
}

/** Close the legal modal */
export function closeLegalModal(): void {
  legalModalVisible.value = false;
}

/** Switch to a specific legal tab */
export function setLegalTab(tab: LegalTab): void {
  activeLegalTab.value = tab;
}

/** Reset legal state (call on logout) */
export function resetLegalState(): void {
  legalModalVisible.value = false;
  activeLegalTab.value = 'terms';
}
