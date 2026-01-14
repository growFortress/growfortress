import { Button } from '../shared/Button.js';
import { Modal } from '../shared/Modal.js';
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
  return (
    <Modal
      visible={visible}
      title={title}
      onClose={onCancel}
      class={styles.modalContent}
      ariaLabel={title}
    >
      <p class={styles.message}>{message}</p>
      <div class={styles.buttons}>
        <Button variant="primary" onClick={onCancel}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
