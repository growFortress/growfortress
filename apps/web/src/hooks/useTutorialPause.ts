import { useEffect } from "preact/hooks";
import { effect } from "@preact/signals";
import { tutorialPauseRequested } from "../state/tutorial.signals.js";
import { gamePhase } from "../state/index.js";

/**
 * Hook that pauses/resumes the game when tutorial tips are shown/dismissed.
 * Must be called in GameContainer with the pause/resume functions from useGameLoop.
 */
export function useTutorialPause(
  pauseForTutorial: () => void,
  resumeFromTutorial: () => void
): void {
  // Use @preact/signals effect() to properly react to signal changes
  useEffect(() => {
    const dispose = effect(() => {
      const phase = gamePhase.value;
      const pauseRequested = tutorialPauseRequested.value;

      // Only manage pause during playing phase
      if (phase !== "playing") {
        return;
      }

      if (pauseRequested) {
        pauseForTutorial();
      } else {
        resumeFromTutorial();
      }
    });

    return dispose;
  }, [pauseForTutorial, resumeFromTutorial]);

  // Clean up: ensure we resume when unmounting
  useEffect(() => {
    return () => {
      if (tutorialPauseRequested.value) {
        resumeFromTutorial();
      }
    };
  }, [resumeFromTutorial]);
}
