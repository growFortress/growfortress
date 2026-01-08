import { showSessionRecoveryModal, pendingSessionSnapshot } from '../../state/index.js';
import { clearActiveSession } from '../../storage/idb.js';
import { Button } from '../shared/Button.js';
import styles from './SessionRecoveryModal.module.css';

interface SessionRecoveryModalProps {
  onContinue: () => void;
  onAbandon: () => void;
}

export function SessionRecoveryModal({ onContinue, onAbandon }: SessionRecoveryModalProps) {
  const snapshot = pendingSessionSnapshot.value;

  if (!showSessionRecoveryModal.value || !snapshot) {
    return null;
  }

  const savedAgo = Math.floor((Date.now() - snapshot.savedAt) / 1000 / 60);
  const timeText = savedAgo < 1 ? 'mniej niż minutę temu' : `${savedAgo} min temu`;

  const handleContinue = () => {
    showSessionRecoveryModal.value = false;
    onContinue();
  };

  const handleAbandon = async () => {
    await clearActiveSession();
    pendingSessionSnapshot.value = null;
    showSessionRecoveryModal.value = false;
    onAbandon();
  };

  return (
    <div class={styles.overlay}>
      <div class={styles.modal}>
        <h2>Znaleziono niezakończoną sesję</h2>
        <p class={styles.info}>
          Twoja poprzednia sesja ({snapshot.fortressClass.toUpperCase()}) została zapisana {timeText}.
        </p>
        <p class={styles.warning}>
          Sesja zostanie przywrócona z ostatniego zapisu. Zdobyte nagrody z poprzednich segmentów są już zapisane na serwerze.
        </p>
        <div class={styles.buttons}>
          <Button variant="primary" onClick={handleContinue}>
            Kontynuuj sesję
          </Button>
          <Button variant="danger" onClick={handleAbandon}>
            Porzuć i zacznij nową
          </Button>
        </div>
      </div>
    </div>
  );
}
