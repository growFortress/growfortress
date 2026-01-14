/**
 * Admin Broadcast Panel
 *
 * Panel for sending system messages/broadcasts to players.
 * Only accessible to users with ADMIN role.
 */

import { useState, useCallback } from 'preact/hooks';
import { signal } from '@preact/signals';
import { CONFIG } from '../../config.js';
import { getAccessToken } from '../../api/auth.js';
import styles from './AdminBroadcastPanel.module.css';

// ============================================================================
// TYPES
// ============================================================================

interface BroadcastHistory {
  id: string;
  subject: string;
  content: string;
  sentBy: { displayName: string };
  targetCount: number;
  createdAt: string;
}

// ============================================================================
// STATE
// ============================================================================

export const showAdminBroadcastPanel = signal(false);
const broadcastHistory = signal<BroadcastHistory[]>([]);
const historyLoading = signal(false);
const sending = signal(false);
const error = signal<string | null>(null);
const success = signal<string | null>(null);

// ============================================================================
// API HELPERS
// ============================================================================

async function sendBroadcast(data: {
  subject: string;
  content: string;
  targetUsernames?: string[];
}): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${CONFIG.API_URL}/admin/messages/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to send broadcast');
  }
}

async function fetchBroadcastHistory(): Promise<BroadcastHistory[]> {
  const token = getAccessToken();
  const response = await fetch(`${CONFIG.API_URL}/admin/messages/history?limit=20`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch broadcast history');
  }

  const data = await response.json();
  return data.broadcasts;
}

// ============================================================================
// ACTIONS
// ============================================================================

export function openAdminBroadcastPanel(): void {
  showAdminBroadcastPanel.value = true;
  loadHistory();
}

export function closeAdminBroadcastPanel(): void {
  showAdminBroadcastPanel.value = false;
  error.value = null;
  success.value = null;
}

async function loadHistory(): Promise<void> {
  historyLoading.value = true;
  try {
    const history = await fetchBroadcastHistory();
    broadcastHistory.value = history;
  } catch (err) {
    console.error('[AdminBroadcast] Failed to load history:', err);
  } finally {
    historyLoading.value = false;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AdminBroadcastPanel() {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [targetUsernames, setTargetUsernames] = useState('');
  const [isTargeted, setIsTargeted] = useState(false);

  const handleSend = useCallback(async () => {
    if (!subject.trim() || !content.trim()) {
      error.value = 'Subject and content are required';
      return;
    }

    sending.value = true;
    error.value = null;
    success.value = null;

    try {
      const targets = isTargeted && targetUsernames.trim()
        ? targetUsernames.split(',').map(u => u.trim()).filter(Boolean)
        : undefined;

      await sendBroadcast({
        subject: subject.trim(),
        content: content.trim(),
        targetUsernames: targets,
      });

      success.value = isTargeted
        ? `Broadcast sent to ${targets?.length || 0} users`
        : 'Broadcast sent to all users';

      // Clear form
      setSubject('');
      setContent('');
      setTargetUsernames('');
      setIsTargeted(false);

      // Reload history
      loadHistory();
    } catch (err: any) {
      error.value = err.message || 'Failed to send broadcast';
    } finally {
      sending.value = false;
    }
  }, [subject, content, targetUsernames, isTargeted]);

  if (!showAdminBroadcastPanel.value) {
    return null;
  }

  return (
    <div class={styles.overlay} onClick={closeAdminBroadcastPanel}>
      <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h2 class={styles.title}>System Broadcast</h2>
          <button
            class={styles.closeBtn}
            onClick={closeAdminBroadcastPanel}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div class={styles.content}>
          {/* Compose section */}
          <div class={styles.composeSection}>
            <h3 class={styles.sectionTitle}>Send New Broadcast</h3>

            {error.value && (
              <div class={styles.error}>{error.value}</div>
            )}
            {success.value && (
              <div class={styles.success}>{success.value}</div>
            )}

            <div class={styles.formGroup}>
              <label class={styles.label}>Subject</label>
              <input
                type="text"
                class={styles.input}
                value={subject}
                onInput={(e) => setSubject((e.target as HTMLInputElement).value)}
                placeholder="Important announcement..."
                maxLength={100}
              />
            </div>

            <div class={styles.formGroup}>
              <label class={styles.label}>Content</label>
              <textarea
                class={styles.textarea}
                value={content}
                onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
                placeholder="Write your message here..."
                maxLength={2000}
                rows={5}
              />
            </div>

            <div class={styles.formGroup}>
              <label class={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isTargeted}
                  onChange={(e) => setIsTargeted((e.target as HTMLInputElement).checked)}
                />
                <span>Send to specific users only</span>
              </label>
            </div>

            {isTargeted && (
              <div class={styles.formGroup}>
                <label class={styles.label}>Target Usernames (comma-separated)</label>
                <input
                  type="text"
                  class={styles.input}
                  value={targetUsernames}
                  onInput={(e) => setTargetUsernames((e.target as HTMLInputElement).value)}
                  placeholder="user1, user2, user3"
                />
                <span class={styles.hint}>Leave empty to send to all users</span>
              </div>
            )}

            <button
              class={styles.sendBtn}
              onClick={handleSend}
              disabled={sending.value || !subject.trim() || !content.trim()}
            >
              {sending.value ? 'Sending...' : isTargeted ? 'Send to Selected Users' : 'Send to All Users'}
            </button>
          </div>

          {/* History section */}
          <div class={styles.historySection}>
            <h3 class={styles.sectionTitle}>Broadcast History</h3>

            {historyLoading.value ? (
              <div class={styles.loading}>Loading history...</div>
            ) : broadcastHistory.value.length === 0 ? (
              <div class={styles.empty}>No broadcasts sent yet</div>
            ) : (
              <div class={styles.historyList}>
                {broadcastHistory.value.map((broadcast) => (
                  <div key={broadcast.id} class={styles.historyItem}>
                    <div class={styles.historyHeader}>
                      <span class={styles.historySubject}>{broadcast.subject}</span>
                      <span class={styles.historyMeta}>
                        {broadcast.targetCount} recipients
                      </span>
                    </div>
                    <div class={styles.historyContent}>{broadcast.content}</div>
                    <div class={styles.historyFooter}>
                      <span>Sent by {broadcast.sentBy.displayName}</span>
                      <span>{new Date(broadcast.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
