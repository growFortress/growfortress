import { errorToasts, dismissErrorToast } from '../../state/ui.signals.js';
import styles from './ErrorToast.module.css';

export function ErrorToast() {
  const toasts = errorToasts.value;

  if (toasts.length === 0) return null;

  return (
    <div class={styles.container}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          class={`${styles.toast} ${styles[toast.type]}`}
          onClick={() => dismissErrorToast(toast.id)}
        >
          <span class={styles.icon}>
            {toast.type === 'error' && '❌'}
            {toast.type === 'warning' && '⚠️'}
            {toast.type === 'info' && 'ℹ️'}
          </span>
          <span class={styles.message}>{toast.message}</span>
          <button class={styles.dismiss} onClick={() => dismissErrorToast(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
