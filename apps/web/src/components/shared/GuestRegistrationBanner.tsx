import { useTranslation } from '../../i18n/useTranslation.js';
import { showGuestRegistrationPrompt } from '../../state/index.js';
import { Button } from './Button.js';
import styles from './GuestRegistrationBanner.module.css';

export function GuestRegistrationBanner() {
  const { t } = useTranslation('auth');

  const handleCreateAccount = () => {
    showGuestRegistrationPrompt.value = true;
  };

  return (
    <div class={styles.banner}>
      <div class={styles.icon}>
        <span class={styles.warningIcon}>!</span>
      </div>
      <div class={styles.content}>
        <h3 class={styles.title}>{t('guest.warningTitle')}</h3>
        <p class={styles.message}>{t('guest.warningMessage')}</p>
      </div>
      <Button variant="primary" size="sm" onClick={handleCreateAccount}>
        {t('guest.createAccount')}
      </Button>
    </div>
  );
}
