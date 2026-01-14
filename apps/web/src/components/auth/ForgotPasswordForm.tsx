import { useState, useId } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import styles from './AuthScreen.module.css';

interface ForgotPasswordFormProps {
  onSubmit: (email: string) => Promise<void>;
  onBack: () => void;
  error?: string | null;
}

export function ForgotPasswordForm({ onSubmit, onBack, error }: ForgotPasswordFormProps) {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const loading = authLoading.value;

  const emailId = useId();
  const errorId = useId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await onSubmit(email);
    setSuccess(true);
  };

  if (success && !error) {
    return (
      <div class={styles.authForm}>
        <p class={styles.success}>
          {t('forgotPassword.success')}
        </p>
        <div class={styles.authToggle} onClick={onBack}>
          <strong>{t('forgotPassword.backToLogin')}</strong>
        </div>
      </div>
    );
  }

  return (
    <form
      class={styles.authForm}
      onSubmit={handleSubmit}
      aria-label={t('aria.forgotPasswordForm')}
    >
      <p class={styles.instructions}>
        {t('forgotPassword.success')}
      </p>

      {error && (
        <div id={errorId} role="alert" class={styles.error}>
          {error}
        </div>
      )}

      <div class={styles.inputGroup}>
        <label htmlFor={emailId} class={styles.srOnly}>
          {t('forgotPassword.email')}
        </label>
        <input
          id={emailId}
          type="email"
          placeholder={t('forgotPassword.emailPlaceholder')}
          required
          autocomplete="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={loading}
        class={styles.authBtn}
      >
        {loading ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
      </Button>

      <div class={styles.authToggle} onClick={onBack}>
        <strong>{t('forgotPassword.backToLogin')}</strong>
      </div>
    </form>
  );
}
