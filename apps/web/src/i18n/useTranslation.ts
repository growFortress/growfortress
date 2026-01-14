import { signal } from '@preact/signals';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import i18n, { type SupportedLanguage, SUPPORTED_LANGUAGES } from './index.js';

// Reactive language signal
const storedLang = typeof localStorage !== 'undefined'
  ? localStorage.getItem('gf-language') as SupportedLanguage | null
  : null;

export const currentLanguage = signal<SupportedLanguage>(
  storedLang && SUPPORTED_LANGUAGES.includes(storedLang) ? storedLang : 'en'
);

// Change language with persistence
export function setLanguage(lng: SupportedLanguage): void {
  currentLanguage.value = lng;
  localStorage.setItem('gf-language', lng);
  i18n.changeLanguage(lng);
}

// Custom hook that works with signals and forces re-render on language change
export function useTranslation(ns?: string | string[]) {
  const { t, i18n: instance } = useI18nTranslation(ns);

  // Access signal to subscribe to language changes
  const lang = currentLanguage.value;

  return { t, i18n: instance, language: lang };
}

// Re-export Trans component for JSX interpolation
export { Trans } from 'react-i18next';
