/**
 * Guild Chat Tab - Guild chat messages (visible only to members)
 */
import { useState, useEffect, useRef } from 'preact/hooks';
import type { GuildChatMessage } from '@arcade/protocol';
import {
  playerGuild,
  guildChatMessages,
  guildChatLoading,
  guildChatTotal,
  guildChatHasMore,
} from '../../state/guild.signals.js';
import { sendGuildMessage, getGuildMessages } from '../../api/guild.js';
import { onWebSocketEvent } from '../../api/websocket.js';
import { Button } from '../shared/Button.js';
import styles from './GuildPanel.module.css';

export function GuildChatTab() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const guild = playerGuild.value;
  const messages = guildChatMessages.value;
  const loading = guildChatLoading.value;
  const hasMore = guildChatHasMore.value;

  // Load messages on mount
  useEffect(() => {
    if (guild) {
      loadMessages();
    }
  }, [guild?.id]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Subscribe to WebSocket events for real-time updates
  useEffect(() => {
    if (!guild) return;

    const unsubscribe = onWebSocketEvent<{ guildId: string; message: GuildChatMessage }>(
      'guild:chat:message',
      (data) => {
        // Only add message if it's for this guild
        if (data.guildId === guild.id) {
          // Check if message already exists (avoid duplicates)
          const exists = guildChatMessages.value.some(m => m.id === data.message.id);
          if (!exists) {
            guildChatMessages.value = [...guildChatMessages.value, data.message];
          }
        }
      }
    );

    return unsubscribe;
  }, [guild?.id]);

  const loadMessages = async () => {
    if (!guild) return;

    guildChatLoading.value = true;
    try {
      const result = await getGuildMessages(guild.id, { limit: 50, offset: 0 });
      guildChatMessages.value = result.messages;
      guildChatTotal.value = result.total;
      guildChatHasMore.value = result.hasMore;
    } catch (error) {
      console.error('Failed to load chat messages:', error);
    } finally {
      guildChatLoading.value = false;
    }
  };

  const loadMoreMessages = async () => {
    if (!guild || !hasMore || loading) return;

    guildChatLoading.value = true;
    try {
      const result = await getGuildMessages(guild.id, {
        limit: 50,
        offset: messages.length,
      });
      // Prepend older messages
      guildChatMessages.value = [...result.messages, ...messages];
      guildChatHasMore.value = result.hasMore;
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      guildChatLoading.value = false;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: Event) => {
    e.preventDefault();
    if (!guild || !message.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const result = await sendGuildMessage(guild.id, message.trim());
      // Message will be added via WebSocket, but add it immediately for instant feedback
      guildChatMessages.value = [...guildChatMessages.value, result.message];
      setMessage('');
      scrollToBottom();
    } catch (err: any) {
      setError(err.message || 'Nie udało się wysłać wiadomości');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Teraz';
    if (diffMins < 60) return `${diffMins} min temu`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} godz. temu`;
    return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!guild) return null;

  return (
    <div class={styles.chatSection}>
      <div class={styles.sectionHeader}>
        <span class={styles.sectionTitle}>Chat gildii</span>
      </div>

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        class={styles.chatMessages}
        style={{
          height: '400px',
          overflowY: 'auto',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      >
        {loading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Ładowanie wiadomości...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Brak wiadomości. Napisz pierwszą wiadomość!
          </div>
        ) : (
          <>
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMoreMessages}
                disabled={loading}
                style={{ alignSelf: 'center' }}
              >
                {loading ? 'Ładowanie...' : 'Załaduj starsze'}
              </Button>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                class={styles.chatMessage}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                    {msg.senderName}
                  </span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <div style={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{ color: 'var(--color-error)', padding: '0.5rem', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      {/* Message input */}
      <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          type="text"
          value={message}
          onInput={(e) => setMessage((e.target as HTMLInputElement).value)}
          placeholder="Napisz wiadomość..."
          maxLength={500}
          disabled={sending}
          style={{
            flex: 1,
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg)',
            color: 'var(--color-text)',
          }}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!message.trim() || sending}
        >
          {sending ? 'Wysyłanie...' : 'Wyślij'}
        </Button>
      </form>
    </div>
  );
}
