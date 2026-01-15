import { useState } from "preact/hooks";
import {
  showOnboardingModal,
  selectedFortressClass,
  initializeHubFromLoadout,
} from "../../state/index.js";
import { completeOnboarding, getProfile } from "../../api/client.js";
import { updateFromProfile } from "../../state/actions.js";
import { useTranslation } from "../../i18n/useTranslation.js";
import { Modal } from "../shared/Modal.js";
import styles from "./OnboardingModal.module.css";

// Starter Kit - automatyczny zestaw dla nowych graczy
const STARTER_KIT = {
  fortressClass: "natural" as const,
  heroId: "vanguard" as const,
  turretType: "railgun" as const,
};

type OnboardingCard = {
  icon: string;
  title: string;
  description: string;
};

type OnboardingStep = {
  id: string;
  title: string;
  subtitle: string;
  cards: OnboardingCard[];
  hint?: string;
  finalTips?: {
    title: string;
    items: string[];
  };
};

export function OnboardingModal() {
  const { t } = useTranslation("modals");
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: t("onboarding.steps.welcome.title"),
      subtitle: t("onboarding.steps.welcome.subtitle"),
      cards: [
        {
          icon: "🛡️",
          title: t("onboarding.steps.welcome.cards.endless.title"),
          description: t("onboarding.steps.welcome.cards.endless.description"),
        },
        {
          icon: "🧩",
          title: t("onboarding.steps.welcome.cards.squad.title"),
          description: t("onboarding.steps.welcome.cards.squad.description"),
        },
        {
          icon: "📈",
          title: t("onboarding.steps.welcome.cards.progression.title"),
          description: t(
            "onboarding.steps.welcome.cards.progression.description",
          ),
        },
      ],
    },
    {
      id: "core-loop",
      title: t("onboarding.steps.coreLoop.title"),
      subtitle: t("onboarding.steps.coreLoop.subtitle"),
      cards: [
        {
          icon: "🌊",
          title: t("onboarding.steps.coreLoop.cards.waves.title"),
          description: t("onboarding.steps.coreLoop.cards.waves.description"),
        },
        {
          icon: "🧿",
          title: t("onboarding.steps.coreLoop.cards.relics.title"),
          description: t("onboarding.steps.coreLoop.cards.relics.description"),
        },
        {
          icon: "💾",
          title: t("onboarding.steps.coreLoop.cards.sessions.title"),
          description: t(
            "onboarding.steps.coreLoop.cards.sessions.description",
          ),
        },
      ],
    },
    {
      id: "starter-kit",
      title: t("onboarding.steps.starterKit.title"),
      subtitle: t("onboarding.steps.starterKit.subtitle"),
      cards: [
        {
          icon: "🌿",
          title: t("onboarding.steps.starterKit.cards.class.title"),
          description: t("onboarding.steps.starterKit.cards.class.description"),
        },
        {
          icon: "🛡️",
          title: t("onboarding.steps.starterKit.cards.hero.title"),
          description: t("onboarding.steps.starterKit.cards.hero.description"),
        },
        {
          icon: "⚡",
          title: t("onboarding.steps.starterKit.cards.turret.title"),
          description: t(
            "onboarding.steps.starterKit.cards.turret.description",
          ),
        },
      ],
      hint: t("onboarding.steps.starterKit.hint"),
    },
    {
      id: "progression",
      title: t("onboarding.steps.progression.title"),
      subtitle: t("onboarding.steps.progression.subtitle"),
      cards: [
        {
          icon: "🏰",
          title: t("onboarding.steps.progression.cards.classes.title"),
          description: t(
            "onboarding.steps.progression.cards.classes.description",
          ),
        },
        {
          icon: "⬆️",
          title: t("onboarding.steps.progression.cards.tiers.title"),
          description: t(
            "onboarding.steps.progression.cards.tiers.description",
          ),
        },
        {
          icon: "⚙️",
          title: t("onboarding.steps.progression.cards.upgrades.title"),
          description: t(
            "onboarding.steps.progression.cards.upgrades.description",
          ),
        },
      ],
    },
    {
      id: "pvp-guilds",
      title: t("onboarding.steps.pvpGuilds.title"),
      subtitle: t("onboarding.steps.pvpGuilds.subtitle"),
      cards: [
        {
          icon: "⚔️",
          title: t("onboarding.steps.pvpGuilds.cards.pvp.title"),
          description: t("onboarding.steps.pvpGuilds.cards.pvp.description"),
        },
        {
          icon: "🛡️",
          title: t("onboarding.steps.pvpGuilds.cards.guilds.title"),
          description: t("onboarding.steps.pvpGuilds.cards.guilds.description"),
        },
        {
          icon: "🏆",
          title: t("onboarding.steps.pvpGuilds.cards.leaderboards.title"),
          description: t(
            "onboarding.steps.pvpGuilds.cards.leaderboards.description",
          ),
        },
      ],
      finalTips: {
        title: t("onboarding.finalTips.title"),
        items: [
          t("onboarding.finalTips.items.auto"),
          t("onboarding.finalTips.items.relics"),
          t("onboarding.finalTips.items.skills"),
        ],
      },
    },
  ];

  const currentStep = steps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === steps.length - 1;
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      // Automatycznie ustawia Starter Kit
      await completeOnboarding({
        fortressClass: STARTER_KIT.fortressClass,
        heroId: STARTER_KIT.heroId,
        turretType: STARTER_KIT.turretType,
      });

      // Refresh profile to get updated state
      const profile = await getProfile();
      updateFromProfile(profile);

      // Update fortress class signal
      selectedFortressClass.value = STARTER_KIT.fortressClass;

      // Initialize hub with default loadout
      initializeHubFromLoadout();

      // Close modal
      showOnboardingModal.value = false;
    } catch (err) {
      setError(t("onboarding.error"));
      console.error("Onboarding error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (!loading) {
      void handleStart();
    }
  };

  return (
    <Modal
      visible={showOnboardingModal.value}
      size="fullscreen"
      class={styles.modal}
      bodyClass={styles.body}
      closeOnBackdropClick={false}
      showCloseButton={false}
    >
      <div class={styles.container}>
        <header class={styles.header}>
          <div class={styles.progress}>
            <span class={styles.stepLabel}>
              {t("onboarding.stepLabel", {
                current: stepIndex + 1,
                total: steps.length,
              })}
            </span>
            <div class={styles.progressBar}>
              <div
                class={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            class={styles.skipButton}
            onClick={handleSkip}
            disabled={loading}
          >
            {t("onboarding.skip")}
          </button>
        </header>

        {error && <div class={styles.error}>{error}</div>}

        <section class={styles.content}>
          <div class={styles.contentHeader}>
            <h2 class={styles.title}>{currentStep.title}</h2>
            <p class={styles.subtitle}>{currentStep.subtitle}</p>
          </div>

          <div class={styles.cardGrid}>
            {currentStep.cards.map((card) => (
              <div key={card.title} class={styles.card}>
                <div class={styles.cardIcon}>{card.icon}</div>
                <div class={styles.cardTitle}>{card.title}</div>
                <div class={styles.cardDescription}>{card.description}</div>
              </div>
            ))}
          </div>

          {currentStep.hint && <p class={styles.hint}>{currentStep.hint}</p>}

          {currentStep.finalTips && (
            <div class={styles.finalTips}>
              <div class={styles.finalTipsTitle}>
                {currentStep.finalTips.title}
              </div>
              <ul class={styles.tipsList}>
                {currentStep.finalTips.items.map((tip) => (
                  <li key={tip} class={styles.tipItem}>
                    <span class={styles.tipIcon}>•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <footer class={styles.footer}>
          <button
            class={styles.backButton}
            onClick={handleBack}
            disabled={isFirstStep || loading}
          >
            {t("onboarding.back")}
          </button>
          {!isLastStep ? (
            <button class={styles.nextButton} onClick={handleNext}>
              {t("onboarding.next")}
            </button>
          ) : (
            <button
              class={styles.startButton}
              onClick={handleStart}
              disabled={loading}
            >
              {loading
                ? t("onboarding.preparing")
                : t("onboarding.startAdventure")}
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
