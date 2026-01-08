import { Button } from '../shared/Button.js';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Potwierdź',
  cancelText = 'Anuluj',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!visible) {
    return null;
  }

  return (
    <div class={styles.overlay}>
      <div class={styles.modal}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div class={styles.buttons}>
          <Button variant="primary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
