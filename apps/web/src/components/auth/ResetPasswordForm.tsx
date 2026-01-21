import { useState, useId } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import styles from './AuthScreen.module.css';

interface ResetPasswordFormProps {
  token: string;
  onSubmit: (password: string) => Promise<void>;
  onBack: () => void;
  error?: string | null;
}

export function ResetPasswordForm({ token: _token, onSubmit, onBack, error }: ResetPasswordFormProps) {
  const { t } = useTranslation('auth');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const loading = authLoading.value;

  const passwordId = useId();
  const confirmPasswordId = useId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setLocalError(t('resetPassword.passwordMismatch'));
      return;
    }
    setLocalError(null);
    await onSubmit(password);
    setSuccess(true);
  };

  if (success && !error && !localError) {
    return (
      <div class={styles.authForm}>
        <p class={styles.success}>
          {t('resetPassword.success')}
        </p>
        <div class={styles.authToggle} onClick={onBack}>
          <strong>{t('resetPassword.backToLogin')}</strong>
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
        {t('resetPassword.instructions')}
      </p>

      {(error || localError) && (
        <div role="alert" class={styles.error}>
          {error || localError}
        </div>
      )}

      <div class={`${styles.inputGroup} ${styles.hasIcon}`}>
        <label htmlFor={passwordId} class={styles.srOnly}>
          {t('resetPassword.password')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">🔒</span>
        <input
          id={passwordId}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('resetPassword.passwordPlaceholder')}
          required
          minLength={6}
          autocomplete="new-password"
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          class={styles.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? '👁️' : '👁️‍🗨️'}
        </button>
      </div>

      <div class={`${styles.inputGroup} ${styles.hasIcon}`}>
        <label htmlFor={confirmPasswordId} class={styles.srOnly}>
          {t('resetPassword.confirmPassword')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">🔒</span>
        <input
          id={confirmPasswordId}
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder={t('resetPassword.confirmPlaceholder')}
          required
          minLength={6}
          autocomplete="new-password"
          value={confirmPassword}
          onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
        />
        <button
          type="button"
          class={styles.passwordToggle}
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
        </button>
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={loading}
        class={styles.authBtn}
      >
        {loading ? t('resetPassword.submitting') : t('resetPassword.submit')}
      </Button>

      <div class={styles.authToggle} onClick={onBack}>
        <strong>{t('resetPassword.cancel')}</strong>
      </div>
    </form>
  );
}
