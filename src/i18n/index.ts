import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import uk from './uk.json';

export const languages = ['uk', 'en'] as const;
export type Language = (typeof languages)[number];

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
  resources: { uk: { translation: uk }, en: { translation: en } },
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
