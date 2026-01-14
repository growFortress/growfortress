/**
 * Admin Moderation Panel
 *
 * Panel for reviewing reports, managing user sanctions (warn, mute, ban).
 * Only accessible to users with ADMIN role.
 */

import { useState, useEffect } from 'preact/hooks';
import { signal } from '@preact/signals';
import { CONFIG } from '../../config.js';
import { getAccessToken } from '../../api/auth.js';
import styles from './AdminModerationPanel.module.css';

// ============================================================================
// TYPES
// ============================================================================

interface Report {
  id: string;
  threadId: string | null;
  messageId: string | null;
  reporter: {
    id: string;
    displayName: string;
    username: string;
  };
  reason: 'SPAM' | 'SCAM' | 'OFFENSIVE' | 'HARASSMENT' | 'OTHER';
  details: string | null;
  status: 'PENDING' | 'REVIEWED' | 'DISMISSED' | 'ACTIONED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  actionTaken: string | null;
  createdAt: string;
  thread?: {
    subject: string;
    participants: { displayName: string }[];
  };
  message?: {
    content: string;
    sender: { displayName: string } | null;
    createdAt: string;
  };
}

// ============================================================================
// STATE
// ============================================================================

export const showAdminModerationPanel = signal(false);
const reports = signal<Report[]>([]);
const reportsTotal = signal(0);
const reportsLoading = signal(false);
const error = signal<string | null>(null);
const selectedReport = signal<Report | null>(null);

// ============================================================================
// API HELPERS
// ============================================================================

