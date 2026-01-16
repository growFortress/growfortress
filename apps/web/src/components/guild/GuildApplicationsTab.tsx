/**
 * Guild Applications Tab - Shows pending applications for officers/leaders to review
 */
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { GuildApplication } from '@arcade/protocol';
import {
  guildApplications,
  guildApplicationsTotal,
  applicationsLoading,
  playerGuild,
  isGuildOfficer,
} from '../../state/guild.signals.js';
import {
  getGuildApplications,
  acceptApplication,
  declineApplication,
} from '../../api/guild.js';
import { Button } from '../shared/Button.js';
import styles from './GuildPanel.module.css';

interface GuildApplicationsTabProps {
  onRefresh: () => void;
}

export function GuildApplicationsTab({ onRefresh }: GuildApplicationsTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const limit = 10;

  const guild = playerGuild.value;
  const applications = guildApplications.value;
  const total = guildApplicationsTotal.value;
  const loading = applicationsLoading.value;
  const canManage = isGuildOfficer.value;

  const loadApplications = useCallback(async () => {
    if (!guild) return;

    applicationsLoading.value = true;
    setError(null);

    try {
      const response = await getGuildApplications(guild.id, {
        status: 'PENDING',
        limit,
        offset: page * limit,
      });
      guildApplications.value = response.applications;
      guildApplicationsTotal.value = response.total;
    } catch (err: any) {
      setError(err.message || 'Nie udalo sie zaladowac podan');
    } finally {
      applicationsLoading.value = false;
    }
  }, [guild?.id, page]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  if (!guild || !canManage) {
    return (
      <div class={styles.infoSection}>
        <div class={styles.emptyState}>
          <span class={styles.emptyIcon}>🔒</span>
          <p>Tylko oficerowie i lider moga przegladac podania.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div class={styles.infoSection}>
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>
          Podania ({total})
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadApplications}
          disabled={loading}
        >
          {loading ? 'Ladowanie...' : 'Odswiez'}
        </Button>
      </div>

      {error && (
        <div class={styles.errorBanner}>
          {error}
        </div>
      )}

      {loading && applications.length === 0 ? (
        <div class={styles.loadingState}>
          Ladowanie podan...
        </div>
      ) : applications.length === 0 ? (
        <div class={styles.emptyState}>
          <span class={styles.emptyIcon}>📭</span>
          <p>Brak oczekujacych podan.</p>
          <p class={styles.emptyHint}>
            Gracze moga wysylac podania jesli gildia jest w trybie "Podania".
          </p>
        </div>
      ) : (
        <>
          <div class={styles.applicationsList}>
            {applications.map((application) => (
              <ApplicationCard
                key={application.id}
                application={application}
                onAction={() => {
                  loadApplications();
                  onRefresh();
                }}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div class={styles.pagination}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || loading}
              >
                Poprzednia
              </Button>
              <span class={styles.pageInfo}>
                Strona {page + 1} z {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1 || loading}
              >
                Nastepna
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ApplicationCardProps {
  application: GuildApplication;
  onAction: () => void;
}

function ApplicationCard({ application, onAction }: ApplicationCardProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAccept = async () => {
    setActionLoading(true);
    setActionError(null);

    try {
      await acceptApplication(application.id);
      onAction();
    } catch (err: any) {
      setActionError(err.message || 'Nie udalo sie zaakceptowac podania');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    setActionLoading(true);
    setActionError(null);

    try {
      await declineApplication(application.id);
      onAction();
    } catch (err: any) {
      setActionError(err.message || 'Nie udalo sie odrzucic podania');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate time remaining until expiry
  const expiresAt = new Date(application.expiresAt);
  const now = new Date();
  const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));

  // Get applicant info (with type assertion for the extended data)
  const applicant = (application as any).applicant;
  const applicantName = applicant?.displayName || 'Nieznany gracz';
  const applicantLevel = applicant?.highestWave ?? 0;
  const applicantPower = applicant?.powerUpgrades?.cachedTotalPower ?? 0;

  return (
    <div class={styles.applicationCard}>
      <div class={styles.applicationInfo}>
        <div class={styles.applicationHeader}>
          <span class={styles.applicantName}>{applicantName}</span>
          <span class={styles.applicationExpiry}>
            Wygasa za {hoursRemaining}h
          </span>
        </div>
        <div class={styles.applicantStats}>
          <span title="Najwyzsza fala">Fala {applicantLevel}</span>
          {applicantPower > 0 && (
            <span title="Calkowita moc">Power: {applicantPower.toLocaleString()}</span>
          )}
        </div>
        {application.message && (
          <div class={styles.applicationMessage}>
            "{application.message}"
          </div>
        )}
        {actionError && (
          <div class={styles.applicationError}>
            {actionError}
          </div>
        )}
      </div>
      <div class={styles.applicationActions}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleAccept}
          disabled={actionLoading}
        >
          Akceptuj
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleDecline}
          disabled={actionLoading}
        >
          Odrzuc
        </Button>
      </div>
    </div>
  );
}
