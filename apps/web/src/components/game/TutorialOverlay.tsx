import { useEffect, useState } from 'preact/hooks';
import { gameState, gamePhase } from '../../state/index.js';
import styles from './TutorialOverlay.module.css';

interface TutorialStep {
  wave: number;
  icon: string;
  title: string;
  description: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    wave: 1,
    icon: '🏰',
    title: 'Twoja Twierdza',
    description: 'Twierdza i wieżyczki atakują automatycznie. Obserwuj jak pociski trafiają wrogów!',
  },
  {
    wave: 2,
    icon: '💣',
    title: 'Umiejętność BOMB',
    description: 'Kliknij przycisk BOMB aby zadać obrażenia wszystkim wrogom w zasięgu!',
  },
  {
    wave: 3,
    icon: '✨',
    title: 'Relikty',
    description: 'Po każdej fali wybierz relikt. Relikty wzmacniają twoją obronę na całą sesję!',
  },
];

// Tutorial is shown for first 3 waves
const MAX_TUTORIAL_WAVE = 3;

export function TutorialOverlay() {
  const [dismissed, setDismissed] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialStep | null>(null);

  const wave = gameState.value?.wave ?? 0;
  const phase = gamePhase.value;

  useEffect(() => {
    // Reset dismissed state when wave changes
    if (wave > 0 && wave <= MAX_TUTORIAL_WAVE) {
      setDismissed(false);
    }
  }, [wave]);

  useEffect(() => {
    // Find the step for current wave
    if (phase === 'playing' && wave > 0 && wave <= MAX_TUTORIAL_WAVE && !dismissed) {
      const step = TUTORIAL_STEPS.find(s => s.wave === wave);
      setCurrentStep(step || null);
    } else {
      setCurrentStep(null);
    }
  }, [wave, phase, dismissed]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (currentStep) {
      const timer = setTimeout(() => {
        setDismissed(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [currentStep]);

  if (!currentStep) {
    return null;
  }

  return (
    <div class={styles.overlay} onClick={() => setDismissed(true)}>
      <div class={styles.tooltip}>
        <div class={styles.waveIndicator}>Fala {currentStep.wave}</div>
        <div class={styles.icon}>{currentStep.icon}</div>
        <h3 class={styles.title}>{currentStep.title}</h3>
        <p class={styles.description}>{currentStep.description}</p>
        <div class={styles.dismissHint}>Kliknij aby zamknąć</div>
        <div class={styles.progress}>
          {TUTORIAL_STEPS.map((step) => (
            <div
              key={step.wave}
              class={`${styles.dot} ${step.wave === currentStep.wave ? styles.active : ''} ${step.wave < currentStep.wave ? styles.completed : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
