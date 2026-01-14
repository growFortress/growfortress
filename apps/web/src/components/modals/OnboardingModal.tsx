import { useState } from 'preact/hooks';
import { showOnboardingModal, selectedFortressClass, initializeHubFromLoadout } from '../../state/index.js';
import { completeOnboarding, getProfile } from '../../api/client.js';
import { updateFromProfile } from '../../state/actions.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Modal } from '../shared/Modal.js';
import styles from './OnboardingModal.module.css';

// Starter Kit - automatyczny zestaw dla nowych graczy
const STARTER_KIT = {
  fortressClass: 'natural' as const,
  heroId: 'vanguard' as const,
  turretType: 'railgun' as const,
};

// Icons for starter kit
const STARTER_KIT_ICONS = {
  class: '🌿',
  hero: '🛡️',
  turret: '⚡',
};

type OnboardingStep = 'welcome' | 'kit' | 'ready';

export function OnboardingModal() {
  const { t } = useTranslation('modals');
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
      setError(t('onboarding.error'));
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
            <h2 class={styles.title}>{t('onboarding.welcome.title')}</h2>
            <p class={styles.subtitle}>
              {t('onboarding.welcome.subtitle')}
            </p>
            <div class={styles.features}>
              <div class={styles.feature}>
                <span class={styles.featureIcon}>⚔️</span>
                <span>{t('onboarding.welcome.buildDefense')}</span>
              </div>
              <div class={styles.feature}>
                <span class={styles.featureIcon}>🦸</span>
                <span>{t('onboarding.welcome.recruitHeroes')}</span>
              </div>
              <div class={styles.feature}>
                <span class={styles.featureIcon}>💎</span>
                <span>{t('onboarding.welcome.collectRewards')}</span>
              </div>
            </div>
            <button class={styles.nextButton} onClick={handleNext}>
              {t('onboarding.next')}
            </button>
          </div>
        )}

        {/* Step 2: Starter Kit */}
        {step === 'kit' && (
          <div class={styles.kitStep}>
            <h2 class={styles.title}>{t('onboarding.starterKit.title')}</h2>
            <p class={styles.subtitle}>
              {t('onboarding.starterKit.subtitle')}
            </p>

            <div class={styles.kitGrid}>
              <div class={styles.kitItem}>
                <div class={styles.kitIcon}>{STARTER_KIT_ICONS.class}</div>
                <div class={styles.kitLabel}>{t('onboarding.starterKit.class')}</div>
                <div class={styles.kitName}>{t('onboarding.starterKit.className')}</div>
                <div class={styles.kitDesc}>{t('onboarding.starterKit.classDesc')}</div>
              </div>

              <div class={styles.kitItem}>
                <div class={styles.kitIcon}>{STARTER_KIT_ICONS.hero}</div>
                <div class={styles.kitLabel}>{t('onboarding.starterKit.hero')}</div>
                <div class={styles.kitName}>{t('onboarding.starterKit.heroName')}</div>
                <div class={styles.kitDesc}>{t('onboarding.starterKit.heroDesc')}</div>
              </div>

              <div class={styles.kitItem}>
                <div class={styles.kitIcon}>{STARTER_KIT_ICONS.turret}</div>
                <div class={styles.kitLabel}>{t('onboarding.starterKit.turret')}</div>
                <div class={styles.kitName}>{t('onboarding.starterKit.turretName')}</div>
                <div class={styles.kitDesc}>{t('onboarding.starterKit.turretDesc')}</div>
              </div>
            </div>

            <p class={styles.hint}>
              {t('onboarding.starterKit.hint')}
            </p>

            <div class={styles.buttonRow}>
              <button class={styles.backButton} onClick={handleBack}>
                {t('onboarding.back')}
              </button>
              <button class={styles.nextButton} onClick={handleNext}>
                {t('onboarding.next')}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ready */}
        {step === 'ready' && (
          <div class={styles.readyStep}>
            <div class={styles.readyIcon}>🎮</div>
            <h2 class={styles.title}>{t('onboarding.ready.title')}</h2>
            <p class={styles.subtitle}>
              {t('onboarding.ready.subtitle')}
            </p>

            <div class={styles.tips}>
              <div class={styles.tip}>
                <span class={styles.tipIcon}>💡</span>
                <span dangerouslySetInnerHTML={{ __html: t('onboarding.ready.tipBomb') }} />
              </div>
              <div class={styles.tip}>
                <span class={styles.tipIcon}>💡</span>
                <span>{t('onboarding.ready.tipAuto')}</span>
              </div>
              <div class={styles.tip}>
                <span class={styles.tipIcon}>💡</span>
                <span>{t('onboarding.ready.tipRelic')}</span>
              </div>
            </div>

            <div class={styles.buttonRow}>
              <button class={styles.backButton} onClick={handleBack} disabled={loading}>
                {t('onboarding.back')}
              </button>
              <button class={styles.startButton} onClick={handleStart} disabled={loading}>
                {loading ? t('onboarding.preparing') : t('onboarding.startAdventure')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
