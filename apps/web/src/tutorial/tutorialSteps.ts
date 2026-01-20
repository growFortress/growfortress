import type { TutorialTip, TutorialStepId } from "../state/tutorial.signals.js";

// Tutorial step configuration (without translations - use getTutorialSteps for i18n)
export interface TutorialStepConfig {
  id: TutorialStepId;
  highlightRef?: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  autoDismissMs?: number;
}

export const TUTORIAL_STEP_CONFIGS: Record<TutorialStepId, TutorialStepConfig> = {
  fortress_auto_attack: {
    id: "fortress_auto_attack",
    position: "center",
    autoDismissMs: 6000,
  },
  bomb_skill: {
    id: "bomb_skill",
    highlightRef: "fortress-skills",
    position: "left",
    autoDismissMs: 8000,
  },
  relic_selection: {
    id: "relic_selection",
    position: "center",
    autoDismissMs: 0, // Don't auto-dismiss during choice modal
  },
  speed_controls: {
    id: "speed_controls",
    highlightRef: "speed-controls",
    position: "left",
    autoDismissMs: 6000,
  },
  build_synergy: {
    id: "build_synergy",
    position: "center",
    autoDismissMs: 10000,
  },
};

// Generate tutorial steps with translations
type TranslationFunction = (key: string) => string;

export function getTutorialSteps(t: TranslationFunction): Record<TutorialStepId, TutorialTip> {
  return {
    fortress_auto_attack: {
      ...TUTORIAL_STEP_CONFIGS.fortress_auto_attack,
      title: t("tutorial.fortressAutoAttack.title"),
      description: t("tutorial.fortressAutoAttack.description"),
    },
    bomb_skill: {
      ...TUTORIAL_STEP_CONFIGS.bomb_skill,
      title: t("tutorial.bombSkill.title"),
      description: t("tutorial.bombSkill.description"),
    },
    relic_selection: {
      ...TUTORIAL_STEP_CONFIGS.relic_selection,
      title: t("tutorial.relicSelection.title"),
      description: t("tutorial.relicSelection.description"),
    },
    speed_controls: {
      ...TUTORIAL_STEP_CONFIGS.speed_controls,
      title: t("tutorial.speedControls.title"),
      description: t("tutorial.speedControls.description"),
    },
    build_synergy: {
      ...TUTORIAL_STEP_CONFIGS.build_synergy,
      title: t("tutorial.buildSynergy.title"),
      description: t("tutorial.buildSynergy.description"),
    },
  };
}

// Legacy static export for backwards compatibility (Polish only)
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
    autoDismissMs: 0,
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
  build_synergy: {
    id: "build_synergy",
    title: "Synergia Buildu",
    description:
      "Vanguard tankuje, Railgun eliminuje cele, Twierdza Natury regeneruje HP. Szukaj reliktów wzmacniających Natural!",
    position: "center",
    autoDismissMs: 10000,
  },
};
