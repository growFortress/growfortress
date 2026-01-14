/**
 * Guild Battles Tab - Shows battle history with replay functionality
 * and attack controls for officers/leaders.
 *
 * Displays arena 5v5 battle history with option to watch replays.
 * Officers/Leaders can initiate attacks and manage shield.
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { GuildBattle, GuildBattleWithResult } from '@arcade/protocol';
import {
  playerGuild,
  battleHistory,
  battlesLoading,
  canInitiateAttack,
  readyMembersCount,
  shieldStatus,
  setShieldStatus,
} from '../../state/guild.signals.js';
import {
  getAttackStatus,
  getShieldStatus,
  activateShield,
  type AttackStatus,
  type InstantAttackResponse,
} from '../../api/guild.js';
import { Spinner } from '../shared/Spinner.js';
import { Button } from '../shared/Button.js';
import { GuildTag } from '../shared/GuildTag.js';
import { ArenaReplay } from './ArenaReplay.js';
import { AttackModal } from './AttackModal.js';
import styles from './GuildPanel.module.css';

interface GuildBattlesTabProps {
  onRefresh: () => void;
}

export function GuildBattlesTab({ onRefresh }: GuildBattlesTabProps) {
  const guild = playerGuild.value;
  const history = battleHistory.value;
  const [replayBattle, setReplayBattle] = useState<GuildBattleWithResult | null>(null);
  const [showAttackModal, setShowAttackModal] = useState(false);
  const [attackStatus, setAttackStatus] = useState<AttackStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Load attack status and shield status
  useEffect(() => {
    if (guild && canInitiateAttack.value) {
      loadStatuses();
    }
  }, [guild?.id]);

  const loadStatuses = useCallback(async () => {
    if (!guild) return;

    setLoadingStatus(true);
    try {
      const [attackData, shieldData] = await Promise.all([
        getAttackStatus(guild.id),
        getShieldStatus(guild.id),
      ]);
      setAttackStatus(attackData);
      setShieldStatus(shieldData);
    } catch (err) {
      console.error('Failed to load battle statuses:', err);
    } finally {
      setLoadingStatus(false);
    }
  }, [guild?.id]);

  const handleAttackComplete = (_result: InstantAttackResponse) => {
    // Refresh data after attack
    onRefresh();
    loadStatuses();
  };

  if (!guild) return null;

  if (battlesLoading.value) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const totalMembers = guild.members.length;
  const readyCount = readyMembersCount.value;
  const canAttack = attackStatus?.canAttack && !shieldStatus.value?.isActive && readyCount >= 5;

  return (
    <div class={styles.tabContent}>
      {/* Attack Controls - only for Leader/Officer */}
      {canInitiateAttack.value && (
        <div class={styles.attackControls}>
          {/* Shield Status */}
          <ShieldSection guildId={guild.id} onRefresh={loadStatuses} />

          {/* Attack Stats & Button */}
          <div class={styles.attackActions}>
            <div class={styles.attackStats}>
              <div class={styles.attackStat}>
                <span>Dzienne ataki:</span>
                <span class={styles.attackStatValue}>
                  {attackStatus?.dailyAttacks ?? '-'}/{attackStatus?.maxDailyAttacks ?? '-'}
                </span>
              </div>
              <div class={styles.attackStat}>
                <span>Gotowych:</span>
                <span class={`${styles.attackStatValue} ${readyCount >= 5 ? styles.attackStatReady : ''}`}>
                  {readyCount}/{totalMembers}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => setShowAttackModal(true)}
              disabled={!canAttack || loadingStatus}
            >
              Atakuj Gildie
            </Button>
          </div>
        </div>
      )}

      {/* Info for non-officers */}
      {!canInitiateAttack.value && (
        <div class={styles.hint} style={{ marginBottom: '1rem', textAlign: 'center' }}>
          Tylko Leader i Oficerowie moga inicjowac ataki.
        </div>
      )}

      {/* Battle History */}
      <div class={styles.sectionHeader}>
        <h3>Historia bitew (Arena 5v5)</h3>
        <span class={styles.badge}>{history.length}</span>
      </div>

      {history.length === 0 ? (
        <div class={styles.empty}>
          <p>Brak historii bitew</p>
          <p class={styles.hint}>
            {canInitiateAttack.value
              ? 'Rozpocznij bitwe klikajac "Atakuj Gildie" powyzej.'
              : 'Poczekaj az liderzy gildii rozpoczna bitwy.'}
          </p>
        </div>
      ) : (
        <div class={styles.battleList}>
          {history.map((battle) => (
            <BattleCard
              key={battle.id}
              battle={battle}
              currentGuildId={guild.id}
              onWatchReplay={() => setReplayBattle(battle as GuildBattleWithResult)}
            />
          ))}
        </div>
      )}

      {/* Arena Replay Modal */}
      {replayBattle && (
        <ArenaReplay
          battle={replayBattle}
          currentGuildId={guild.id}
          onClose={() => setReplayBattle(null)}
        />
      )}

      {/* Attack Modal */}
      {showAttackModal && (
        <AttackModal
          guildId={guild.id}
          onClose={() => setShowAttackModal(false)}
          onAttackComplete={handleAttackComplete}
        />
      )}
    </div>
  );
}

// ============================================================================
// SHIELD SECTION
// ============================================================================

interface ShieldSectionProps {
  guildId: string;
  onRefresh: () => void;
}

