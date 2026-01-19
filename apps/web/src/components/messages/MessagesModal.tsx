/**
 * MessagesModal
 *
 * Main messaging modal with two-panel layout:
 * - Left: Thread list with tabs
 * - Right: Thread view with messages and reply
 */

import { useEffect, useState, useRef } from 'preact/hooks';
import type { UserSearchResult } from '@arcade/protocol';
import { useTranslation } from '../../i18n/useTranslation.js';
import {
  showMessagesModal,
  messagesActiveTab,
  threads,
  threadsLoading,
  selectedThreadId,
  selectedThread,
  selectedThreadLoading,
  showComposeModal,
  composeLoading,
  replyLoading,
  unreadCounts,
  messagesError,
  closeMessagesModal,
  setMessagesTab,
  selectThread,
  sendNewMessage,
  sendReply,
  openComposeModal,
  closeComposeModal,
} from '../../state/messages.signals.js';
import { searchUsers } from '../../api/messages.js';
import { acceptInvitation, declineInvitation } from '../../api/guild.js';
import styles from './MessagesModal.module.css';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(dateStr: string, t: (key: string) => string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return t('messages.yesterday');
  } else if (days < 7) {
    return date.toLocaleDateString(locale, { weekday: 'short' });
  } else {
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }
}

function getTypeBadge(type: string, t: (key: string) => string): { label: string; className: string } | null {
  switch (type) {
    case 'SYSTEM':
      return { label: t('messages.typeBadges.system'), className: styles.typeBadgeSystem };
    case 'GUILD_INVITE':
    case 'GUILD_KICK':
      return { label: t('messages.typeBadges.guild'), className: styles.typeBadgeGuild };
    case 'GROUP':
      return { label: t('messages.typeBadges.group'), className: styles.typeBadgeGroup };
    default:
      return null;
  }
}

/**
 * Simple markdown renderer for message content.
 * Supports: **bold**, *italic*, bullet lists (• or *)
 */
function renderMessageContent(content: string) {
  // Split by lines to handle lists
  const lines = content.split('\n');

  const processInlineMarkdown = (text: string) => {
    // Process bold first
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;

    const tempParts: (string | { type: 'bold'; content: string })[] = [];
    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        tempParts.push(text.slice(lastIndex, match.index));
      }
      tempParts.push({ type: 'bold', content: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      tempParts.push(text.slice(lastIndex));
    }

    // Convert to JSX
    return tempParts.map((part, i) => {
      if (typeof part === 'string') {
        return part;
      }
      return <strong key={i}>{part.content}</strong>;
    });
  };

  return lines.map((line, lineIndex) => {
    // Check if line is a bullet point
    const bulletMatch = line.match(/^\s*[•\-\*]\s+(.+)$/);
    if (bulletMatch) {
      return (
        <div key={lineIndex} style={{ paddingLeft: '1rem', display: 'flex', gap: '0.5rem' }}>
          <span>•</span>
          <span>{processInlineMarkdown(bulletMatch[1])}</span>
        </div>
      );
    }

    // Regular line
    return (
      <div key={lineIndex}>
        {processInlineMarkdown(line) || '\u00A0'}
      </div>
    );
  });
}

// ============================================================================
// THREAD LIST COMPONENT
// ============================================================================

interface ThreadListProps {
  onSelectThread: (id: string) => void;
  t: (key: string) => string;
  locale: string;
}

