import { useState } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import { showGuestRegistrationPrompt, dismissGuestRegistrationPrompt, clearGuestMode } from '../../state/index.js';
import { convertGuestToUser } from '../../api/client.js';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import styles from './GuestRegistrationModal.module.css';

export function GuestRegistrationModal() {
  const { t } = useTranslation('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleClose = () => {
    if (!isLoading) {
      dismissGuestRegistrationPrompt();
      // Reset form state
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setEmail('');
      setError(null);
      setSuccess(false);
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (username.length < 3 || username.length > 20) {
      setError(t('guest.errors.usernameLength'));
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError(t('guest.errors.usernameFormat'));
      return;
    }

    if (password.length < 8) {
      setError(t('guest.errors.passwordLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('guest.errors.passwordMismatch'));
      return;
    }

    if (email && !email.includes('@')) {
      setError(t('guest.errors.emailInvalid'));
      return;
    }

    setIsLoading(true);

    try {
      await convertGuestToUser({
        username,
        password,
        email: email || undefined,
      });

      // Success!
      setSuccess(true);
      clearGuestMode();

      // Auto-close after showing success message
      setTimeout(() => {
        dismissGuestRegistrationPrompt();
        // Reset form state
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setError(null);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        // Handle specific error messages
        if (err.message.includes('Username')) {
          setError(t('guest.errors.usernameTaken'));
        } else if (err.message.includes('Email')) {
          setError(t('guest.errors.emailTaken'));
        } else {
          setError(t('guest.errors.conversionFailed'));
        }
      } else {
        setError(t('guest.errors.conversionFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Modal
        visible={showGuestRegistrationPrompt.value}
        onClose={handleClose}
        size="small"
        ariaLabel={t('guest.successTitle')}
      >
        <div class={styles.successContainer}>
          <div class={styles.successIcon}>
            <span>&#10003;</span>
          </div>
          <h2 class={styles.successTitle}>{t('guest.successTitle')}</h2>
          <p class={styles.successMessage}>{t('guest.convertSuccess')}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      visible={showGuestRegistrationPrompt.value}
      onClose={handleClose}
      size="small"
      ariaLabel={t('guest.modalTitle')}
    >
      <div class={styles.container}>
        <div class={styles.header}>
          <h2 class={styles.title}>{t('guest.modalTitle')}</h2>
          <p class={styles.subtitle}>{t('guest.modalSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} class={styles.form}>
          <div class={styles.field}>
            <label class={styles.label} for="guest-username">
              {t('guest.usernameLabel')}
            </label>
            <input
              type="text"
              id="guest-username"
              class={styles.input}
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder={t('guest.usernamePlaceholder')}
              minLength={3}
              maxLength={20}
              pattern="^[a-zA-Z0-9_]+$"
              required
              disabled={isLoading}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label} for="guest-password">
              {t('guest.passwordLabel')}
            </label>
            <input
              type="password"
              id="guest-password"
              class={styles.input}
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              placeholder={t('guest.passwordPlaceholder')}
              minLength={8}
              required
              disabled={isLoading}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label} for="guest-confirm-password">
              {t('guest.confirmPasswordLabel')}
            </label>
            <input
              type="password"
              id="guest-confirm-password"
              class={styles.input}
              value={confirmPassword}
              onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
              placeholder={t('guest.confirmPasswordPlaceholder')}
              minLength={8}
              required
              disabled={isLoading}
            />
          </div>

          <div class={styles.field}>
            <label class={styles.label} for="guest-email">
              {t('guest.emailLabel')}
              <span class={styles.optional}>{t('guest.emailOptional')}</span>
            </label>
            <input
              type="email"
              id="guest-email"
              class={styles.input}
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder={t('guest.emailPlaceholder')}
              disabled={isLoading}
            />
          </div>

          {error && <div class={styles.error}>{error}</div>}

          <div class={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleClose}
              disabled={isLoading}
            >
              {t('guest.maybeLater')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isLoading}
            >
              {isLoading ? t('guest.creating') : t('guest.createAccount')}
            </Button>
          </div>
        </form>

        <p class={styles.benefits}>
          {t('guest.benefitsText')}
        </p>
      </div>
    </Modal>
  );
}
