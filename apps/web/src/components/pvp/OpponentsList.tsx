import { useState } from 'preact/hooks';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import {
  pvpOpponents,
  pvpOpponentsLoading,
  pvpOpponentsError,
  addSentChallenge,
  formatPower,
  showErrorToast,
} from '../../state/index.js';
import { createChallenge, PvpApiError } from '../../api/pvp.js';
import type { PvpOpponent } from '@arcade/protocol';
import styles from './PvpPanel.module.css';

interface OpponentsListProps {
  onRefresh: () => Promise<void>;
}

export function OpponentsList({ onRefresh }: OpponentsListProps) {
  const [challengingId, setChallengingId] = useState<string | null>(null);

  const handleChallenge = async (opponent: PvpOpponent) => {
    if (challengingId) return;

    setChallengingId(opponent.userId);
    try {
      const response = await createChallenge(opponent.userId);
      addSentChallenge(response.challenge);
      // Refresh to update cooldown status
      await onRefresh();
    } catch (error) {
      if (error instanceof PvpApiError) {
        if (error.code === 'COOLDOWN_ACTIVE') {
          showErrorToast('Musisz poczekać przed kolejnym wyzwaniem tego gracza');
        } else if (error.code === 'POWER_OUT_OF_RANGE') {
          showErrorToast('Moc przeciwnika poza zakresem');
        } else {
          showErrorToast(error.message);
        }
      } else {
        showErrorToast('Nie udało się wysłać wyzwania');
      }
    } finally {
      setChallengingId(null);
    }
  };

  if (pvpOpponentsLoading.value) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (pvpOpponentsError.value) {
    return (
      <div class={styles.error}>
        {pvpOpponentsError.value}
      </div>
    );
  }

  if (pvpOpponents.value.length === 0) {
    return (
      <div class={styles.emptyState}>
        <div class={styles.emptyIcon}>🔍</div>
        <div class={styles.emptyText}>
          Brak przeciwników w Twoim zakresie mocy.
          <br />
          Zwiększ swoją moc, aby odblokować więcej graczy!
        </div>
      </div>
    );
  }

  return (
    <div class={styles.list}>
      {pvpOpponents.value.map((opponent) => (
        <div key={opponent.userId} class={styles.listItem}>
          <div class={styles.listItemInfo}>
            <div class={styles.listItemName}>{opponent.displayName}</div>
            <div class={styles.listItemMeta}>
              <span class={styles.listItemPower}>
                ⚡ {formatPower(opponent.power)}
              </span>
              <span class={styles.listItemRecord}>
                <span class={styles.listItemWins}>{opponent.pvpWins}W</span>
                {' / '}
                <span class={styles.listItemLosses}>{opponent.pvpLosses}L</span>
              </span>
            </div>
          </div>
          <div class={styles.listItemActions}>
            {opponent.canChallenge ? (
              <Button
                variant="skill"
                onClick={() => handleChallenge(opponent)}
                disabled={challengingId === opponent.userId}
              >
                {challengingId === opponent.userId ? (
                  <Spinner size="sm" />
                ) : (
                  '⚔️ Wyzwij'
                )}
              </Button>
            ) : (
              <span class={styles.cooldownText}>
                Cooldown: {formatCooldown(opponent.challengeCooldownEndsAt)}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatCooldown(isoDate?: string): string {
  if (!isoDate) return '';

  const endTime = new Date(isoDate).getTime();
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) return 'Wkrótce';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
