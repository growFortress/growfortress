import { useState } from 'preact/hooks';
import { Spinner } from '../shared/Spinner.js';
import {
  pvpOpponents,
  pvpOpponentsLoading,
  pvpOpponentsError,
  formatPower,
  showErrorToast,
  openHubPreview,
  userPower,
  showBattleResult,
} from '../../state/index.js';
import { createChallenge, resolveChallenge, PvpApiError } from '../../api/pvp.js';
import type { PvpOpponent, PvpResolveRequest } from '@arcade/protocol';
import { ArenaSimulation, type ArenaBuildConfig } from '@arcade/sim-core';
import { OnlineStatusIndicator } from '../shared/OnlineStatusIndicator.js';
import styles from './PvpPanel.module.css';

interface OpponentsListProps {
  onRefresh: () => Promise<void>;
}

export function OpponentsList({ onRefresh: _onRefresh }: OpponentsListProps) {
  const [challengingId, setChallengingId] = useState<string | null>(null);
  const myPower = userPower.value;

  const handleChallenge = async (opponent: PvpOpponent) => {
    if (challengingId) return;

    setChallengingId(opponent.userId);
    try {
      const response = await createChallenge(opponent.userId);

      if (response.battleData) {
        const seed = response.battleData.seed as number;
        const challengerBuild = response.battleData.challengerBuild as ArenaBuildConfig;
        const challengedBuild = response.battleData.challengedBuild as ArenaBuildConfig;
        const challenge = response.challenge;

        // Run simulation immediately (skip battle scene)
        const simulation = new ArenaSimulation(seed, challengerBuild, challengedBuild);
        const simResult = simulation.run();

        // Build client result for server verification
        const winnerId =
          simResult.winner === 'left'
            ? challenge.challengerId
            : simResult.winner === 'right'
              ? challenge.challengedId
              : null;

        const clientResult: PvpResolveRequest['result'] = {
          winnerId,
          winReason: simResult.winReason,
          challengerStats: {
            finalHp: simResult.leftStats.finalHp,
            damageDealt: simResult.leftStats.damageDealt,
            heroesAlive: simResult.leftStats.heroesAlive,
          },
          challengedStats: {
            finalHp: simResult.rightStats.finalHp,
            damageDealt: simResult.rightStats.damageDealt,
            heroesAlive: simResult.rightStats.heroesAlive,
          },
          duration: simResult.duration,
        };

        // Send result to server for verification
        const resolveResponse = await resolveChallenge(challenge.id, clientResult);

        // Show result modal directly
        showBattleResult(
          {
            ...challenge,
            status: resolveResponse.challenge.status,
            winnerId: resolveResponse.challenge.winnerId,
          },
          resolveResponse.result,
          resolveResponse.rewards
        );
      } else {
        showErrorToast('Nie udało się przygotować walki');
      }
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
    <div class={styles.opponentList}>
      {pvpOpponents.value.map((opponent) => {
        const powerDiff = opponent.power - myPower;
        const powerPercent = myPower > 0 ? Math.round((opponent.power / myPower) * 100) : 100;
        const isStronger = powerDiff > 0;
        const isWeaker = powerDiff < 0;
        const winRate = opponent.pvpWins + opponent.pvpLosses > 0
          ? Math.round((opponent.pvpWins / (opponent.pvpWins + opponent.pvpLosses)) * 100)
          : 0;

        return (
          <div key={opponent.userId} class={styles.opponentCard}>
            {/* Power comparison indicator */}
            <div class={`${styles.powerIndicator} ${
              isStronger ? styles.powerIndicatorStrong :
              isWeaker ? styles.powerIndicatorWeak : ''
            }`}>
              {isStronger ? '↑' : isWeaker ? '↓' : '='}
            </div>

            <div class={styles.opponentMain}>
              {/* Avatar placeholder */}
              <div class={styles.opponentAvatar}>
                {opponent.displayName.charAt(0).toUpperCase()}
              </div>

              {/* Info section */}
              <div
                class={styles.opponentInfo}
                onClick={() => openHubPreview(opponent.userId)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openHubPreview(opponent.userId); }}
              >
                <div class={styles.opponentName}>
                  {opponent.displayName}
                  <OnlineStatusIndicator isOnline={opponent.isOnline} />
                </div>
                <div class={styles.opponentStats}>
                  <span class={`${styles.opponentPower} ${
                    isStronger ? styles.opponentPowerHigh :
                    isWeaker ? styles.opponentPowerLow : ''
                  }`}>
                    💪 {formatPower(opponent.power)}
                    <span class={styles.powerCompare}>
                      ({powerPercent}%)
                    </span>
                  </span>
                  <span class={styles.opponentRecord}>
                    <span class={styles.recordWins}>{opponent.pvpWins}W</span>
                    <span class={styles.recordSep}>/</span>
                    <span class={styles.recordLosses}>{opponent.pvpLosses}L</span>
                    {winRate > 0 && (
                      <span class={styles.recordRate}>({winRate}%)</span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Action area */}
            <div class={styles.opponentAction}>
              {opponent.canChallenge ? (
                <button
                  class={styles.challengeBtn}
                  onClick={() => handleChallenge(opponent)}
                  disabled={challengingId === opponent.userId}
                >
                  {challengingId === opponent.userId ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <span class={styles.challengeBtnIcon}>⚔️</span>
                      <span class={styles.challengeBtnText}>Walcz</span>
                    </>
                  )}
                </button>
              ) : (
                <div class={styles.cooldownBadge}>
                  <span class={styles.cooldownIcon}>⏱️</span>
                  <span class={styles.cooldownTime}>
                    {formatCooldown(opponent.challengeCooldownEndsAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatCooldown(isoDate?: string): string {
  if (!isoDate) return '';

  const endTime = new Date(isoDate).getTime();
  const now = Date.now();
  const diff = endTime - now;

  if (diff <= 0) return 'Gotowe';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
