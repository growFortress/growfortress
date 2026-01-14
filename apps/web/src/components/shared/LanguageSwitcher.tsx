import { currentLanguage, setLanguage } from '../../i18n/useTranslation.js';
import type { SupportedLanguage } from '../../i18n/index.js';
import styles from './LanguageSwitcher.module.css';

const LANGUAGES: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
];

export function LanguageSwitcher() {
  const current = currentLanguage.value;

  return (
    <div class={styles.switcher} role="group" aria-label="Language selection">
      {LANGUAGES.map(({ code, label, flag }) => (
        <button
          key={code}
          class={`${styles.langBtn} ${current === code ? styles.active : ''}`}
          onClick={() => setLanguage(code)}
          aria-pressed={current === code}
          aria-label={`Switch to ${label}`}
        >
          <span aria-hidden="true">{flag}</span>
          <span class={styles.langCode}>{code.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
}
