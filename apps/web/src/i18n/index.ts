import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Static imports for initial bundle (critical path)
import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enGame from '../locales/en/game.json';
import enModals from '../locales/en/modals.json';
import enData from '../locales/en/data.json';
import plCommon from '../locales/pl/common.json';
import plAuth from '../locales/pl/auth.json';
import plGame from '../locales/pl/game.json';
import plModals from '../locales/pl/modals.json';
import plData from '../locales/pl/data.json';

export const SUPPORTED_LANGUAGES = ['en', 'pl'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    game: enGame,
    modals: enModals,
    data: enData,
  },
  pl: {
    common: plCommon,
    auth: plAuth,
    game: plGame,
    modals: plModals,
    data: plData,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'game', 'modals', 'data'],

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'gf-language',
    },

    interpolation: {
      escapeValue: false, // Preact handles XSS
    },

    // Support lazy loading of additional namespaces
    partialBundledLanguages: true,
  });

// Lazy namespace loader for non-critical namespaces
export async function loadNamespace(ns: string): Promise<void> {
  const lng = i18n.language as SupportedLanguage;
  if (i18n.hasResourceBundle(lng, ns)) return;

  try {
    const resources = await import(`../locales/${lng}/${ns}.json`);
    i18n.addResourceBundle(lng, ns, resources.default, true, true);
  } catch (error) {
    console.warn(`Failed to load namespace ${ns} for language ${lng}`, error);
  }
}

export default i18n;