function ThreadList({ onSelectThread, t, locale }: ThreadListProps) {
  const threadList = threads.value;
  const loading = threadsLoading.value;
  const selected = selectedThreadId.value;

  if (loading && threadList.length === 0) {
    return <div class={styles.loading}>{t('messages.loading')}</div>;
  }

  if (threadList.length === 0) {
    return (
      <div class={styles.emptyState}>
        <div class={styles.emptyIcon}>📭</div>
        <div>{t('messages.noMessages')}</div>
      </div>
    );
  }

  return (
    <div class={styles.listContent}>
      {threadList.map((thread) => {
        const badge = getTypeBadge(thread.type, t);
        const participantName = thread.participants[0]?.displayName || 'System';
        const isActive = selected === thread.id;
        const hasUnread = thread.unreadCount > 0;

        return (
          <div
            key={thread.id}
            class={`${styles.threadItem} ${isActive ? styles.threadItemActive : ''} ${hasUnread ? styles.threadItemUnread : ''}`}
            onClick={() => onSelectThread(thread.id)}
          >
            <div class={styles.threadItemHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, overflow: 'hidden' }}>
                <span class={styles.threadParticipant}>{participantName}</span>
                {badge && <span class={`${styles.typeBadge} ${badge.className}`}>{badge.label}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {hasUnread && <span class={styles.unreadBadge}>{thread.unreadCount}</span>}
                <span class={styles.threadDate}>{formatDate(thread.lastMessageAt, t, locale)}</span>
              </div>
            </div>
            <div class={styles.threadSubject}>{thread.subject}</div>
            <div class={styles.threadPreview}>{thread.lastMessagePreview}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// THREAD VIEW COMPONENT
// ============================================================================

interface ThreadViewProps {
  onBack: () => void;
  t: (key: string) => string;
  locale: string;
}

function ThreadView({ onBack, t, locale }: ThreadViewProps) {
  const thread = selectedThread.value;
  const loading = selectedThreadLoading.value;
  const sending = replyLoading.value;
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  if (loading) {
    return <div class={styles.loading}>{t('messages.loading')}</div>;
  }

  if (!thread) {
    return (
      <div class={styles.emptyState}>
        <div class={styles.emptyIcon}>📬</div>
        <div>{t('messages.selectThread')}</div>
      </div>
    );
  }

  const handleSendReply = async (e: Event) => {
    e.preventDefault();
    if (!replyText.trim() || sending) return;

    const success = await sendReply(replyText.trim());
    if (success) {
      setReplyText('');
    }
  };

  const handleAcceptInvitation = async () => {
    if (!thread.linkedInvitationId || actionLoading) return;
    setActionLoading(true);
    try {
      await acceptInvitation(thread.linkedInvitationId);
      // Reload thread to update status
      selectThread(thread.id);
    } catch (error: any) {
      console.error('Failed to accept invitation:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineInvitation = async () => {
    if (!thread.linkedInvitationId || actionLoading) return;
    setActionLoading(true);
    try {
      await declineInvitation(thread.linkedInvitationId);
      // Reload thread to update status
      selectThread(thread.id);
    } catch (error: any) {
      console.error('Failed to decline invitation:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const participants = thread.participants.map(p => p.displayName).join(', ');
  const canReply = thread.type !== 'GUILD_KICK' && thread.type !== 'SYSTEM' && thread.type !== 'GUILD_INVITE';

  return (
    <div class={styles.threadView}>
      <div class={styles.threadViewHeader}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button class={styles.backBtn} onClick={onBack} aria-label={t('messages.back')}>
            ←
          </button>
          <div>
            <h3 class={styles.threadViewSubject}>{thread.subject}</h3>
            <div class={styles.threadViewParticipants}>{participants}</div>
          </div>
        </div>
      </div>

      <div class={styles.messagesContainer}>
        {thread.messages.map((msg) => {
          const isSent = msg.senderId !== null && msg.senderId === localStorage.getItem('userId');
          const isSystem = msg.senderId === null;

          return (
            <div
              key={msg.id}
              class={`${styles.messageBubble} ${
                isSystem
                  ? styles.messageBubbleSystem
                  : isSent
                    ? styles.messageBubbleSent
                    : styles.messageBubbleReceived
              }`}
            >
              {!isSystem && !isSent && (
                <div class={styles.messageSender}>{msg.senderName}</div>
              )}
              <div class={styles.messageContent}>{renderMessageContent(msg.content)}</div>
              <div class={styles.messageTime}>{formatDate(msg.createdAt, t, locale)}</div>
            </div>
          );
        })}

        {/* Guild invite actions */}
        {thread.type === 'GUILD_INVITE' && thread.canAcceptInvitation && (
          <div class={styles.guildActions}>
            <button
              class={styles.acceptBtn}
              onClick={handleAcceptInvitation}
              disabled={actionLoading}
            >
              {t('buttons.accept')}
            </button>
            <button
              class={styles.declineBtn}
              onClick={handleDeclineInvitation}
              disabled={actionLoading}
            >
              {t('buttons.decline')}
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {canReply && (
        <div class={styles.replyArea}>
          <form class={styles.replyForm} onSubmit={handleSendReply}>
            <textarea
              class={styles.replyInput}
              placeholder={t('messages.writeMessage')}
              value={replyText}
              onInput={(e) => setReplyText((e.target as HTMLTextAreaElement).value)}
              disabled={sending}
              rows={1}
            />
            <button
              type="submit"
              class={styles.sendBtn}
              disabled={!replyText.trim() || sending}
            >
              {sending ? '...' : t('messages.send')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSE MODAL COMPONENT
// ============================================================================

interface ComposeModalProps {
  t: (key: string) => string;
}

function ComposeModal({ t }: ComposeModalProps) {
  const loading = composeLoading.value;
  const [recipients, setRecipients] = useState<UserSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Search users as they type
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await searchUsers(searchQuery);
        // Filter out already selected users
        const filtered = response.users.filter(
          u => !recipients.find(r => r.id === u.id)
        );
        setSearchResults(filtered);
        setShowResults(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [searchQuery, recipients]);

  const handleAddRecipient = (user: UserSearchResult) => {
    if (recipients.length >= 9) {
      setError(t('messages.compose.maxRecipients'));
      return;
    }
    setRecipients([...recipients, user]);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  const handleRemoveRecipient = (userId: string) => {
    setRecipients(recipients.filter(r => r.id !== userId));
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);

    if (recipients.length === 0) {
      setError(t('messages.compose.selectRecipient'));
      return;
    }
    if (!subject.trim()) {
      setError(t('messages.compose.subjectRequired'));
      return;
    }
    if (!content.trim()) {
      setError(t('messages.compose.contentRequired'));
      return;
    }

    const success = await sendNewMessage(
      recipients.map(r => r.username),
      subject.trim(),
      content.trim()
    );

    if (!success) {
      setError(messagesError.value || t('messages.compose.sendError'));
    }
  };

  if (!showComposeModal.value) return null;

  return (
    <div class={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeComposeModal()}>
      <div class={styles.composeModal}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>{t('messages.compose.title')}</h2>

        <form class={styles.composeForm} onSubmit={handleSubmit}>
          <div class={styles.formGroup}>
            <label class={styles.formLabel}>{t('messages.compose.to')}</label>
            <div class={styles.userSearch}>
              <input
                type="text"
                class={styles.formInput}
                placeholder={t('messages.compose.searchUser')}
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                onFocus={() => searchResults.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
              />
              {showResults && searchResults.length > 0 && (
                <div class={styles.userSearchResults}>
                  {searchResults.map(user => (
                    <div
                      key={user.id}
                      class={styles.userSearchItem}
                      onClick={() => handleAddRecipient(user)}
                    >
                      <div class={styles.userSearchName}>{user.displayName}</div>
                      <div class={styles.userSearchUsername}>@{user.username}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {recipients.length > 0 && (
              <div class={styles.recipientTags}>
                {recipients.map(r => (
                  <span key={r.id} class={styles.recipientTag}>
                    {r.displayName}
                    <span
                      class={styles.recipientTagRemove}
                      onClick={() => handleRemoveRecipient(r.id)}
                    >
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div class={styles.formGroup}>
            <label class={styles.formLabel}>{t('messages.compose.subject')}</label>
            <input
              type="text"
              class={styles.formInput}
              placeholder={t('messages.compose.subjectPlaceholder')}
              value={subject}
              onInput={(e) => setSubject((e.target as HTMLInputElement).value)}
              maxLength={100}
            />
          </div>

          <div class={styles.formGroup}>
            <label class={styles.formLabel}>{t('messages.compose.content')}</label>
            <textarea
              class={styles.formTextarea}
              placeholder={t('messages.compose.contentPlaceholder')}
              value={content}
              onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
              maxLength={2000}
            />
          </div>

          {error && <div class={styles.error}>{error}</div>}

          <div class={styles.formButtons}>
            <button
              type="button"
              class={styles.cancelBtn}
              onClick={() => closeComposeModal()}
              disabled={loading}
            >
              {t('messages.compose.cancel')}
            </button>
            <button
              type="submit"
              class={styles.sendBtn}
              disabled={loading}
            >
              {loading ? t('messages.compose.sending') : t('messages.compose.send')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MessagesModal() {
  const { t, i18n } = useTranslation('common');
  const locale = i18n.language === 'pl' ? 'pl-PL' : 'en-US';
  const visible = showMessagesModal.value;
  const activeTab = messagesActiveTab.value;
  const counts = unreadCounts.value;
  const error = messagesError.value;
  const [mobileShowThread, setMobileShowThread] = useState(false);

  if (!visible) return null;

  const tabs = [
    { id: 'all' as const, labelKey: 'messages.tabs.all', count: counts.total },
    { id: 'private' as const, labelKey: 'messages.tabs.private', count: counts.private },
    { id: 'system' as const, labelKey: 'messages.tabs.system', count: counts.system },
    { id: 'guild' as const, labelKey: 'messages.tabs.guild', count: counts.guild },
  ];

  const handleSelectThread = (id: string) => {
    selectThread(id);
    setMobileShowThread(true);
  };

  const handleBack = () => {
    setMobileShowThread(false);
  };

  return (
    <div class={styles.overlay} onClick={(e) => e.target === e.currentTarget && closeMessagesModal()}>
      <div class={styles.modal}>
        <div class={styles.header}>
          <h2 class={styles.title}>
            <span>{t('messages.title')}</span>
            {counts.total > 0 && (
              <span class={styles.tabBadge}>{counts.total > 99 ? '99+' : counts.total}</span>
            )}
          </h2>
          <button class={styles.closeBtn} onClick={closeMessagesModal} aria-label={t('messages.close')}>
            ×
          </button>
        </div>

        <div class={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              class={`${styles.tabBtn} ${activeTab === tab.id ? styles.activeTab : ''}`}
              onClick={() => setMessagesTab(tab.id)}
            >
              {t(tab.labelKey)}
              {tab.count > 0 && <span class={styles.tabBadge}>{tab.count > 99 ? '99+' : tab.count}</span>}
            </button>
          ))}
        </div>

        {error && <div class={styles.error}>{error}</div>}

        <div class={styles.content}>
          <div class={`${styles.threadList} ${mobileShowThread ? styles.threadListHidden : ''}`}>
            <div class={styles.listHeader}>
              <span style={{ color: 'var(--color-text-dim)', fontSize: '0.85rem' }}>
                {t('messages.threads')}
              </span>
              <button class={styles.composeBtn} onClick={() => openComposeModal()}>
                {t('messages.newMessage')}
              </button>
            </div>
            <ThreadList onSelectThread={handleSelectThread} t={t} locale={locale} />
          </div>

          <div class={`${styles.threadView} ${mobileShowThread ? styles.threadViewFull : ''}`}>
            <ThreadView onBack={handleBack} t={t} locale={locale} />
          </div>
        </div>
      </div>

      <ComposeModal t={t} />
    </div>
  );
}

export default MessagesModal;
