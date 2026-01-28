import { useState, useId, useEffect, useRef, useCallback } from 'preact/hooks';
import { useTranslation } from '../../i18n/useTranslation.js';
import { showGuestRegistrationPrompt, dismissGuestRegistrationPrompt, clearGuestMode, updateProfileFromServer } from '../../state/index.js';
import { baseGold, baseDust, currentWave, baseLevel } from '../../state/profile.signals.js';
import { displayGold, displayDust } from '../../state/game.signals.js';
import { convertGuestToUser, checkUsernameAvailability } from '../../api/client.js';
import { Modal } from '../shared/Modal.js';
import { Button } from '../shared/Button.js';
import { PasswordStrengthIndicator } from '../auth/PasswordStrengthIndicator.js';
import styles from './GuestRegistrationModal.module.css';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/** Game logo SVG - matches the main branding */
function GameLogo({ class: className }: { class?: string }) {
  return (
    <svg
      class={className}
      viewBox="0 0 360 50"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="regLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00e5ff" />
          <stop offset="50%" stop-color="#00ffcc" />
          <stop offset="100%" stop-color="#00e5ff" />
        </linearGradient>
        <filter id="regLogoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <text
        x="70"
        y="32"
        font-family="Orbitron, sans-serif"
        font-size="28"
        font-weight="700"
        fill="url(#regLogoGradient)"
        filter="url(#regLogoGlow)"
        text-anchor="middle"
        letter-spacing="4"
      >
        GROW
      </text>

      <text
        x="250"
        y="32"
        font-family="Orbitron, sans-serif"
        font-size="28"
        font-weight="700"
        fill="url(#regLogoGradient)"
        filter="url(#regLogoGlow)"
        text-anchor="middle"
        letter-spacing="4"
      >
        FORTRESS
      </text>
    </svg>
  );
}

/** Format number with thousand separators */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

