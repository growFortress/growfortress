import { useState, useId } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import styles from './AuthScreen.module.css';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<void>;
  onForgotPassword: () => void;
  error?: string | null;
}

export function LoginForm({ onSubmit, onForgotPassword, error }: LoginFormProps) {
  const { t } = useTranslation('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const loading = authLoading.value;

  // Generate unique IDs for form elements
  const usernameId = useId();
  const passwordId = useId();
  const errorId = useId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await onSubmit(username, password);
  };

  return (
    <form
      class={styles.authForm}
      onSubmit={handleSubmit}
      aria-label={t('aria.loginForm')}
      aria-describedby={error ? errorId : undefined}
    >
      {/* Error message for screen readers */}
      {error && (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          class={styles.error}
        >
          {error}
        </div>
      )}

      <div class={`${styles.inputGroup} ${styles.hasIcon}`}>
        <label htmlFor={usernameId} class={styles.srOnly}>
          {t('login.username')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">👤</span>
        <input
          id={usernameId}
          type="text"
          placeholder={t('login.username')}
          required
          autocomplete="username"
          aria-required="true"
          aria-invalid={error ? 'true' : undefined}
          value={username}
          onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
          onBlur={() => setTouched({ ...touched, username: true })}
        />
        {touched.username && username.length >= 3 && (
          <span class={`${styles.validationIcon} ${styles.valid}`} aria-hidden="true">✓</span>
        )}
      </div>

      <div class={`${styles.inputGroup} ${styles.hasIcon} ${styles.hasPasswordToggle}`}>
        <label htmlFor={passwordId} class={styles.srOnly}>
          {t('login.password')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">🔒</span>
        <input
          id={passwordId}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('login.password')}
          required
          autocomplete="current-password"
          aria-required="true"
          aria-invalid={error ? 'true' : undefined}
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          onBlur={() => setTouched({ ...touched, password: true })}
        />
        {touched.password && password.length >= 6 && (
          <span class={`${styles.validationIcon} ${styles.valid}`} aria-hidden="true">✓</span>
        )}
        <button
          type="button"
          class={styles.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? '👁️' : '👁️‍🗨️'}
        </button>
        <div class={styles.forgotPasswordLink} onClick={onForgotPassword}>
          {t('login.forgotPassword')}
        </div>
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={loading}
        class={styles.authBtn}
        aria-busy={loading}
      >
        {loading ? t('login.submitting') : t('login.submit')}
      </Button>
    </form>
  );
}
