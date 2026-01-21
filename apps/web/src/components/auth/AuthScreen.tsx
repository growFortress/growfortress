import { authScreen, authLoading, authError, openLegalModal } from '../../state/index.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import { LoginForm } from './LoginForm.js';
import { RegisterForm } from './RegisterForm.js';
import { ForgotPasswordForm } from './ForgotPasswordForm.js';
import { ResetPasswordForm } from './ResetPasswordForm.js';
import { forgotPassword, resetPassword } from '../../api/client.js';
import styles from './AuthScreen.module.css';

interface AuthScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, email?: string) => Promise<void>;
}

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
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

  return (
    <div class={styles.authScreen}>
      <div class={styles.authBox}>
        <h1 class={styles.logo}>
          <span class={styles.logoGrow}>Grow</span>
          <span class={styles.logoFortress}>Fortress</span>
        </h1>
        <p class={styles.tagline}>{t('common:app.tagline')}</p>

        {/* Save Info Box */}
        <div class={styles.saveInfoBox}>
          <div class={styles.saveInfoTitle}>{t('saveInfo.title')}</div>
          <div class={styles.saveInfoContent}>
            <div class={styles.saveInfoItem}>
              <span class={styles.saveInfoIcon}>🎮</span>
              <div>
                <div class={styles.saveInfoLabel}>{t('saveInfo.guest')}</div>
                <div class={styles.saveInfoWarning}>{t('saveInfo.guestWarning')}</div>
              </div>
            </div>
            <div class={styles.saveInfoItem}>
              <span class={styles.saveInfoIcon}>✅</span>
              <div>
                <div class={styles.saveInfoLabel}>{t('saveInfo.account')}</div>
                <div class={styles.saveInfoBenefit}>{t('saveInfo.accountBenefit')}</div>
              </div>
            </div>
          </div>
        </div>

        {authScreen.value === 'login' && (
          <>
            <LoginForm onSubmit={onLogin} onForgotPassword={showForgotPassword} />
            <div class={styles.authToggle} onClick={showRegisterForm}>
              {t('login.noAccount')} <strong>{t('login.registerLink')}</strong>
            </div>
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

        {authLoading.value && <div class={`${styles.loading} visible`}>{t('connecting', { defaultValue: 'Connecting...' })}</div>}
        {authError.value && authScreen.value !== 'forgot_password' && authScreen.value !== 'reset_password' && (
          <div class={styles.error}>{authError.value}</div>
        )}

        {/* Analytics info */}
        <div class={styles.analyticsInfo}>
          <span class={styles.analyticsIcon}>📊</span>
          <div class={styles.analyticsText}>
            {t('analytics.info')}{' '}
            <button
              type="button"
              class={styles.analyticsLink}
              onClick={() => openLegalModal('privacy')}
            >
              {t('analytics.details')}
            </button>
          </div>
        </div>

        {/* Data protection info */}
        <div class={styles.analyticsInfo}>
          <span class={styles.analyticsIcon}>🔒</span>
          <div class={styles.analyticsText}>
            {t('dataProtection.info')}{' '}
            <button
              type="button"
              class={styles.analyticsLink}
              onClick={() => openLegalModal('privacy')}
            >
              {t('dataProtection.details')}
            </button>
          </div>
        </div>

        {/* Studio info */}
        <div class={styles.studioInfo}>
          <span class={styles.studioIcon}>🏢</span>
          <div class={styles.studioText}>
            {t('madeBy')}{' '}
            <a
              href={`/company/index-${language === 'pl' ? 'pl' : 'en'}.html`}
              target="_blank"
              rel="noopener noreferrer"
              class={styles.studioLink}
            >
              PlazaWorks
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