export function GuestRegistrationModal() {
  const { t } = useTranslation('auth');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showEmailField, setShowEmailField] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');

  // Get current player stats
  const playerWave = currentWave.value;
  const playerLevel = baseLevel.value;
  const playerGold = displayGold.value || baseGold.value;
  const playerDust = displayDust.value || baseDust.value;

  // Debounce timer ref
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate unique IDs for accessibility
  const formId = useId();
  const errorId = useId();

  // Debounced username availability check
  const checkUsername = useCallback(async (value: string) => {
    if (value.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');

    try {
      const result = await checkUsernameAvailability(value);
      if (result.available) {
        setUsernameStatus('available');
      } else if (result.reason) {
        setUsernameStatus('invalid');
      } else {
        setUsernameStatus('taken');
      }
    } catch {
      setUsernameStatus('idle');
    }
  }, []);

  // Handle username change with debounce
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameStatus('idle');

    if (usernameCheckTimer.current) {
      clearTimeout(usernameCheckTimer.current);
    }

    if (value.length >= 3 && /^[a-zA-Z0-9_]+$/.test(value)) {
      usernameCheckTimer.current = setTimeout(() => {
        checkUsername(value);
      }, 500);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (usernameCheckTimer.current) {
        clearTimeout(usernameCheckTimer.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (!isLoading) {
      dismissGuestRegistrationPrompt();
      // Reset form state
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setEmail('');
      setShowEmailField(false);
      setRememberMe(true);
      setAcceptedTerms(false);
      setError(null);
      setSuccess(false);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setUsernameStatus('idle');
    }
  }, [isLoading]);

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

    if (usernameStatus === 'taken') {
      setError(t('guest.errors.usernameTaken'));
      return;
    }

    if (password.length < 6) {
      setError(t('guest.errors.passwordLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('guest.errors.passwordMismatch'));
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('guest.errors.emailInvalid'));
      return;
    }

    if (!acceptedTerms) {
      setError(t('guest.errors.termsRequired'));
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

      // Refresh profile to update displayName signal (fixes UI showing old Guest name)
      await updateProfileFromServer();

      // Auto-close after showing success message
      setTimeout(() => {
        dismissGuestRegistrationPrompt();
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setShowEmailField(false);
        setRememberMe(true);
        setAcceptedTerms(false);
        setError(null);
        setSuccess(false);
      }, 2500);
    } catch (err) {
      if (err instanceof Error) {
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

  // Validation helpers
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

  // Get username status icon
  const getUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case 'checking':
        return <span class={styles.statusIcon} aria-hidden="true">⏳</span>;
      case 'available':
        return <span class={`${styles.statusIcon} ${styles.statusAvailable}`} aria-hidden="true">✓</span>;
      case 'taken':
        return <span class={`${styles.statusIcon} ${styles.statusTaken}`} aria-hidden="true">✗</span>;
      case 'invalid':
        return <span class={`${styles.statusIcon} ${styles.statusInvalid}`} aria-hidden="true">!</span>;
      default:
        return null;
    }
  };

  if (success) {
    return (
      <Modal
        visible={showGuestRegistrationPrompt.value}
        onClose={handleClose}
        size="large"
        ariaLabel={t('guest.successTitle')}
      >
        <div class={styles.successContainer}>
          <div class={styles.successIcon}>
            <span>✓</span>
          </div>
          <h2 class={styles.successTitle}>{t('guest.successTitle')}</h2>
          <p class={styles.successMessage}>{t('guest.convertSuccess')}</p>
          <div class={styles.successStats}>
            <div class={styles.successStat}>
              <span class={styles.successStatIcon}>🏰</span>
              <span>{t('guest.wave')} {playerWave}</span>
            </div>
            <div class={styles.successStat}>
              <span class={styles.successStatIcon}>⭐</span>
              <span>{t('guest.level')} {playerLevel}</span>
            </div>
            <div class={styles.successStat}>
              <span class={styles.successStatIcon}>💰</span>
              <span>{formatNumber(playerGold)}</span>
            </div>
            <div class={styles.successStat}>
              <span class={styles.successStatIcon}>✨</span>
              <span>{formatNumber(playerDust)}</span>
            </div>
          </div>
          <p class={styles.successSaved}>{t('guest.progressSaved')}</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      visible={showGuestRegistrationPrompt.value}
      onClose={handleClose}
      size="large"
      ariaLabel={t('guest.modalTitle')}
    >
      <div class={styles.container}>
        {/* Left column - Branding & Progress */}
        <div class={styles.leftColumn}>
          <GameLogo class={styles.logo} />

          <div class={styles.progressSection}>
            <h3 class={styles.progressTitle}>{t('guest.yourProgress')}</h3>

            <div class={styles.statsGrid}>
              <div class={styles.statItem}>
                <span class={styles.statIcon}>🏰</span>
                <div class={styles.statInfo}>
                  <span class={styles.statLabel}>{t('guest.wave')}</span>
                  <span class={styles.statValue}>{playerWave}</span>
                </div>
              </div>

              <div class={styles.statItem}>
                <span class={styles.statIcon}>⭐</span>
                <div class={styles.statInfo}>
                  <span class={styles.statLabel}>{t('guest.level')}</span>
                  <span class={styles.statValue}>{playerLevel}</span>
                </div>
              </div>

              <div class={styles.statItem}>
                <span class={styles.statIcon}>💰</span>
                <div class={styles.statInfo}>
                  <span class={styles.statLabel}>{t('guest.gold')}</span>
                  <span class={styles.statValue}>{formatNumber(playerGold)}</span>
                </div>
              </div>

              <div class={styles.statItem}>
                <span class={styles.statIcon}>✨</span>
                <div class={styles.statInfo}>
                  <span class={styles.statLabel}>{t('guest.dust')}</span>
                  <span class={styles.statValue}>{formatNumber(playerDust)}</span>
                </div>
              </div>
            </div>

            <div class={styles.willBeSaved}>
              <span class={styles.checkmark}>✓</span>
              <span>{t('guest.willBeSaved')}</span>
            </div>
          </div>

          <div class={styles.brandingFooter}>
            <span>{t('guest.developedBy')} </span>
            <strong>PlazaWorks</strong>
          </div>
        </div>

        {/* Right column - Form */}
        <div class={styles.rightColumn}>
          <div class={styles.formHeader}>
            <h2 class={styles.title}>{t('guest.modalTitle')}</h2>
            <p class={styles.subtitle}>{t('guest.modalSubtitle')}</p>
          </div>

          <form
            id={formId}
            onSubmit={handleSubmit}
            class={styles.form}
            aria-label={t('guest.modalTitle')}
            aria-describedby={error ? errorId : undefined}
          >
            {error && (
              <div id={errorId} role="alert" aria-live="assertive" class={styles.error}>
                {error}
              </div>
            )}

            {/* Username field */}
            <div class={styles.field}>
              <label class={styles.label} for="guest-username">
                {t('guest.usernameLabel')}
              </label>
              <div class={styles.inputWrapper}>
                <input
                  type="text"
                  id="guest-username"
                  class={`${styles.input} ${usernameStatus === 'taken' ? styles.inputError : ''} ${usernameStatus === 'available' ? styles.inputSuccess : ''}`}
                  value={username}
                  onInput={(e) => handleUsernameChange((e.target as HTMLInputElement).value)}
                  placeholder={t('guest.usernamePlaceholder')}
                  minLength={3}
                  maxLength={20}
                  autocomplete="username"
                  required
                  disabled={isLoading}
                />
                {getUsernameStatusIcon()}
              </div>
              {usernameStatus === 'taken' && (
                <span class={styles.fieldError}>{t('guest.errors.usernameTaken')}</span>
              )}
              {usernameStatus === 'available' && (
                <span class={styles.fieldSuccess}>{t('guest.usernameAvailable')}</span>
              )}
            </div>

            {/* Password field */}
            <div class={styles.field}>
              <label class={styles.label} for="guest-password">
                {t('guest.passwordLabel')}
              </label>
              <div class={styles.inputWrapper}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="guest-password"
                  class={styles.input}
                  value={password}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  placeholder={t('guest.passwordPlaceholder')}
                  minLength={6}
                  autocomplete="new-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  class={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  disabled={isLoading}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              {password && <PasswordStrengthIndicator password={password} />}
            </div>

            {/* Confirm Password field */}
            <div class={styles.field}>
              <label class={styles.label} for="guest-confirm-password">
                {t('guest.confirmPasswordLabel')}
              </label>
              <div class={styles.inputWrapper}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="guest-confirm-password"
                  class={`${styles.input} ${confirmPassword && !doPasswordsMatch ? styles.inputError : ''}`}
                  value={confirmPassword}
                  onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                  placeholder={t('guest.confirmPasswordPlaceholder')}
                  minLength={6}
                  autocomplete="new-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  class={styles.passwordToggle}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  disabled={isLoading}
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
                {doPasswordsMatch && (
                  <span class={`${styles.statusIcon} ${styles.statusAvailable}`} aria-hidden="true">✓</span>
                )}
              </div>
            </div>

            {/* Email field (optional, toggle) */}
            {!showEmailField ? (
              <button
                type="button"
                class={styles.optionalToggle}
                onClick={() => setShowEmailField(true)}
                disabled={isLoading}
              >
                + {t('guest.addEmail')}
              </button>
            ) : (
              <div class={styles.field}>
                <label class={styles.label} for="guest-email">
                  {t('guest.emailLabel')}
                  <span class={styles.optional}>{t('guest.emailOptional')}</span>
                </label>
                <div class={styles.inputWrapper}>
                  <input
                    type="email"
                    id="guest-email"
                    class={styles.input}
                    value={email}
                    onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                    placeholder={t('guest.emailPlaceholder')}
                    autocomplete="email"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Checkboxes */}
            <div class={styles.checkboxes}>
              <label class={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe((e.target as HTMLInputElement).checked)}
                  disabled={isLoading}
                  class={styles.checkbox}
                />
                <span>{t('guest.rememberMe')}</span>
              </label>

              <label class={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms((e.target as HTMLInputElement).checked)}
                  disabled={isLoading}
                  class={styles.checkbox}
                />
                <span class={styles.termsText}>
                  {t('guest.termsPrefix')}{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" class={styles.termsLink}>
                    {t('guest.termsOfService')}
                  </a>{' '}
                  {t('guest.termsAnd')}{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" class={styles.termsLink}>
                    {t('guest.privacyPolicy')}
                  </a>
                </span>
              </label>
            </div>

            {/* Actions */}
            <div class={styles.actions}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isLoading || !acceptedTerms || usernameStatus === 'taken'}
                aria-busy={isLoading}
                class={styles.submitBtn}
              >
                {isLoading ? t('guest.creating') : t('guest.createAccount')}
              </Button>
              <button
                type="button"
                class={styles.skipBtn}
                onClick={handleClose}
                disabled={isLoading}
              >
                {t('guest.maybeLater')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  );
}
