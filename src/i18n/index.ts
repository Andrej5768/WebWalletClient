import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import goalsEn from '../goals/locales/en.json';
import goalsUk from '../goals/locales/uk.json';
import importsEn from '../imports/locales/en.json';
import importsUk from '../imports/locales/uk.json';
import reportsEn from '../reports/locales/en.json';
import reportsUk from '../reports/locales/uk.json';
import settingsEn from '../settings/locales/en.json';
import settingsUk from '../settings/locales/uk.json';
import en from './en.json';
import uk from './uk.json';

type Language = 'uk' | 'en';

const storageKey = 'ww-language';

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'uk' || saved === 'en') return saved;
  } catch {
    // Storage can be unavailable (private mode); fall back to Ukrainian.
  }
  return 'uk';
}

void i18n.use(initReactI18next).init({
  // Feature folders keep their own strings; they are merged into one namespace.
  resources: {
    uk: { translation: { ...uk, ...settingsUk, ...importsUk, ...goalsUk, ...reportsUk } },
    en: { translation: { ...en, ...settingsEn, ...importsEn, ...goalsEn, ...reportsEn } },
  },
  lng: initialLanguage(),
  fallbackLng: 'uk',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
  try {
    localStorage.setItem(storageKey, language);
  } catch {
    // Not critical: the choice just will not survive a reload.
  }
});
document.documentElement.lang = i18n.language;

/** BCP 47 locale for number and date formatting of the current language. */
export function locale(language: string = i18n.language): string {
  return language === 'en' ? 'en-GB' : 'uk-UA';
}

export default i18n;
