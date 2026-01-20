import { useEffect, useState } from 'preact/hooks';
import { signal } from '@preact/signals';

/**
 * Global signal for screen reader announcements.
 * Components can import and set this to announce messages.
 */
export const announcement = signal<{
  message: string;
  priority: 'polite' | 'assertive';
  id: number;
} | null>(null);

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

/**
 * Pre-defined game announcements for consistency
 */
export const GameAnnouncements = {
  waveComplete: (wave: number) => announce(`Fala ${wave} ukończona!`, 'polite'),
  waveStart: (wave: number) => announce(`Fala ${wave} rozpoczęta`, 'polite'),
  bossSpawn: (name: string) => announce(`Boss ${name} pojawił się!`, 'assertive'),
  bossDefeated: (name: string) => announce(`Boss ${name} pokonany!`, 'assertive'),
  gameOver: () => announce('Koniec gry. Twoja forteca została zniszczona.', 'assertive'),
  heroRecruited: (name: string) => announce(`Bohater ${name} dołączył do drużyny`, 'polite'),
  heroDefeated: (name: string) => announce(`Bohater ${name} został pokonany`, 'polite'),
  turretPlaced: (name: string) => announce(`Wieżyczka ${name} umieszczona`, 'polite'),
  turretDestroyed: (name: string) => announce(`Wieżyczka ${name} zniszczona`, 'polite'),
  levelUp: (level: number) => announce(`Awans na poziom ${level}!`, 'assertive'),
  choiceAvailable: () => announce('Wybór dostępny. Użyj klawiszy strzałek i Enter aby wybrać.', 'polite'),
  modalOpened: (title: string) => announce(`${title}. Naciśnij Escape aby zamknąć.`, 'polite'),
  modalClosed: () => announce('Okno zamknięte', 'polite'),
  rewardClaimed: () => announce('Nagroda odebrana', 'polite'),
  errorOccurred: (message: string) => announce(`Błąd: ${message}`, 'assertive'),
  loading: () => announce('Ładowanie...', 'polite'),
  loaded: () => announce('Załadowano', 'polite'),
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
