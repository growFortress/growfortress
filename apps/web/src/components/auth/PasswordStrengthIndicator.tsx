import { useMemo } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './PasswordStrengthIndicator.module.css';

interface PasswordStrengthIndicatorProps {
  password: string;
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong';

function calculateStrength(password: string): number {
  if (!password) return 0;
  
  let strength = 0;
  
  // Length scoring
  if (password.length >= 6) strength += 25;
  if (password.length >= 10) strength += 25;
  
  // Character variety scoring
  if (/[A-Z]/.test(password)) strength += 15;
  if (/[a-z]/.test(password)) strength += 10;
  if (/[0-9]/.test(password)) strength += 15;
  if (/[^A-Za-z0-9]/.test(password)) strength += 10;
  
  return Math.min(strength, 100);
}

function getStrengthLevel(score: number): StrengthLevel {
  if (score === 0) return 'weak';
  if (score <= 40) return 'weak';
  if (score <= 60) return 'fair';
  if (score <= 80) return 'good';
  return 'strong';
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { t } = useTranslation('auth');
  
  const strength = useMemo(() => calculateStrength(password), [password]);
  const level = useMemo(() => getStrengthLevel(strength), [strength]);
  
  // Don't show indicator until user starts typing
  if (!password) return null;
  
  const strengthLabels: Record<StrengthLevel, string> = {
    weak: t('passwordStrength.weak', { defaultValue: 'Weak' }),
    fair: t('passwordStrength.fair', { defaultValue: 'Fair' }),
    good: t('passwordStrength.good', { defaultValue: 'Good' }),
    strong: t('passwordStrength.strong', { defaultValue: 'Strong' }),
  };
  
  return (
    <div class={styles.strengthIndicator} role="status" aria-live="polite">
      <div class={styles.strengthBars}>
        {[0, 1, 2, 3].map((index) => {
          const isActive = strength > index * 25;
          return (
            <div
              key={index}
              class={`${styles.strengthBar} ${isActive ? styles[level] : ''}`}
              aria-hidden="true"
            />
          );
        })}
      </div>
      <span class={`${styles.strengthLabel} ${styles[level]}`}>
        {strengthLabels[level]}
      </span>
    </div>
  );
}