function ShieldSection({ guildId, onRefresh }: ShieldSectionProps) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = shieldStatus.value;

  const handleActivate = async () => {
    if (!status?.canActivate) return;

    const cost = status.activationCost;
    const confirmed = window.confirm(
      `Aktywowac tarche za ${cost.toLocaleString()} zlota?\n\nTarcza blokuje ataki NA i OD Twojej gildii przez 24 godziny.`
    );

    if (!confirmed) return;

    setActivating(true);
    setError(null);

    try {
      await activateShield(guildId);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to activate shield:', err);
      setError(err.message || 'Nie udalo sie aktywowac tarczy');
    } finally {
      setActivating(false);
    }
  };

  const formatTimeRemaining = (expiresAt: string | null): string => {
    if (!expiresAt) return '';
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Wygasla';

    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (!status) {
    return (
      <div class={styles.shieldSection}>
        <span class={styles.shieldInactive}>Ladowanie...</span>
      </div>
    );
  }

  return (
    <div class={styles.shieldSection}>
      {status.isActive ? (
        <>
          <div class={styles.shieldActive}>
            <span class={styles.shieldIcon}>🛡️</span>
            <span>Tarcza aktywna</span>
          </div>
          <span class={styles.shieldTimer}>
            Pozostalo: {formatTimeRemaining(status.expiresAt)}
          </span>
        </>
      ) : (
        <>
          <span class={styles.shieldInactive}>Tarcza nieaktywna</span>
          {status.canActivate ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleActivate}
              disabled={activating}
            >
              {activating ? 'Aktywuje...' : `Aktywuj (${status.activationCost.toLocaleString()} gold)`}
            </Button>
          ) : (
            <span class={styles.shieldLimit}>
              Limit: {status.weeklyUsed}/{status.maxWeekly} w tym tygodniu
            </span>
          )}
        </>
      )}
      {error && <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
}

// ============================================================================
// BATTLE CARD (simplified for Arena 5v5)
// ============================================================================

interface BattleCardProps {
  battle: GuildBattle & {
    attackerGuildName: string;
    attackerGuildTag: string;
    defenderGuildName: string;
    defenderGuildTag: string;
    result?: {
      winnerGuildId: string | null;
      winnerSide?: string;
      attackerHonorChange?: number;
      defenderHonorChange?: number;
      attackerSurvivors?: number;
      defenderSurvivors?: number;
    } | null;
  };
  currentGuildId: string;
  onWatchReplay: () => void;
}

function BattleCard({ battle, currentGuildId, onWatchReplay }: BattleCardProps) {
  const isAttacker = battle.attackerGuildId === currentGuildId;
  const isDefender = battle.defenderGuildId === currentGuildId;

  const didWin = battle.result && battle.result.winnerGuildId === currentGuildId;
  const didLose = battle.result && battle.result.winnerGuildId && battle.result.winnerGuildId !== currentGuildId;
  // Draw is the fallback case (neither win nor loss) - no explicit variable needed

  // Get honor change for current guild
  const honorChange = battle.result
    ? (isAttacker ? battle.result.attackerHonorChange : battle.result.defenderHonorChange)
    : undefined;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pl-PL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div class={`${styles.battleCard} ${styles.battleCardResolved}`}>
      <div class={styles.battleHeader}>
        <div class={styles.battleGuilds}>
          <span style={{ fontWeight: isAttacker ? 600 : 400, color: isAttacker ? '#4da6ff' : undefined }}>
            {battle.attackerGuildName}{' '}
            <GuildTag
              guildId={battle.attackerGuildId}
              tag={battle.attackerGuildTag}
              clickable={!isAttacker}
            />
          </span>
          <span class={styles.battleVs}>vs</span>
          <span style={{ fontWeight: isDefender ? 600 : 400, color: isDefender ? '#4da6ff' : undefined }}>
            {battle.defenderGuildName}{' '}
            <GuildTag
              guildId={battle.defenderGuildId}
              tag={battle.defenderGuildTag}
              clickable={!isDefender}
            />
          </span>
        </div>
        <span class={`${styles.battleStatus} ${styles.statusResolved}`}>
          {isAttacker ? 'Atak' : 'Obrona'}
        </span>
      </div>

      <div class={styles.battleMeta}>
        <span>{formatDate(battle.resolvedAt)}</span>
        {battle.isRevenge && <span class={styles.revengeBadge}>Rewanz</span>}
      </div>

      {/* Result */}
      {battle.result && (
        <div class={styles.battleResult}>
          <span class={didWin ? styles.resultWin : didLose ? styles.resultLoss : styles.resultDraw}>
            {didWin ? 'WYGRANA!' : didLose ? 'PRZEGRANA' : 'REMIS'}
          </span>

          {battle.result.attackerSurvivors !== undefined && (
            <span class={styles.survivors}>
              Ocalalych: {isAttacker ? battle.result.attackerSurvivors : battle.result.defenderSurvivors}/5
            </span>
          )}

          {honorChange !== undefined && honorChange !== 0 && (
            <span
              class={`${styles.honorChange} ${
                honorChange >= 0 ? styles.honorPositive : styles.honorNegative
              }`}
            >
              {honorChange >= 0 ? '+' : ''}{honorChange} Honor
            </span>
          )}

          <button
            class={styles.replayBtn}
            onClick={onWatchReplay}
            title="Obejrzyj replay bitwy"
          >
            Obejrzyj
          </button>
        </div>
      )}
    </div>
  );
}
