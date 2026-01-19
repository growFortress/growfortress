import { useState } from "preact/hooks";
import {
  showOnboardingModal,
  selectedFortressClass,
  initializeHubFromLoadout,
} from "../../state/index.js";
import { completeOnboarding, getProfile } from "../../api/client.js";
import { updateFromProfile } from "../../state/actions.js";
import { Modal } from "../shared/Modal.js";
import styles from "./OnboardingModal.module.css";

// Starter Kit - automatyczny zestaw dla nowych graczy
const STARTER_KIT = {
  fortressClass: "natural" as const,
  heroId: "vanguard" as const,
  turretType: "railgun" as const,
};

export function OnboardingModal() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setError("Wystąpił błąd. Spróbuj ponownie.");
      console.error("Onboarding error:", err);
    } finally {
      setLoading(false);
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
        {error && <div class={styles.error}>{error}</div>}

        <section class={styles.content}>
          <div class={styles.contentHeader}>
            <h2 class={styles.title}>Witaj w Grow Fortress!</h2>
            <p class={styles.subtitle}>
              Broń swojej twierdzy przed niekończącymi się falami wrogów
            </p>
          </div>

          <div class={styles.cardGrid}>
            <div class={styles.card}>
              <div class={styles.cardIcon}>🏰</div>
              <div class={styles.cardTitle}>Broń</div>
              <div class={styles.cardDescription}>
                Twierdza i wieżyczki atakują automatycznie. Używaj umiejętności
                aby wzmocnić obronę.
              </div>
            </div>
            <div class={styles.card}>
              <div class={styles.cardIcon}>🧿</div>
              <div class={styles.cardTitle}>Zbieraj</div>
              <div class={styles.cardDescription}>
                Po każdej fali wybierz relikt, który wzmocni Twoją obronę na
                całą sesję.
              </div>
            </div>
            <div class={styles.card}>
              <div class={styles.cardIcon}>⬆️</div>
              <div class={styles.cardTitle}>Ulepszaj</div>
              <div class={styles.cardDescription}>
                Zdobywaj materiały i ulepszaj swoich bohaterów oraz wieżyczki
                między sesjami.
              </div>
            </div>
          </div>

          <div class={styles.starterKit}>
            <span class={styles.starterKitLabel}>Twój starter kit:</span>
            <span class={styles.starterKitItems}>
              🌿 Twierdza Natury + 🛡️ Vanguard + ⚡ Railgun
            </span>
          </div>
        </section>

        <footer class={styles.footer}>
          <div />
          <button
            class={styles.startButton}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "Przygotowuję..." : "Rozpocznij Przygodę"}
          </button>
        </footer>
      </div>
    </Modal>
  );
}