async function fetchReports(status?: string): Promise<{ reports: Report[]; total: number }> {
  const token = getAccessToken();
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('limit', '20');

  const response = await fetch(`${CONFIG.API_URL}/v1/moderation/reports?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to fetch reports');
  return response.json();
}

async function reviewReport(
  reportId: string,
  action: 'dismiss' | 'warn' | 'mute' | 'ban',
  muteDuration?: number
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${CONFIG.API_URL}/v1/moderation/reports/${reportId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, muteDuration }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to review report');
  }
}


// ============================================================================
// ACTIONS
// ============================================================================

export function openAdminModerationPanel(): void {
  showAdminModerationPanel.value = true;
  loadReports();
}

export function closeAdminModerationPanel(): void {
  showAdminModerationPanel.value = false;
  selectedReport.value = null;
  error.value = null;
}

async function loadReports(status = 'PENDING'): Promise<void> {
  reportsLoading.value = true;
  error.value = null;

  try {
    const data = await fetchReports(status);
    reports.value = data.reports;
    reportsTotal.value = data.total;
  } catch (err: any) {
    error.value = err.message || 'Failed to load reports';
  } finally {
    reportsLoading.value = false;
  }
}

// ============================================================================
// COMPONENTS
// ============================================================================

const REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  SCAM: 'Scam / Phishing',
  OFFENSIVE: 'Offensive Content',
  HARASSMENT: 'Harassment',
  OTHER: 'Other',
};

const MUTE_DURATIONS = [
  { label: '1 hour', value: 1 },
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 24 * 7 },
  { label: '30 days', value: 24 * 30 },
  { label: 'Permanent', value: 0 },
];

function ReportCard({ report, onSelect }: { report: Report; onSelect: () => void }) {
  return (
    <div class={styles.reportCard} onClick={onSelect}>
      <div class={styles.reportHeader}>
        <span class={`${styles.reasonBadge} ${styles[`reason${report.reason}`]}`}>
          {REASON_LABELS[report.reason]}
        </span>
        <span class={styles.reportDate}>
          {new Date(report.createdAt).toLocaleString()}
        </span>
      </div>

      <div class={styles.reportContent}>
        {report.message ? (
          <>
            <div class={styles.reportMessage}>"{report.message.content}"</div>
            <div class={styles.reportMeta}>
              From: {report.message.sender?.displayName || 'System'}
            </div>
          </>
        ) : report.thread ? (
          <div class={styles.reportMeta}>
            Thread: {report.thread.subject}
          </div>
        ) : null}
      </div>

      <div class={styles.reportFooter}>
        <span>Reported by: {report.reporter.displayName}</span>
        {report.details && <span class={styles.hasDetails}>Has details</span>}
      </div>
    </div>
  );
}

function ReportDetail({ report, onClose }: { report: Report; onClose: () => void }) {
  const [muteDuration, setMuteDuration] = useState(24);
  const [processing, setProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<'mute' | 'ban' | null>(null);

  const executeAction = async (action: 'dismiss' | 'warn' | 'mute' | 'ban') => {
    setProcessing(true);
    try {
      await reviewReport(report.id, action, action === 'mute' ? muteDuration : undefined);
      onClose();
      loadReports();
    } catch (err: any) {
      error.value = err.message;
    } finally {
      setProcessing(false);
      setPendingAction(null);
    }
  };

  const handleAction = (action: 'dismiss' | 'warn' | 'mute' | 'ban') => {
    // Destructive actions require confirmation
    if (action === 'ban' || action === 'mute') {
      setPendingAction(action);
    } else {
      executeAction(action);
    }
  };

  const getConfirmationMessage = () => {
    if (pendingAction === 'ban') {
      const senderName = report.message?.sender?.displayName || 'this user';
      return `Are you sure you want to permanently ban ${senderName}? This action cannot be undone.`;
    }
    if (pendingAction === 'mute') {
      const senderName = report.message?.sender?.displayName || 'this user';
      const duration = MUTE_DURATIONS.find(d => d.value === muteDuration)?.label || `${muteDuration} hours`;
      return `Are you sure you want to mute ${senderName} for ${duration}?`;
    }
    return '';
  };

  return (
    <div class={styles.reportDetail}>
      <div class={styles.detailHeader}>
        <h3>Report Details</h3>
        <button class={styles.closeBtn} onClick={onClose}>&times;</button>
      </div>

      <div class={styles.detailBody}>
        <div class={styles.detailSection}>
          <label>Reason:</label>
          <span class={`${styles.reasonBadge} ${styles[`reason${report.reason}`]}`}>
            {REASON_LABELS[report.reason]}
          </span>
        </div>

        {report.details && (
          <div class={styles.detailSection}>
            <label>Additional Details:</label>
            <p>{report.details}</p>
          </div>
        )}

        <div class={styles.detailSection}>
          <label>Reporter:</label>
          <span>{report.reporter.displayName} (@{report.reporter.username})</span>
        </div>

        {report.message && (
          <div class={styles.detailSection}>
            <label>Reported Message:</label>
            <div class={styles.messageBox}>
              <div class={styles.messageSender}>
                {report.message.sender?.displayName || 'System'}
              </div>
              <div class={styles.messageContent}>{report.message.content}</div>
              <div class={styles.messageTime}>
                {new Date(report.message.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        {report.thread && (
          <div class={styles.detailSection}>
            <label>Thread:</label>
            <span>{report.thread.subject}</span>
            <div class={styles.participants}>
              Participants: {report.thread.participants.map(p => p.displayName).join(', ')}
            </div>
          </div>
        )}

        <div class={styles.detailSection}>
          <label>Mute Duration (if muting):</label>
          <select
            class={styles.select}
            value={muteDuration}
            onChange={(e) => setMuteDuration(Number((e.target as HTMLSelectElement).value))}
          >
            {MUTE_DURATIONS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div class={styles.detailActions}>
        <button
          class={`${styles.actionBtn} ${styles.dismissBtn}`}
          onClick={() => handleAction('dismiss')}
          disabled={processing}
        >
          Dismiss
        </button>
        <button
          class={`${styles.actionBtn} ${styles.warnBtn}`}
          onClick={() => handleAction('warn')}
          disabled={processing}
        >
          Warn User
        </button>
        <button
          class={`${styles.actionBtn} ${styles.muteBtn}`}
          onClick={() => handleAction('mute')}
          disabled={processing}
        >
          Mute User
        </button>
        <button
          class={`${styles.actionBtn} ${styles.banBtn}`}
          onClick={() => handleAction('ban')}
          disabled={processing}
        >
          Permanent Ban
        </button>
      </div>

      {/* Confirmation Dialog for destructive actions */}
      {pendingAction && (
        <div class={styles.confirmOverlay} onClick={() => setPendingAction(null)}>
          <div class={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <h4 class={styles.confirmTitle}>
              {pendingAction === 'ban' ? 'Confirm Ban' : 'Confirm Mute'}
            </h4>
            <p class={styles.confirmMessage}>{getConfirmationMessage()}</p>
            <div class={styles.confirmActions}>
              <button
                class={styles.confirmCancel}
                onClick={() => setPendingAction(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                class={`${styles.confirmSubmit} ${pendingAction === 'ban' ? styles.banBtn : styles.muteBtn}`}
                onClick={() => executeAction(pendingAction)}
                disabled={processing}
              >
                {processing ? 'Processing...' : pendingAction === 'ban' ? 'Yes, Ban User' : 'Yes, Mute User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminModerationPanel() {
  const [statusFilter, setStatusFilter] = useState('PENDING');

  useEffect(() => {
    if (showAdminModerationPanel.value) {
      loadReports(statusFilter);
    }
  }, [statusFilter]);

  if (!showAdminModerationPanel.value) {
    return null;
  }

  return (
    <div class={styles.overlay} onClick={closeAdminModerationPanel}>
      <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>Moderation Panel</h2>
          <button
            class={styles.closeBtn}
            onClick={closeAdminModerationPanel}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div class={styles.filters}>
          <button
            class={`${styles.filterBtn} ${statusFilter === 'PENDING' ? styles.active : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending ({reportsTotal.value})
          </button>
          <button
            class={`${styles.filterBtn} ${statusFilter === 'REVIEWED' ? styles.active : ''}`}
            onClick={() => setStatusFilter('REVIEWED')}
          >
            Reviewed
          </button>
          <button
            class={`${styles.filterBtn} ${statusFilter === 'ACTIONED' ? styles.active : ''}`}
            onClick={() => setStatusFilter('ACTIONED')}
          >
            Actioned
          </button>
          <button
            class={`${styles.filterBtn} ${statusFilter === 'DISMISSED' ? styles.active : ''}`}
            onClick={() => setStatusFilter('DISMISSED')}
          >
            Dismissed
          </button>
        </div>

        <div class={styles.content}>
          {error.value && <div class={styles.error}>{error.value}</div>}

          {selectedReport.value ? (
            <ReportDetail
              report={selectedReport.value}
              onClose={() => { selectedReport.value = null; }}
            />
          ) : reportsLoading.value ? (
            <div class={styles.loading}>Loading reports...</div>
          ) : reports.value.length === 0 ? (
            <div class={styles.empty}>No reports found</div>
          ) : (
            <div class={styles.reportsList}>
              {reports.value.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onSelect={() => { selectedReport.value = report; }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
