import { currentLanguage, setLanguage } from '../../i18n/useTranslation.js';
import type { SupportedLanguage } from '../../i18n/index.js';
import styles from './LanguageSwitcher.module.css';

const LANGUAGES: { code: SupportedLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pl', label: 'Polski' },
];

export function LanguageSwitcher() {
  const current = currentLanguage.value;

  return (
    <div class={styles.switcher} role="group" aria-label="Language selection">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          class={`${styles.langBtn} ${current === code ? styles.active : ''}`}
          onClick={() => setLanguage(code)}
          aria-pressed={current === code}
          aria-label={`Switch to ${label}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
