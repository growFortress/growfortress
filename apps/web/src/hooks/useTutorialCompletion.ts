import { useEffect, useRef } from "preact/hooks";
import { effect } from "@preact/signals";
import {
  activeTutorialTip,
  lastGameAction,
  completeInteractiveTip,
  type TutorialTip,
  type TutorialSignalName,
} from "../state/tutorial.signals.js";
import { speedSettings } from "../state/settings.signals.js";
import { manualControlHeroId } from "../state/command.signals.js";
import { selectedTargetedSkill } from "../state/ui.signals.js";

/**
 * Get the current value of a tracked signal by name
 */
function getSignalValue(signalName: TutorialSignalName): unknown {
  switch (signalName) {
    case "speedMultiplier":
      return speedSettings.value.speedMultiplier;
    case "manualControlHeroId":
      return manualControlHeroId.value;
    case "selectedTargetedSkill":
      return selectedTargetedSkill.value;
    default:
      return undefined;
  }
}

/**
 * Check if completion condition is met based on expected change type
 */
function isCompletionMet(
  expectedChange: "any" | "truthy",
  initial: unknown,
  current: unknown
): boolean {
  switch (expectedChange) {
    case "any":
      return current !== initial;
    case "truthy":
      return !initial && Boolean(current);
    default:
      return false;
  }
}

/**
 * Hook that monitors signals and game actions for interactive tutorial completion.
 * Should be called in a component that persists during gameplay (e.g., TutorialHighlight).
 */
export function useTutorialCompletion(): void {
  // Store initial values when tips become active
  const initialValuesRef = useRef<Map<string, unknown>>(new Map());
  // Track last processed action tick to avoid double-completion
  const lastProcessedTickRef = useRef<number>(-1);

  // Signal-based completion detection
  useEffect(() => {
    const dispose = effect(() => {
      const tip = activeTutorialTip.value;

      if (!tip?.completion || tip.completion.type !== "signal") {
        return;
      }

      const { signalName, expectedChange } = tip.completion;
      const currentValue = getSignalValue(signalName);
      const initialValue = initialValuesRef.current.get(tip.id);

      // Store initial value when tip first becomes active
      if (initialValue === undefined) {
        initialValuesRef.current.set(tip.id, currentValue);
        return;
      }

      // Check if completion condition is met
      if (isCompletionMet(expectedChange, initialValue, currentValue)) {
        // Clean up initial value
        initialValuesRef.current.delete(tip.id);
        completeInteractiveTip();
      }
    });

    return dispose;
  }, []);

  // Action-based completion detection
  useEffect(() => {
    const dispose = effect(() => {
      const tip = activeTutorialTip.value;
      const action = lastGameAction.value;

      if (!tip?.completion || tip.completion.type !== "action") {
        return;
      }

      if (!action) {
        return;
      }

      // Avoid processing the same action twice
      if (action.tick <= lastProcessedTickRef.current) {
        return;
      }

      // Check if the action matches the expected type
      if (action.type === tip.completion.actionType) {
        lastProcessedTickRef.current = action.tick;
        completeInteractiveTip();
      }
    });

    return dispose;
  }, []);

  // Clean up initial values when tip changes or is dismissed
  useEffect(() => {
    const dispose = effect(() => {
      const tip = activeTutorialTip.value;

      if (!tip) {
        // Clear all stored initial values when no tip is active
        initialValuesRef.current.clear();
      }
    });

    return dispose;
  }, []);
}

/**
 * Check if a tip is interactive (requires action to complete)
 */
export function isInteractiveTip(tip: TutorialTip | null): boolean {
  if (!tip?.completion) return false;
  return tip.completion.type !== "none";
}
