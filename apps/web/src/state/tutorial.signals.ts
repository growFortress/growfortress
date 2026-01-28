import { signal, effect } from "@preact/signals";
import { completeTutorial as apiCompleteTutorial } from "../api/tutorial.js";

// Tutorial step identifiers
export type TutorialStepId =
  | "welcome_intro"
  | "fortress_auto_attack"
  | "fortress_health"
  | "gold_resource"
  | "bomb_skill"
  | "relic_selection"
  | "speed_controls"
  | "turret_targeting"
  | "militia_spawn"
  | "dust_resource"
  | "build_synergy"
  | "fortress_upgrades"
  | "hero_stat_upgrades"
  | "hero_tiers"
  | "fortress_unlocks"
  | "manual_control"
  | "hero_drag";

// ============ Interactive Tutorial Completion Types ============

// Signal names that can be monitored for changes
export type TutorialSignalName =
  | "speedMultiplier"
  | "selectedTargetedSkill"
  | "manualControlHeroId";

// Signal-based completion: wait for a signal to change
export interface SignalCompletion {
  type: "signal";
  signalName: TutorialSignalName;
  expectedChange: "any" | "truthy";
}

// Action-based completion: wait for game action
export interface ActionCompletion {
  type: "action";
  actionType: "ACTIVATE_SKILL" | "HERO_COMMAND";
}

// Click-based completion: click on highlighted element
export interface ClickCompletion {
  type: "click";
}

// No completion required (default behavior)
export interface NoCompletion {
  type: "none";
}

export type TutorialCompletion =
  | SignalCompletion
  | ActionCompletion
  | ClickCompletion
  | NoCompletion;

// Tutorial tip configuration
export interface TutorialTip {
  id: TutorialStepId;
  title: string;
  description: string;
  highlightRef?: string; // data-tutorial attribute value
  position: "top" | "bottom" | "left" | "right" | "center";
  autoDismissMs?: number; // Auto-dismiss after N ms (0 = no auto-dismiss)
  completion?: TutorialCompletion; // Interactive completion condition
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

// Signal to request game pause during tutorials
export const tutorialPauseRequested = signal<boolean>(false);

// Auto-save progress when it changes
effect(() => {
  saveProgress(tutorialProgress.value);
});

// Actions
export function showTutorialTip(tip: TutorialTip, shouldPause = true): void {
  // Don't show if already completed or another tip is active
  if (tutorialProgress.value.has(tip.id) || activeTutorialTip.value !== null) {
    return;
  }
  activeTutorialTip.value = tip;
  if (shouldPause) {
    tutorialPauseRequested.value = true;
  }
}

export function dismissCurrentTip(): void {
  const tip = activeTutorialTip.value;
  if (tip) {
    markTipCompleted(tip.id);
  }
  activeTutorialTip.value = null;
  tutorialPauseRequested.value = false;
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

// ============ Interactive Tutorial Action Tracking ============

// Tracks last game action for action-based completion
export const lastGameAction = signal<{
  type: string;
  tick: number;
} | null>(null);

// Record a game action (called from Game.ts)
export function recordGameAction(type: string, tick: number): void {
  lastGameAction.value = { type, tick };
}

// Complete an interactive tip (marks completed and clears active)
export function completeInteractiveTip(): void {
  const tip = activeTutorialTip.value;
  if (tip) {
    markTipCompleted(tip.id);
  }
  activeTutorialTip.value = null;
  tutorialPauseRequested.value = false;
}

// ============ Skip All Tutorials ============

// All tutorial step IDs (17 total)
const ALL_TUTORIAL_STEPS: TutorialStepId[] = [
  "welcome_intro",
  "fortress_auto_attack",
  "fortress_health",
  "gold_resource",
  "bomb_skill",
  "relic_selection",
  "speed_controls",
  "turret_targeting",
  "militia_spawn",
  "dust_resource",
  "build_synergy",
  "fortress_upgrades",
  "hero_stat_upgrades",
  "hero_tiers",
  "fortress_unlocks",
  "manual_control",
  "hero_drag",
];

/**
 * Skip all tutorials at once
 * Marks all 17 steps as completed locally and notifies the server
 */
export async function skipAllTutorials(): Promise<void> {
  // Mark all steps as completed locally
  tutorialProgress.value = new Set(ALL_TUTORIAL_STEPS);
  activeTutorialTip.value = null;
  tutorialPauseRequested.value = false;

  // Notify server (fire and forget - local progress is authoritative for UX)
  apiCompleteTutorial().catch((err) => {
    console.error("Failed to sync tutorial completion:", err);
  });
}

/**
 * Check if all tutorials have been completed
 */
export function areTutorialsComplete(): boolean {
  return ALL_TUTORIAL_STEPS.every((step) => tutorialProgress.value.has(step));
}

/**
 * Get the number of completed tutorial steps
 */
export function getCompletedTutorialCount(): number {
  return ALL_TUTORIAL_STEPS.filter((step) => tutorialProgress.value.has(step)).length;
}

/**
 * Get the total number of tutorial steps
 */
export function getTotalTutorialCount(): number {
  return ALL_TUTORIAL_STEPS.length;
}
