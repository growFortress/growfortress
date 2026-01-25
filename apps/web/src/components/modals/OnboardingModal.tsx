import { useState, useEffect } from "preact/hooks";
import {
  showOnboardingModal,
  selectedFortressClass,
  initializeHubFromLoadout,
  gamePhase,
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

// Simplified onboarding - single step instead of 3
const TOTAL_STEPS = 1;

type OnboardingStep = "quick";

const STEPS: OnboardingStep[] = ["quick"];

export function OnboardingModal() {
  const { t } = useTranslation("modals");
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoCompleting, setAutoCompleting] = useState(false);

  // Step is used for multi-step flow - kept for potential future expansion
  const _step = STEPS[currentStep];
  void _step;

  // Auto-complete onboarding if player is already in game (came from auto-start)
  useEffect(() => {
    if (showOnboardingModal.value && gamePhase.value === 'playing' && !autoCompleting) {
      setAutoCompleting(true);
      // Player is already playing - just complete onboarding silently in background
      completeOnboarding({
        fortressClass: STARTER_KIT.fortressClass,
        heroId: STARTER_KIT.heroId,
        turretType: STARTER_KIT.turretType,
      }).then(() => {
        return getProfile();
      }).then((profile) => {
        updateFromProfile(profile);
        showOnboardingModal.value = false;
      }).catch((err) => {
        console.error("Background onboarding error:", err);
        // Still close modal - player is already playing
        showOnboardingModal.value = false;
      });
    }
  }, [showOnboardingModal.value, gamePhase.value, autoCompleting]);

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
    // Simplified single-step onboarding
    return (
      <>
        <div class={styles.contentHeader}>
          <h2 class={styles.title}>
            {t("onboarding.steps.quick.title", { defaultValue: "Defend Your Fortress!" })}
          </h2>
          <p class={styles.subtitle}>
            {t("onboarding.steps.quick.subtitle", { defaultValue: "Survive waves of enemies and grow stronger" })}
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
