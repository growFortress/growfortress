/**
 * Guild Treasury Tab - Shows treasury balance, deposit/withdraw, and logs
 */
import { useState } from 'preact/hooks';
import {
  playerGuild,
  guildTreasury,
  treasuryLogs,
  canWithdraw,
  nextWithdrawAt,
  isGuildLeader,
  treasuryLoading,
} from '../../state/guild.signals.js';
import { depositToTreasury, withdrawFromTreasury } from '../../api/guild.js';
import { showSuccessToast } from '../../state/ui.signals.js';
import { Button } from '../shared/Button.js';
import { Spinner } from '../shared/Spinner.js';
import styles from './GuildPanel.module.css';

interface GuildTreasuryTabProps {
  onRefresh: () => void;
}

export function GuildTreasuryTab({ onRefresh }: GuildTreasuryTabProps) {
  const [depositGold, setDepositGold] = useState('');
  const [depositDust, setDepositDust] = useState('');
  const [withdrawGold, setWithdrawGold] = useState('');
  const [withdrawDust, setWithdrawDust] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllLogs, setShowAllLogs] = useState(false);

  const guild = playerGuild.value;
  const treasury = guildTreasury.value;
  const logs = treasuryLogs.value;
  const canWithdrawNow = canWithdraw.value;
  const nextWithdraw = nextWithdrawAt.value;

  if (!guild) return null;

  if (treasuryLoading.value) {
    return (
      <div class={styles.loading}>
        <Spinner />
      </div>
    );
  }

  const handleDeposit = async () => {
    const gold = parseInt(depositGold) || 0;
    const dust = parseInt(depositDust) || 0;

    if (gold <= 0 && dust <= 0) {
      setError('Podaj kwote do wplaty');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await depositToTreasury(guild.id, { gold, dust });
      setDepositGold('');
      setDepositDust('');
      const parts = [];
      if (gold > 0) parts.push(`${gold} gold`);
      if (dust > 0) parts.push(`${dust} dust`);
      showSuccessToast(`Wplacono ${parts.join(' i ')}`);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Nie udalo sie wplacic');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const gold = parseInt(withdrawGold) || 0;
    const dust = parseInt(withdrawDust) || 0;

    if (gold <= 0 && dust <= 0) {
      setError('Podaj kwote do wyplaty');
      return;
    }

    setActionLoading(true);
    setError(null);

    try {
      await withdrawFromTreasury(guild.id, { gold, dust, reason: 'Wyplata ze skarbca' });
      setWithdrawGold('');
      setWithdrawDust('');
      const parts = [];
      if (gold > 0) parts.push(`${gold} gold`);
      if (dust > 0) parts.push(`${dust} dust`);
      showSuccessToast(`Wyplacono ${parts.join(' i ')}`);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Nie udalo sie wyplacic');
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff <= 0) return 'Teraz';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatLogTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m temu`;
    if (diffHours < 24) return `${diffHours}h temu`;
    return `${diffDays}d temu`;
  };

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case 'DEPOSIT_GOLD':
        return 'Wplata gold';
      case 'DEPOSIT_DUST':
        return 'Wplata dust';
      case 'WITHDRAW_GOLD':
        return 'Wyplata gold';
      case 'WITHDRAW_DUST':
        return 'Wyplata dust';
      case 'BATTLE_COST':
        return 'Koszt bitwy';
      case 'UPGRADE_COST':
        return 'Koszt ulepszenia';
      case 'REWARD_DISTRIBUTION':
        return 'Nagroda';
      default:
        return type;
    }
  };

  const isPositiveTransaction = (type: string) => {
    return type.startsWith('DEPOSIT') || type === 'REWARD_DISTRIBUTION';
  };

  return (
    <div class={styles.treasurySection}>
      {/* Balance */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Stan skarbca</span>
      </div>
      <div class={styles.treasuryBalance}>
        <div class={styles.treasuryItem}>
          <span class={styles.treasuryLabel}>Gold</span>
          <span class={`${styles.treasuryValue} ${styles.treasuryGold}`}>
            {treasury?.gold.toLocaleString() || 0}
          </span>
        </div>
        <div class={styles.treasuryItem}>
          <span class={styles.treasuryLabel}>Dust</span>
          <span class={`${styles.treasuryValue} ${styles.treasuryDust}`}>
            {treasury?.dust.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Deposit */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Wplac do skarbca</span>
      </div>
      <div class={styles.depositForm}>
        <div class={styles.depositInput}>
          <input
            type="number"
            placeholder="Gold"
            value={depositGold}
            onInput={(e) => setDepositGold((e.target as HTMLInputElement).value)}
            min="0"
          />
          <input
            type="number"
            placeholder="Dust"
            value={depositDust}
            onInput={(e) => setDepositDust((e.target as HTMLInputElement).value)}
            min="0"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleDeposit}
            disabled={actionLoading}
            loading={actionLoading}
          >
            Wplac
          </Button>
        </div>
      </div>

      {/* Withdraw (Leader only) */}
      {isGuildLeader.value && (
        <>
          <div class={styles.sectionHeader}>
            <span class={styles.sectionTitle}>Wyplac ze skarbca</span>
            {!canWithdrawNow && nextWithdraw && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-40)' }}>
                Dostepne za: {formatTime(nextWithdraw)}
              </span>
            )}
          </div>
          <div class={styles.depositForm}>
            <div class={styles.depositInput}>
              <input
                type="number"
                placeholder="Gold"
                value={withdrawGold}
                onInput={(e) => setWithdrawGold((e.target as HTMLInputElement).value)}
                min="0"
                disabled={!canWithdrawNow}
              />
              <input
                type="number"
                placeholder="Dust"
                value={withdrawDust}
                onInput={(e) => setWithdrawDust((e.target as HTMLInputElement).value)}
                min="0"
                disabled={!canWithdrawNow}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleWithdraw}
                disabled={actionLoading || !canWithdrawNow}
                loading={actionLoading}
              >
                Wyplac
              </Button>
            </div>
            {!canWithdrawNow && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-40)' }}>
                Mozesz wyplacac co 24 godziny
              </div>
            )}
          </div>
        </>
      )}

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          {error}
        </div>
      )}

      {/* Transaction logs */}
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Ostatnie transakcje</span>
        {logs.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllLogs(!showAllLogs)}
          >
            {showAllLogs ? 'Pokaz mniej' : 'Pokaz wszystkie'}
          </Button>
        )}
      </div>
      {logs.length === 0 ? (
        <div class={styles.emptyState}>
          <span class={styles.emptyIcon}>📜</span>
          <span class={styles.emptyText}>Brak transakcji</span>
        </div>
      ) : (
        <div class={styles.treasuryLogs}>
          {(showAllLogs ? logs : logs.slice(0, 5)).map((log, index) => (
            <div key={log.id || index} class={styles.logEntry}>
              <div>
                <span class={styles.logType}>{getLogTypeLabel(log.transactionType)}</span>
                {log.user && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-60)' }}>
                    - {log.user.displayName}
                  </span>
                )}
              </div>
              <div>
                <span
                  class={`${styles.logAmount} ${
                    isPositiveTransaction(log.transactionType)
                      ? styles.logAmountPositive
                      : styles.logAmountNegative
                  }`}
                >
                  {isPositiveTransaction(log.transactionType) ? '+' : '-'}
                  {log.goldAmount > 0 && `${log.goldAmount}g`}
                  {log.goldAmount > 0 && log.dustAmount > 0 && ' '}
                  {log.dustAmount > 0 && `${log.dustAmount}d`}
                </span>
                <span class={styles.logTime}>{formatLogTime(log.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
