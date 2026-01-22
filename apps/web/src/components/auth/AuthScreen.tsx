import { authScreen, authLoading, authError, openLegalModal } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { LoginForm } from './LoginForm.js';
import { RegisterForm } from './RegisterForm.js';
import { ForgotPasswordForm } from './ForgotPasswordForm.js';
import { ResetPasswordForm } from './ResetPasswordForm.js';
import { AuthBackgroundBattle } from './AuthBackgroundBattle.js';
import { forgotPassword, resetPassword } from '../../api/client.js';
import styles from './AuthScreen.module.css';

interface AuthScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, email?: string) => Promise<void>;
  onGuestLogin: () => Promise<void>;
}

export function AuthScreen({ onLogin, onRegister, onGuestLogin }: AuthScreenProps) {
  const { t, language } = useTranslation(['auth', 'common']);

  const showLoginForm = () => {
    authScreen.value = 'login';
    authError.value = null;
  };

  const showRegisterForm = () => {
    authScreen.value = 'register';
    authError.value = null;
  };

  const showForgotPassword = () => {
    authScreen.value = 'forgot_password';
    authError.value = null;
  };

  const handleForgotPassword = async (email: string) => {
    authLoading.value = true;
    authError.value = null;
    try {
      await forgotPassword({ email });
    } catch (err: any) {
      authError.value = err.message || t('errors.generic');
    } finally {
      authLoading.value = false;
    }
  };

  const handleResetPassword = async (password: string) => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      authError.value = t('resetPassword.invalidToken');
      return;
    }

    authLoading.value = true;
    authError.value = null;
    try {
      await resetPassword({ token, password });
      // After success, wait a bit then show login
      setTimeout(() => {
        showLoginForm();
      }, 3000);
    } catch (err: any) {
      authError.value = err.message || t('errors.generic');
    } finally {
      authLoading.value = false;
    }
  };

  // Check if we have a reset token in the URL on mount
  const resetToken = new URLSearchParams(window.location.search).get('token');
  if (resetToken && authScreen.value === 'login') {
    authScreen.value = 'reset_password';
  }

  const getFormTitle = () => {
    switch (authScreen.value) {
      case 'login':
        return t('login.title', { defaultValue: 'Welcome Back' });
      case 'register':
        return t('register.title', { defaultValue: 'Create Account' });
      case 'forgot_password':
        return t('forgotPassword.title', { defaultValue: 'Reset Password' });
      case 'reset_password':
        return t('resetPassword.title', { defaultValue: 'New Password' });
      default:
        return '';
    }
  };

  const getFormSubtitle = () => {
    switch (authScreen.value) {
      case 'login':
        return t('login.subtitle', { defaultValue: 'Sign in to continue your adventure' });
      case 'register':
        return t('register.subtitle', { defaultValue: 'Join the battle and defend your fortress' });
      default:
        return '';
    }
  };

  return (
    <div class={styles.authScreen}>
      {/* Left side - Hero section with branding */}
      <div class={styles.heroSection}>
        <AuthBackgroundBattle className={styles.backgroundBattle} />
        <div class={styles.heroContent}>
          <h1 class={styles.logo}>
            <span class={styles.logoGrow}>Grow</span>
            <span class={styles.logoFortress}>Fortress</span>
          </h1>
          <p class={styles.tagline}>{t('common:app.tagline')}</p>

          {/* Feature highlights */}
          <div class={styles.heroFeatures}>
            <div class={styles.heroFeature}>
              <span class={styles.heroFeatureIcon}>&#x1F3F0;</span>
              <span>{t('features.build', { defaultValue: 'Build & upgrade your fortress' })}</span>
            </div>
            <div class={styles.heroFeature}>
              <span class={styles.heroFeatureIcon}>&#x2694;</span>
              <span>{t('features.heroes', { defaultValue: 'Collect powerful heroes' })}</span>
            </div>
            <div class={styles.heroFeature}>
              <span class={styles.heroFeatureIcon}>&#x1F91D;</span>
              <span>{t('features.guilds', { defaultValue: 'Join guilds & compete' })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form section */}
      <div class={styles.formSection}>
        <div class={styles.authBox}>
          {/* Mobile logo (shown only on smaller screens) */}
          <div class={styles.mobileLogo}>
            <span class={styles.mobileLogoText}>Fortress</span>
          </div>

          {/* Form header */}
          <div class={styles.formHeader}>
            <h2 class={styles.formTitle}>{getFormTitle()}</h2>
            {getFormSubtitle() && (
              <p class={styles.formSubtitle}>{getFormSubtitle()}</p>
            )}
          </div>

          {authScreen.value === 'login' && (
            <>
              <LoginForm onSubmit={onLogin} onForgotPassword={showForgotPassword} />
              <div class={styles.authToggle} onClick={showRegisterForm}>
                {t('login.noAccount')} <strong>{t('login.registerLink')}</strong>
              </div>
              <div class={styles.guestDivider}>
                <span class={styles.guestDividerText}>{t('guest.or')}</span>
              </div>
              <button
                type="button"
                class={styles.guestButton}
                onClick={onGuestLogin}
                disabled={authLoading.value}
              >
                {t('guest.playAsGuest')}
              </button>
              <p class={styles.guestHint}>{t('guest.playAsGuestHint')}</p>
            </>
          )}

          {authScreen.value === 'register' && (
            <>
              <RegisterForm onSubmit={onRegister} />
              <div class={styles.legalNotice}>
                {t('register.legalPrefix', { defaultValue: 'By registering, you accept the' })}{' '}
                <button
                  type="button"
                  class={styles.legalLink}
                  onClick={() => openLegalModal('terms')}
                >
                  {t('register.terms', { defaultValue: 'Terms of Service' })}
                </button>{' '}
                {t('register.legalAnd', { defaultValue: 'and' })}{' '}
                <button
                  type="button"
                  class={styles.legalLink}
                  onClick={() => openLegalModal('privacy')}
                >
                  {t('register.privacy', { defaultValue: 'Privacy Policy' })}
                </button>
              </div>
              <div class={styles.authToggle} onClick={showLoginForm}>
                {t('register.hasAccount')} <strong>{t('register.loginLink')}</strong>
              </div>
            </>
          )}

          {authScreen.value === 'forgot_password' && (
            <ForgotPasswordForm
              onSubmit={handleForgotPassword}
              onBack={showLoginForm}
              error={authError.value}
            />
          )}

          {authScreen.value === 'reset_password' && (
            <ResetPasswordForm
              token={resetToken || ''}
              onSubmit={handleResetPassword}
              onBack={showLoginForm}
              error={authError.value}
            />
          )}

          {authLoading.value && <div class={styles.loading}>{t('connecting', { defaultValue: 'Connecting...' })}</div>}
          {authError.value && authScreen.value !== 'forgot_password' && authScreen.value !== 'reset_password' && (
            <div class={styles.error}>{authError.value}</div>
          )}

          {/* Compact footer */}
          <div class={styles.footerInfo}>
            <div class={styles.analyticsInfo}>
              <span class={styles.analyticsIcon}>&#128202;</span>
              <span class={styles.analyticsText}>
                <button
                  type="button"
                  class={styles.analyticsLink}
                  onClick={() => openLegalModal('privacy')}
                >
                  {t('analytics.details')}
                </button>
              </span>
            </div>

            <div class={styles.studioInfo}>
              <span class={styles.studioIcon}>&#127970;</span>
              <span class={styles.studioText}>
                <a
                  href={`/company/index-${language === 'pl' ? 'pl' : 'en'}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  class={styles.studioLink}
                >
                  PlazaWorks
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
