import type { TutorialTip, TutorialStepId } from "../state/tutorial.signals.js";

export const TUTORIAL_STEPS: Record<TutorialStepId, TutorialTip> = {
  fortress_auto_attack: {
    id: "fortress_auto_attack",
    title: "Twoja Twierdza",
    description:
      "Twierdza i wieżyczki atakują automatycznie. Obserwuj jak bronią Cię przed wrogami!",
    position: "center",
    autoDismissMs: 6000,
  },
  bomb_skill: {
    id: "bomb_skill",
    title: "Umiejętności Twierdzy",
    description:
      "Kliknij umiejętność aby zadać obrażenia wszystkim wrogom. Umiejętności ładują się z czasem.",
    highlightRef: "fortress-skills",
    position: "left",
    autoDismissMs: 8000,
  },
  relic_selection: {
    id: "relic_selection",
    title: "Wybierz Relikt",
    description:
      "Po każdej fali wybierz relikt, który wzmocni Twoją obronę na całą sesję!",
    position: "center",
    autoDismissMs: 0, // Don't auto-dismiss during choice modal
  },
  speed_controls: {
    id: "speed_controls",
    title: "Kontrola Prędkości",
    description:
      "Przyspiesz grę przyciskami 2x lub 3x gdy poczujesz się pewniej.",
    highlightRef: "speed-controls",
    position: "left",
    autoDismissMs: 6000,
  },
};
