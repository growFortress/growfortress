import { useState, useId } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { Button } from '../shared/Button.js';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator.js';
import { UserIcon, LockIcon, EmailIcon, EyeIcon, EyeOffIcon, CheckIcon } from './AuthIcons.js';
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
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ username: false, email: false, password: false });
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

      <div class={`${styles.inputGroup} ${styles.hasIcon}`}>
        <label htmlFor={usernameId} class={styles.srOnly}>
          {t('register.usernamePlaceholder')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">
          <UserIcon size={18} />
        </span>
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
          onBlur={() => setTouched({ ...touched, username: true })}
        />
        {touched.username && username.length >= 3 && username.length <= 20 && (
          <span class={`${styles.validationIcon} ${styles.valid}`} aria-hidden="true">
            <CheckIcon size={14} />
          </span>
        )}
        <span id={usernameHintId} class={styles.srOnly}>
          {t('register.usernameHint')}
        </span>
      </div>

      <div class={`${styles.inputGroup} ${styles.hasIcon}`}>
        <label htmlFor={emailId} class={styles.srOnly}>
          {t('register.email')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">
          <EmailIcon size={18} />
        </span>
        <input
          id={emailId}
          type="email"
          placeholder={t('register.emailHint')}
          autocomplete="email"
          value={email}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
          onBlur={() => setTouched({ ...touched, email: true })}
        />
        {touched.email && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
          <span class={`${styles.validationIcon} ${styles.valid}`} aria-hidden="true">
            <CheckIcon size={14} />
          </span>
        )}
      </div>

      <div class={`${styles.inputGroup} ${styles.hasIcon} ${styles.hasPasswordToggle}`}>
        <label htmlFor={passwordId} class={styles.srOnly}>
          {t('register.passwordPlaceholder')}
        </label>
        <span class={styles.inputIcon} aria-hidden="true">
          <LockIcon size={18} />
        </span>
        <input
          id={passwordId}
          type={showPassword ? 'text' : 'password'}
          placeholder={t('register.password')}
          required
          minLength={6}
          autocomplete="new-password"
          aria-required="true"
          aria-describedby={passwordHintId}
          aria-invalid={error ? 'true' : undefined}
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          onBlur={() => setTouched({ ...touched, password: true })}
        />
        {touched.password && password.length >= 6 && (
          <span class={`${styles.validationIcon} ${styles.valid}`} aria-hidden="true">
            <CheckIcon size={14} />
          </span>
        )}
        <button
          type="button"
          class={styles.passwordToggle}
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPassword ? <EyeIcon size={20} /> : <EyeOffIcon size={20} />}
        </button>
        <span id={passwordHintId} class={styles.srOnly}>
          {t('register.passwordHint')}
        </span>
        <PasswordStrengthIndicator password={password} />
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
