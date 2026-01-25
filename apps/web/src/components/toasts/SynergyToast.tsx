import { activeSynergyToast } from '../../state/ui.signals.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './SynergyToast.module.css';

export function SynergyToast() {
  const { t } = useTranslation(['common', 'data']);
  const toast = activeSynergyToast.value;

  if (!toast) return null;

  const icon = toast.type === 'trio' ? '⭐' : '⚡';
  const label = toast.type === 'trio'
    ? t('synergyToast.trioUnlocked', { defaultValue: 'TRIO SYNERGY!' })
    : t('synergyToast.pairUnlocked', { defaultValue: 'SYNERGY UNLOCKED!' });

  return (
    <div class={styles.container}>
      <div class={`${styles.toast} ${styles[toast.type]}`}>
        <div class={styles.header}>
          <span class={styles.icon}>{icon}</span>
          <span class={styles.label}>{label}</span>
        </div>
        <div class={styles.name}>{toast.name}</div>
        <div class={styles.bonuses}>
          {toast.bonuses.map((bonus, i) => (
            <span key={i} class={styles.bonus}>{bonus}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
