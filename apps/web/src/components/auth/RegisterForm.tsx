import { useState, useId } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import styles from './AuthScreen.module.css';

interface RegisterFormProps {
  onSubmit: (username: string, password: string, email?: string) => Promise<void>;
  error?: string | null;
}

export function RegisterForm({ onSubmit, error }: RegisterFormProps) {
  const { t } = useTranslation('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const loading = authLoading.value;

  // Generate unique IDs for form elements
  const usernameId = useId();
  const passwordId = useId();
  const emailId = useId();
  const usernameHintId = useId();
  const passwordHintId = useId();
  const errorId = useId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    await onSubmit(username, password, email || undefined);
  };

  return (
    <form
      class={styles.authForm}
      onSubmit={handleSubmit}
      aria-label={t('aria.registerForm')}
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

      <div class={styles.inputGroup}>
        <label htmlFor={usernameId} class={styles.srOnly}>
          {t('register.usernamePlaceholder')}
        </label>
        <input
          id={usernameId}
          type="text"
          placeholder={t('register.username')}
          required
          minLength={3}
          maxLength={20}
          autocomplete="username"
          aria-required="true"
          aria-describedby={usernameHintId}
          aria-invalid={error ? 'true' : undefined}
          value={username}
          onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
        />
        <span id={usernameHintId} class={styles.srOnly}>
          {t('register.usernameHint')}
        </span>
      </div>

      <div class={styles.inputGroup}>
        <label htmlFor={emailId} class={styles.srOnly}>
          {t('register.email')}
        </label>
        <input
          id={emailId}
          type="email"
          placeholder={t('register.emailHint')}
          autocomplete="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class={styles.inputGroup}>
        <label htmlFor={passwordId} class={styles.srOnly}>
          {t('register.passwordPlaceholder')}
        </label>
        <input
          id={passwordId}
          type="password"
          placeholder={t('register.password')}
          required
          minLength={6}
          autocomplete="new-password"
          aria-required="true"
          aria-describedby={passwordHintId}
          aria-invalid={error ? 'true' : undefined}
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
        <span id={passwordHintId} class={styles.srOnly}>
          {t('register.passwordHint')}
        </span>
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={loading}
        class={styles.authBtn}
        aria-busy={loading}
      >
        {loading ? t('register.submitting') : t('register.submit')}
      </Button>
    </form>
  );
}
