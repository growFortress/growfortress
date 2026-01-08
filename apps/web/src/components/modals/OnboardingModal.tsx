import { useState } from 'preact/hooks';
import { showOnboardingModal, selectedFortressClass, initializeHubFromLoadout } from '../../state/index.js';
import { completeOnboarding, getProfile } from '../../api/client.js';
import { updateFromProfile } from '../../state/actions.js';
import { Modal } from '../shared/Modal.js';
import styles from './OnboardingModal.module.css';

// Starter Kit - automatyczny zestaw dla nowych graczy
const STARTER_KIT = {
  fortressClass: 'natural' as const,
  heroId: 'shield_captain' as const,
  turretType: 'arrow' as const,
};

// Starter Kit display info
const STARTER_KIT_INFO = {
  class: { name: 'Twierdza Natury', icon: '🌿', description: 'Zbalansowana obrona i regeneracja' },
  hero: { name: 'Shield Captain', icon: '🛡️', description: 'Wytrzymały bohater z tarczą ochronną' },
  turret: { name: 'Wieża Łucznicza', icon: '🏹', description: 'Szybkie i precyzyjne strzały' },
};

type OnboardingStep = 'welcome' | 'kit' | 'ready';

export function OnboardingModal() {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (step === 'welcome') {
      setStep('kit');
    } else if (step === 'kit') {
      setStep('ready');
    }
  };

  const handleBack = () => {
    if (step === 'kit') {
      setStep('welcome');
    } else if (step === 'ready') {
      setStep('kit');
    }
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
      setError('Wystąpił błąd. Spróbuj ponownie.');
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={showOnboardingModal.value} class={styles.modal}>
      <div class={styles.container}>
        {/* Step Indicator */}
        <div class={styles.stepIndicator}>
          <div class={`${styles.stepDot} ${step === 'welcome' ? styles.active : styles.completed}`}>1</div>
          <div class={styles.stepLine} />
          <div class={`${styles.stepDot} ${step === 'kit' ? styles.active : ''} ${step === 'ready' ? styles.completed : ''}`}>2</div>
          <div class={styles.stepLine} />
          <div class={`${styles.stepDot} ${step === 'ready' ? styles.active : ''}`}>3</div>
        </div>

        {error && <div class={styles.error}>{error}</div>}

        {/* Step 1: Welcome */}
        {step === 'welcome' && (
          <div class={styles.welcomeStep}>
            <div class={styles.welcomeIcon}>🏰</div>
            <h2 class={styles.title}>Witaj, Obrońco!</h2>
            <p class={styles.subtitle}>
              Twoja twierdza potrzebuje ochrony przed nadciągającymi hordami wrogów.
            </p>
            <div class={styles.features}>
              <div class={styles.feature}>
                <span class={styles.featureIcon}>⚔️</span>
                <span>Buduj obronę</span>
              </div>
              <div class={styles.feature}>
                <span class={styles.featureIcon}>🦸</span>
                <span>Rekrutuj bohaterów</span>
              </div>
              <div class={styles.feature}>
                <span class={styles.featureIcon}>💎</span>
                <span>Zbieraj nagrody</span>
              </div>
            </div>
            <button class={styles.nextButton} onClick={handleNext}>
              Dalej →
            </button>
          </div>
        )}

        {/* Step 2: Starter Kit */}
        {step === 'kit' && (
          <div class={styles.kitStep}>
            <h2 class={styles.title}>Twój Starter Kit</h2>
            <p class={styles.subtitle}>
              Otrzymujesz zestaw startowy, który pomoże Ci w pierwszych bitwach.
            </p>

            <div class={styles.kitGrid}>
              <div class={styles.kitItem}>
                <div class={styles.kitIcon}>{STARTER_KIT_INFO.class.icon}</div>
                <div class={styles.kitLabel}>Klasa</div>
                <div class={styles.kitName}>{STARTER_KIT_INFO.class.name}</div>
                <div class={styles.kitDesc}>{STARTER_KIT_INFO.class.description}</div>
              </div>

              <div class={styles.kitItem}>
                <div class={styles.kitIcon}>{STARTER_KIT_INFO.hero.icon}</div>
                <div class={styles.kitLabel}>Bohater</div>
                <div class={styles.kitName}>{STARTER_KIT_INFO.hero.name}</div>
                <div class={styles.kitDesc}>{STARTER_KIT_INFO.hero.description}</div>
              </div>

              <div class={styles.kitItem}>
                <div class={styles.kitIcon}>{STARTER_KIT_INFO.turret.icon}</div>
                <div class={styles.kitLabel}>Wieżyczka</div>
                <div class={styles.kitName}>{STARTER_KIT_INFO.turret.name}</div>
                <div class={styles.kitDesc}>{STARTER_KIT_INFO.turret.description}</div>
              </div>
            </div>

            <p class={styles.hint}>
              Więcej klas, bohaterów i wieżyczek odblokujesz w miarę postępów!
            </p>

            <div class={styles.buttonRow}>
              <button class={styles.backButton} onClick={handleBack}>
                ← Wstecz
              </button>
              <button class={styles.nextButton} onClick={handleNext}>
                Dalej →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 'ready' && (
          <div class={styles.readyStep}>
            <div class={styles.readyIcon}>🎮</div>
            <h2 class={styles.title}>Gotowy do walki!</h2>
            <p class={styles.subtitle}>
              Twoja twierdza jest gotowa. Czas odpierać ataki wrogów!
            </p>

            <div class={styles.tips}>
              <div class={styles.tip}>
                <span class={styles.tipIcon}>💡</span>
                <span>Kliknij <strong>BOMB</strong> aby użyć umiejętności specjalnej</span>
              </div>
              <div class={styles.tip}>
                <span class={styles.tipIcon}>💡</span>
                <span>Twój bohater i wieżyczki atakują automatycznie</span>
              </div>
              <div class={styles.tip}>
                <span class={styles.tipIcon}>💡</span>
                <span>Po każdej fali wybierz relikt, który wzmocni obronę</span>
              </div>
            </div>

            <div class={styles.buttonRow}>
              <button class={styles.backButton} onClick={handleBack} disabled={loading}>
                ← Wstecz
              </button>
              <button class={styles.startButton} onClick={handleStart} disabled={loading}>
                {loading ? 'Przygotowywanie...' : 'Rozpocznij przygodę!'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
