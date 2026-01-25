import { useEffect } from "preact/hooks";
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
  useEffect(() => {
    // Only manage pause during playing phase
    if (gamePhase.value !== "playing") {
      return;
    }

    if (tutorialPauseRequested.value) {
      pauseForTutorial();
    } else {
      resumeFromTutorial();
    }
  }, [tutorialPauseRequested.value, gamePhase.value, pauseForTutorial, resumeFromTutorial]);

  // Clean up: ensure we resume when unmounting or leaving playing phase
  useEffect(() => {
    return () => {
      if (tutorialPauseRequested.value) {
        resumeFromTutorial();
      }
    };
  }, [resumeFromTutorial]);
}
