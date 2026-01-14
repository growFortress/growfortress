import { useState, useId } from 'preact/hooks';
import { authLoading } from '../../state/index.js';
import { Button } from '../shared/Button.js';
import styles from './AuthScreen.module.css';

interface ResetPasswordFormProps {
  token: string;
  onSubmit: (password: string) => Promise<void>;
  onBack: () => void;
  error?: string | null;
}

export function ResetPasswordForm({ token: _token, onSubmit, onBack, error }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const loading = authLoading.value;

  const passwordId = useId();
  const confirmPasswordId = useId();

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setLocalError('Hasła nie są identyczne');
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
          Twoje hasło zostało pomyślnie zresetowane.
        </p>
        <div class={styles.authToggle} onClick={onBack}>
          <strong>Wróć do logowania</strong>
        </div>
      </div>
    );
  }

  return (
    <form
      class={styles.authForm}
      onSubmit={handleSubmit}
      aria-label="Resetowanie hasła"
    >
      <p class={styles.instructions}>
        Wpisz nowe hasło dla swojego konta.
      </p>

      {(error || localError) && (
        <div role="alert" class={styles.error}>
          {error || localError}
        </div>
      )}

      <div class={styles.inputGroup}>
        <label htmlFor={passwordId} class={styles.srOnly}>
          Nowe hasło
        </label>
        <input
          id={passwordId}
          type="password"
          placeholder="Nowe hasło (min. 6 znaków)"
          required
          minLength={6}
          autocomplete="new-password"
          value={password}
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
        />
      </div>

      <div class={styles.inputGroup}>
        <label htmlFor={confirmPasswordId} class={styles.srOnly}>
          Potwierdź nowe hasło
        </label>
        <input
          id={confirmPasswordId}
          type="password"
          placeholder="Potwierdź nowe hasło"
          required
          minLength={6}
          autocomplete="new-password"
          value={confirmPassword}
          onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
        />
      </div>

      <Button
        variant="primary"
        type="submit"
        disabled={loading}
        class={styles.authBtn}
      >
        {loading ? 'Resetowanie...' : 'Zresetuj hasło'}
      </Button>

      <div class={styles.authToggle} onClick={onBack}>
        <strong>Anuluj</strong>
      </div>
    </form>
  );
}
