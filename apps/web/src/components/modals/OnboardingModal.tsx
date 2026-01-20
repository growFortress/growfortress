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

// Starter Kit - automatic loadout for new players
const STARTER_KIT = {
  fortressClass: "natural" as const,
  heroId: "vanguard" as const,
  turretType: "railgun" as const,
};

const TOTAL_STEPS = 3;

type OnboardingStep = "welcome" | "synergy" | "ready";

const STEPS: OnboardingStep[] = ["welcome", "synergy", "ready"];

export function OnboardingModal() {
  const { t } = useTranslation("modals");
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[currentStep];

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await handleStart();
  };

  const handleStart = async () => {
    setLoading(true);
    setError(null);

    try {
      // Auto-set Starter Kit
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

  const renderStepContent = () => {
    switch (step) {
      case "welcome":
        return (
          <>
            <div class={styles.contentHeader}>
              <h2 class={styles.title}>
                {t("onboarding.steps.welcome.title")}
              </h2>
              <p class={styles.subtitle}>
                {t("onboarding.steps.welcome.subtitle")}
              </p>
            </div>

            <div class={styles.cardGrid}>
              <div class={styles.card}>
                <div class={styles.cardIcon}>🌊</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.welcome.cards.endless.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.welcome.cards.endless.description")}
                </div>
              </div>
              <div class={styles.card}>
                <div class={styles.cardIcon}>🎯</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.welcome.cards.squad.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.welcome.cards.squad.description")}
                </div>
              </div>
              <div class={styles.card}>
                <div class={styles.cardIcon}>📈</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.welcome.cards.progression.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.welcome.cards.progression.description")}
                </div>
              </div>
            </div>
          </>
        );

      case "synergy":
        return (
          <>
            <div class={styles.contentHeader}>
              <h2 class={styles.title}>
                {t("onboarding.steps.synergy.title")}
              </h2>
              <p class={styles.subtitle}>
                {t("onboarding.steps.synergy.subtitle")}
              </p>
            </div>

            <div class={styles.cardGrid}>
              <div class={`${styles.card} ${styles.synergyCard}`}>
                <div class={styles.cardIcon}>🌿</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.synergy.cards.fortress.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.synergy.cards.fortress.description")}
                </div>
                <div class={styles.synergyBenefit}>
                  {t("onboarding.steps.synergy.cards.fortress.benefit")}
                </div>
              </div>
              <div class={`${styles.card} ${styles.synergyCard}`}>
                <div class={styles.cardIcon}>🛡️</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.synergy.cards.hero.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.synergy.cards.hero.description")}
                </div>
                <div class={styles.synergyBenefit}>
                  {t("onboarding.steps.synergy.cards.hero.benefit")}
                </div>
              </div>
              <div class={`${styles.card} ${styles.synergyCard}`}>
                <div class={styles.cardIcon}>⚡</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.synergy.cards.turret.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.synergy.cards.turret.description")}
                </div>
                <div class={styles.synergyBenefit}>
                  {t("onboarding.steps.synergy.cards.turret.benefit")}
                </div>
              </div>
            </div>

            <div class={styles.synergyExplanation}>
              <div class={styles.synergyArrow}>+</div>
              <div class={styles.synergyResult}>
                <span class={styles.synergyResultIcon}>🔗</span>
                <span class={styles.synergyResultText}>
                  {t("onboarding.steps.synergy.result")}
                </span>
              </div>
            </div>
          </>
        );

      case "ready":
        return (
          <>
            <div class={styles.contentHeader}>
              <h2 class={styles.title}>
                {t("onboarding.steps.ready.title")}
              </h2>
              <p class={styles.subtitle}>
                {t("onboarding.steps.ready.subtitle")}
              </p>
            </div>

            <div class={styles.cardGrid}>
              <div class={styles.card}>
                <div class={styles.cardIcon}>⚔️</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.ready.cards.auto.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.ready.cards.auto.description")}
                </div>
              </div>
              <div class={styles.card}>
                <div class={styles.cardIcon}>🧿</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.ready.cards.relics.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.ready.cards.relics.description")}
                </div>
              </div>
              <div class={styles.card}>
                <div class={styles.cardIcon}>⬆️</div>
                <div class={styles.cardTitle}>
                  {t("onboarding.steps.ready.cards.upgrades.title")}
                </div>
                <div class={styles.cardDescription}>
                  {t("onboarding.steps.ready.cards.upgrades.description")}
                </div>
              </div>
            </div>

            <div class={styles.starterKit}>
              <span class={styles.starterKitLabel}>
                {t("onboarding.steps.ready.starterKit")}
              </span>
              <span class={styles.starterKitItems}>
                🌿 Natural + 🛡️ Vanguard + ⚡ Railgun
              </span>
            </div>
          </>
        );
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS - 1;

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
        {/* Header with progress */}
        <header class={styles.header}>
          <div class={styles.progress}>
            <span class={styles.stepLabel}>
              {t("onboarding.stepLabel", {
                current: currentStep + 1,
                total: TOTAL_STEPS,
              })}
            </span>
            <div class={styles.progressBar}>
              <div
                class={styles.progressFill}
                style={{ width: `${((currentStep + 1) / TOTAL_STEPS) * 100}%` }}
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

        <section class={styles.content}>{renderStepContent()}</section>

        <footer class={styles.footer}>
          {currentStep > 0 ? (
            <button
              class={styles.backButton}
              onClick={handleBack}
              disabled={loading}
            >
              {t("onboarding.back")}
            </button>
          ) : (
            <div />
          )}

          {isLastStep ? (
            <button
              class={styles.startButton}
              onClick={handleStart}
              disabled={loading}
            >
              {loading
                ? t("onboarding.preparing")
                : t("onboarding.startAdventure")}
            </button>
          ) : (
            <button
              class={styles.nextButton}
              onClick={handleNext}
              disabled={loading}
            >
              {t("onboarding.next")}
            </button>
          )}
        </footer>
      </div>
    </Modal>
  );
}
