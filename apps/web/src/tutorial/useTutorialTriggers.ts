import { useEffect, useRef, useMemo } from "preact/hooks";
import {
  gameState,
  gamePhase,
  showChoiceModal,
} from "../state/index.js";
import {
  showTutorialTip,
  isTipCompleted,
  activeTutorialTip,
} from "../state/tutorial.signals.js";
import { getTutorialSteps } from "./tutorialSteps.js";
import { useTranslation } from "../i18n/useTranslation.js";

/**
 * Hook that monitors game state and triggers contextual tutorial tips.
 * Should be called in GameContainer.
 */
export function useTutorialTriggers(): void {
  const { t } = useTranslation("game");
  
  // Memoize tutorial steps with current translations
  const tutorialSteps = useMemo(() => getTutorialSteps(t), [t]);
  
  const hasTriggeredWave1 = useRef(false);
  const hasTriggeredWave2 = useRef(false);
  const hasTriggeredRelicTip = useRef(false);
  const hasTriggeredSynergyTip = useRef(false);
  const bombSkillTimeoutRef = useRef<number | null>(null);
  const synergyTimeoutRef = useRef<number | null>(null);

  // Reset refs when returning to idle
  useEffect(() => {
    if (gamePhase.value === "idle") {
      hasTriggeredWave1.current = false;
      hasTriggeredWave2.current = false;
      hasTriggeredRelicTip.current = false;
      hasTriggeredSynergyTip.current = false;
      if (bombSkillTimeoutRef.current) {
        clearTimeout(bombSkillTimeoutRef.current);
        bombSkillTimeoutRef.current = null;
      }
      if (synergyTimeoutRef.current) {
        clearTimeout(synergyTimeoutRef.current);
        synergyTimeoutRef.current = null;
      }
    }
  }, [gamePhase.value]);

  // Wave-based triggers
  useEffect(() => {
    const state = gameState.value;
    const phase = gamePhase.value;

    if (!state || phase !== "playing") return;

    const wave = state.wave;

    // Wave 1: Show fortress auto-attack tip, then bomb skill tip
    if (wave === 1 && !hasTriggeredWave1.current) {
      hasTriggeredWave1.current = true;

      if (!isTipCompleted("fortress_auto_attack")) {
        showTutorialTip(tutorialSteps.fortress_auto_attack);

        // Queue bomb skill tip after delay (when first tip dismisses or timeout)
        bombSkillTimeoutRef.current = window.setTimeout(() => {
          // Only show if no tip is currently active
          if (!activeTutorialTip.value && !isTipCompleted("bomb_skill")) {
            showTutorialTip(tutorialSteps.bomb_skill);
          }
        }, 10000); // 10 seconds after wave 1 starts
      } else if (!isTipCompleted("bomb_skill")) {
        // If fortress tip already completed, show bomb tip with shorter delay
        bombSkillTimeoutRef.current = window.setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("bomb_skill")) {
            showTutorialTip(tutorialSteps.bomb_skill);
          }
        }, 3000);
      }
    }

    // Wave 2: Show speed controls tip
    if (wave === 2 && !hasTriggeredWave2.current) {
      hasTriggeredWave2.current = true;

      if (!isTipCompleted("speed_controls")) {
        // Small delay to let player settle into wave 2
        setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("speed_controls")) {
            showTutorialTip(tutorialSteps.speed_controls);
          }
        }, 2000);
      }
    }
  }, [gameState.value?.wave, gamePhase.value, tutorialSteps]);

  // Relic selection trigger (when choice modal opens)
  useEffect(() => {
    if (showChoiceModal.value && !hasTriggeredRelicTip.current) {
      hasTriggeredRelicTip.current = true;

      if (!isTipCompleted("relic_selection")) {
        // Small delay to let modal appear
        setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("relic_selection")) {
            showTutorialTip(tutorialSteps.relic_selection);
          }
        }, 500);
      }
    }

    // Show build synergy tip after the first relic choice modal closes
    // This is a good moment because the player just made their first build decision
    if (!showChoiceModal.value && hasTriggeredRelicTip.current && !hasTriggeredSynergyTip.current) {
      hasTriggeredSynergyTip.current = true;

      if (!isTipCompleted("build_synergy")) {
        // Show synergy tip shortly after relic selection
        synergyTimeoutRef.current = window.setTimeout(() => {
          if (!activeTutorialTip.value && !isTipCompleted("build_synergy")) {
            showTutorialTip(tutorialSteps.build_synergy);
          }
        }, 2000);
      }
    }
  }, [showChoiceModal.value, tutorialSteps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bombSkillTimeoutRef.current) {
        clearTimeout(bombSkillTimeoutRef.current);
      }
      if (synergyTimeoutRef.current) {
        clearTimeout(synergyTimeoutRef.current);
      }
    };
  }, []);
}
