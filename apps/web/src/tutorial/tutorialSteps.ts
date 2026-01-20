import type { TutorialTip, TutorialStepId } from "../state/tutorial.signals.js";

export const TUTORIAL_STEPS: Record<TutorialStepId, TutorialTip> = {
  fortress_auto_attack: {
    id: "fortress_auto_attack",
    title: "game:tutorial.tips.fortress_auto_attack.title",
    description: "game:tutorial.tips.fortress_auto_attack.description",
    position: "center",
    autoDismissMs: 6000,
  },
  bomb_skill: {
    id: "bomb_skill",
    title: "game:tutorial.tips.bomb_skill.title",
    description: "game:tutorial.tips.bomb_skill.description",
    highlightRef: "fortress-skills",
    position: "left",
    autoDismissMs: 8000,
  },
  relic_selection: {
    id: "relic_selection",
    title: "game:tutorial.tips.relic_selection.title",
    description: "game:tutorial.tips.relic_selection.description",
    position: "center",
    autoDismissMs: 0, // Don't auto-dismiss during choice modal
  },
  speed_controls: {
    id: "speed_controls",
    title: "game:tutorial.tips.speed_controls.title",
    description: "game:tutorial.tips.speed_controls.description",
    highlightRef: "speed-controls",
    position: "left",
    autoDismissMs: 6000,
  },
};
