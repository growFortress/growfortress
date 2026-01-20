import { useEffect, useState } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';

/**
 * Global signal for screen reader announcements.
 * Components can import and set this to announce messages.
 */
export const announcement: Signal<{
  message: string;
  priority: 'polite' | 'assertive';
  id: number;
} | null> = signal(null);

let announcementId = 0;

/**
 * Announce a message to screen readers.
 *
 * @param message - The message to announce
 * @param priority - 'polite' waits for current speech, 'assertive' interrupts
 */
export function announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
  announcementId++;
  announcement.value = { message, priority, id: announcementId };
}

import i18n from '../../i18n/index.js';

/**
 * Pre-defined game announcements for consistency
 */
export const GameAnnouncements = {
  waveComplete: (wave: number) => announce(i18n.t('shared.announcements.waveComplete', { wave }), 'polite'),
  waveStart: (wave: number) => announce(i18n.t('shared.announcements.waveStart', { wave }), 'polite'),
  bossSpawn: (name: string) => announce(i18n.t('shared.announcements.bossSpawn', { name }), 'assertive'),
  bossDefeated: (name: string) => announce(i18n.t('shared.announcements.bossDefeated', { name }), 'assertive'),
  gameOver: () => announce(i18n.t('shared.announcements.gameOver'), 'assertive'),
  heroRecruited: (name: string) => announce(i18n.t('shared.announcements.heroRecruited', { name }), 'polite'),
  heroDefeated: (name: string) => announce(i18n.t('shared.announcements.heroDefeated', { name }), 'polite'),
  turretPlaced: (name: string) => announce(i18n.t('shared.announcements.turretPlaced', { name }), 'polite'),
  turretDestroyed: (name: string) => announce(i18n.t('shared.announcements.turretDestroyed', { name }), 'polite'),
  levelUp: (level: number) => announce(i18n.t('shared.announcements.levelUp', { level }), 'assertive'),
  choiceAvailable: () => announce(i18n.t('shared.announcements.choiceAvailable'), 'polite'),
  modalOpened: (title: string) => announce(i18n.t('shared.pressEscapeToClose', { title }), 'polite'),
  modalClosed: () => announce(i18n.t('shared.windowClosed'), 'polite'),
  rewardClaimed: () => announce(i18n.t('shared.announcements.rewardClaimed'), 'polite'),
  errorOccurred: (message: string) => announce(i18n.t('shared.announcements.errorOccurred', { message }), 'assertive'),
  loading: () => announce(i18n.t('shared.loading'), 'polite'),
  loaded: () => announce(i18n.t('shared.announcements.loaded'), 'polite'),
};

/**
 * Screen reader announcer component.
 * Renders an aria-live region that announces messages to screen readers.
 * Should be placed once at the root of your app.
 */
export function ScreenReaderAnnouncer() {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  useEffect(() => {
    const currentAnnouncement = announcement.value;
    if (!currentAnnouncement) return;

    const { message, priority } = currentAnnouncement;

    if (priority === 'assertive') {
      setAssertiveMessage(message);
      // Clear after a short delay so same message can be announced again
      const timer = setTimeout(() => setAssertiveMessage(''), 1000);
      return () => clearTimeout(timer);
    } else {
      setPoliteMessage(message);
      const timer = setTimeout(() => setPoliteMessage(''), 1000);
      return () => clearTimeout(timer);
    }
  }, [announcement.value?.id]);

  return (
    <>
      {/* Polite announcements - wait for current speech to finish */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        class="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {politeMessage}
      </div>

      {/* Assertive announcements - interrupt current speech */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        class="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {assertiveMessage}
      </div>
    </>
  );
}
