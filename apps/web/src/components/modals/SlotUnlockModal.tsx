import { useEffect, useState } from 'preact/hooks';
import { Modal } from '../shared/Modal.js';
import { useTranslation } from '../../i18n/useTranslation.js';
import styles from './SlotUnlockModal.module.css';

interface SlotUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotType: 'hero' | 'turret';
  slotNumber: number;
}

export function SlotUnlockModal({ isOpen, onClose, slotType, slotNumber }: SlotUnlockModalProps) {
  const { t } = useTranslation('modals');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
    }
  }, [isOpen]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const icon = slotType === 'hero' ? '🦸' : '🗼';
  const title = slotType === 'hero' 
    ? t('slotUnlock.heroTitle', { slot: slotNumber, defaultValue: `Odblokowano Slot ${slotNumber} dla Bohaterów!` })
    : t('slotUnlock.turretTitle', { slot: slotNumber, defaultValue: `Odblokowano Slot ${slotNumber} dla Wieżyczek!` });
  const description = slotType === 'hero'
    ? t('slotUnlock.heroDescription', { slot: slotNumber, defaultValue: `Możesz teraz używać ${slotNumber} bohaterów jednocześnie!` })
    : t('slotUnlock.turretDescription', { slot: slotNumber, defaultValue: `Możesz teraz używać ${slotNumber} wieżyczek jednocześnie!` });

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      onClose={handleClose}
      size="small"
      class={styles.modal}
      bodyClass={styles.body}
    >
      <div class={`${styles.container} ${visible ? styles.visible : ''}`}>
        <div class={styles.icon}>{icon}</div>
        <h2 class={styles.title}>{title}</h2>
        <p class={styles.description}>{description}</p>
        <button class={styles.closeButton} onClick={handleClose}>
          {t('slotUnlock.close', { defaultValue: 'Zamknij' })}
        </button>
      </div>
    </Modal>
  );
}
