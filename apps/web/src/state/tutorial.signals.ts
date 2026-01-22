import { signal, effect } from "@preact/signals";

// Tutorial step identifiers
export type TutorialStepId =
  | "fortress_auto_attack"
  | "bomb_skill"
  | "relic_selection"
  | "speed_controls"
  | "build_synergy"
  | "fortress_upgrades"
  | "hero_stat_upgrades"
  | "hero_tiers"
  | "fortress_unlocks"
  | "manual_control"
  | "hero_drag";

// Tutorial tip configuration
export interface TutorialTip {
  id: TutorialStepId;
  title: string;
  description: string;
  highlightRef?: string; // data-tutorial attribute value
  position: "top" | "bottom" | "left" | "right" | "center";
  autoDismissMs?: number; // Auto-dismiss after N ms (0 = no auto-dismiss)
}

// LocalStorage key
const STORAGE_KEY = "gf-tutorial-progress";

// Load initial progress from localStorage
function loadProgress(): Set<TutorialStepId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as TutorialStepId[];
      return new Set(arr);
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

// Save progress to localStorage
function saveProgress(progress: Set<TutorialStepId>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...progress]));
  } catch {
    // Ignore storage errors
  }
}

// Tracks which tips have been shown (persisted to localStorage)
export const tutorialProgress = signal<Set<TutorialStepId>>(loadProgress());

// Currently active tutorial tip (only one at a time)
export const activeTutorialTip = signal<TutorialTip | null>(null);

// Whether tutorials are enabled (for first-time players)
export const tutorialsEnabled = signal(true);

// Auto-save progress when it changes
effect(() => {
  saveProgress(tutorialProgress.value);
});

// Actions
export function showTutorialTip(tip: TutorialTip): void {
  // Don't show if already completed or another tip is active
  if (tutorialProgress.value.has(tip.id) || activeTutorialTip.value !== null) {
    return;
  }
  activeTutorialTip.value = tip;
}

export function dismissCurrentTip(): void {
  const tip = activeTutorialTip.value;
  if (tip) {
    markTipCompleted(tip.id);
  }
  activeTutorialTip.value = null;
}

export function markTipCompleted(id: TutorialStepId): void {
  const newProgress = new Set(tutorialProgress.value);
  newProgress.add(id);
  tutorialProgress.value = newProgress;
}

export function isTipCompleted(id: TutorialStepId): boolean {
  return tutorialProgress.value.has(id);
}

export function resetTutorialProgress(): void {
  tutorialProgress.value = new Set();
  activeTutorialTip.value = null;
}
