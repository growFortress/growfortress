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
  fortress_upgrades: {
    id: "fortress_upgrades",
    highlightRef: "fortress-upgrades",
    position: "left",
    autoDismissMs: 9000,
  },
  hero_stat_upgrades: {
    id: "hero_stat_upgrades",
    highlightRef: "hero-stat-upgrades",
    position: "right",
    autoDismissMs: 9000,
  },
  hero_tiers: {
    id: "hero_tiers",
    highlightRef: "hero-tier-upgrade",
    position: "bottom",
    autoDismissMs: 9000,
  },
  fortress_unlocks: {
    id: "fortress_unlocks",
    highlightRef: "fortress-tier",
    position: "left",
    autoDismissMs: 9000,
  },
  manual_control: {
    id: "manual_control",
    highlightRef: "game-canvas",
    position: "center",
    autoDismissMs: 9000,
  },
  hero_drag: {
    id: "hero_drag",
    highlightRef: "game-canvas",
    position: "center",
    autoDismissMs: 9000,
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
    fortress_upgrades: {
      ...TUTORIAL_STEP_CONFIGS.fortress_upgrades,
      title: t("tutorial.fortressUpgrades.title"),
      description: t("tutorial.fortressUpgrades.description"),
    },
    hero_stat_upgrades: {
      ...TUTORIAL_STEP_CONFIGS.hero_stat_upgrades,
      title: t("tutorial.heroStatUpgrades.title"),
      description: t("tutorial.heroStatUpgrades.description"),
    },
    hero_tiers: {
      ...TUTORIAL_STEP_CONFIGS.hero_tiers,
      title: t("tutorial.heroTiers.title"),
      description: t("tutorial.heroTiers.description"),
    },
    fortress_unlocks: {
      ...TUTORIAL_STEP_CONFIGS.fortress_unlocks,
      title: t("tutorial.fortressUnlocks.title"),
      description: t("tutorial.fortressUnlocks.description"),
    },
    manual_control: {
      ...TUTORIAL_STEP_CONFIGS.manual_control,
      title: t("tutorial.manualControl.title"),
      description: t("tutorial.manualControl.description"),
    },
    hero_drag: {
      ...TUTORIAL_STEP_CONFIGS.hero_drag,
      title: t("tutorial.heroDrag.title"),
      description: t("tutorial.heroDrag.description"),
    },
  };
}

// Legacy static export for backwards compatibility (Polish only)
export const TUTORIAL_STEPS: Record<TutorialStepId, TutorialTip> = {
  fortress_auto_attack: {
    id: "fortress_auto_attack",
    title: "Twoja Twierdza",
    description:
      "Twierdza i wieÅ¼yczki atakujÄ… automatycznie. Obserwuj jak broniÄ… CiÄ™ przed wrogami!",
    position: "center",
    autoDismissMs: 6000,
  },
  bomb_skill: {
    id: "bomb_skill",
    title: "UmiejÄ™tnoÅ›ci Twierdzy",
    description:
      "Kliknij umiejÄ™tnoÅ›Ä‡ aby zadaÄ‡ obraÅ¼enia wszystkim wrogom. UmiejÄ™tnoÅ›ci Å‚adujÄ… siÄ™ z czasem.",
    highlightRef: "fortress-skills",
    position: "left",
    autoDismissMs: 8000,
  },
  relic_selection: {
    id: "relic_selection",
    title: "Wybierz Relikt",
    description:
      "Po kaÅ¼dej fali wybierz relikt, ktÃ³ry wzmocni TwojÄ… obronÄ™ na caÅ‚Ä… sesjÄ™!",
    position: "center",
    autoDismissMs: 0,
  },
  speed_controls: {
    id: "speed_controls",
    title: "Kontrola PrÄ™dkoÅ›ci",
    description:
      "Przyspiesz grÄ™ przyciskami 2x lub 3x gdy poczujesz siÄ™ pewniej.",
    highlightRef: "speed-controls",
    position: "left",
    autoDismissMs: 6000,
  },
  build_synergy: {
    id: "build_synergy",
    title: "Synergia Buildu",
    description:
      "Vanguard tankuje, Railgun eliminuje cele, Twierdza Natury regeneruje HP. Szukaj reliktÃ³w wzmacniajÄ…cych Natural!",
    position: "center",
    autoDismissMs: 10000,
  },
  fortress_upgrades: {
    id: "fortress_upgrades",
    title: "Ulepszenia Twierdzy",
    description:
      "Wydawaj zloto, aby na stale wzmocnic HP, obrazenia i pancerz twierdzy.",
    highlightRef: "fortress-upgrades",
    position: "left",
    autoDismissMs: 9000,
  },
  hero_stat_upgrades: {
    id: "hero_stat_upgrades",
    title: "Ulepszenia statystyk bohatera",
    description:
      "Ulepszaj HP i obrazenia bohatera za zloto, aby byl silniejszy miedzy runami.",
    highlightRef: "hero-stat-upgrades",
    position: "right",
    autoDismissMs: 9000,
  },
  hero_tiers: {
    id: "hero_tiers",
    title: "Tiery bohatera",
    description:
      "Ulepsz tier bohatera, aby odblokowac nowe umiejetnosci i wieksze mnozniki.",
    highlightRef: "hero-tier-upgrade",
    position: "bottom",
    autoDismissMs: 9000,
  },
  fortress_unlocks: {
    id: "fortress_unlocks",
    title: "Tiery i odblokowania",
    description:
      "Wyzszy poziom twierdzy odblokowuje nowe sloty i funkcje. Sprawdz postep tierow.",
    highlightRef: "fortress-tier",
    position: "left",
    autoDismissMs: 9000,
  },

  manual_control: {
    id: "manual_control",
    title: "Manualna kontrola",
    description:
      "Kliknij bohatera, aby przejÄ…Ä‡ kontrolÄ™. Ruch: WASD, strzaÅ‚: PPM, wyjÅ›cie: Esc.",
    highlightRef: "game-canvas",
    position: "center",
    autoDismissMs: 9000,
  },
  hero_drag: {
    id: "hero_drag",
    title: "Przesuwanie bohaterÃ³w",
    description:
      "MoÅ¼esz przeciÄ…gnÄ…Ä‡ bohatera na polu bitwy, aby zmieniÄ‡ jego pozycjÄ™.",
    highlightRef: "game-canvas",
    position: "center",
    autoDismissMs: 9000,
  },
};

