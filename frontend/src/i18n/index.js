import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fa from './locales/fa.json';
import hi from './locales/hi.json';

// Languages that use RTL text direction
export const RTL_LANGUAGES = ['fa', 'ar', 'ur'];

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧', dir: 'ltr' },
  { code: 'fa', label: 'فارسی',    flag: '🇮🇷', dir: 'rtl' },
  { code: 'hi', label: 'हिन्दी',    flag: '🇮🇳', dir: 'ltr' },
];

i18n
  .use(LanguageDetector)       // reads from localStorage / browser
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, fa: { translation: fa }, hi: { translation: hi } },
    fallbackLng: 'en',
    supportedLngs: ['en', 'fa', 'hi'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lms_language',
    },
    interpolation: { escapeValue: false },
  });

/**
 * Apply RTL/LTR direction to the entire document.
 * Call this whenever language changes.
 */
export function applyLanguageDirection(langCode) {
  const isRTL = RTL_LANGUAGES.includes(langCode);
  document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', langCode);
  // Tailwind RTL: add/remove class for components that need it
  document.documentElement.classList.toggle('rtl', isRTL);
}

// Apply on load
applyLanguageDirection(i18n.language);

// Apply whenever language changes
i18n.on('languageChanged', applyLanguageDirection);

export default i18n;
