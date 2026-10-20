import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import goalsEn from '../goals/locales/en.json';
import goalsUk from '../goals/locales/uk.json';
import importsEn from '../imports/locales/en.json';
import importsUk from '../imports/locales/uk.json';
import investmentsEn from '../investments/locales/en.json';
import investmentsUk from '../investments/locales/uk.json';
import invOverviewEn from '../investments/overview/locales/en.json';
import invOverviewUk from '../investments/overview/locales/uk.json';
import invPositionsEn from '../investments/positions/locales/en.json';
import invPositionsUk from '../investments/positions/locales/uk.json';
import invDividendsEn from '../investments/dividends/locales/en.json';
import invDividendsUk from '../investments/dividends/locales/uk.json';
import invInstrumentEn from '../investments/instrument/locales/en.json';
import invInstrumentUk from '../investments/instrument/locales/uk.json';
import invOperationsEn from '../investments/operations/locales/en.json';
import invOperationsUk from '../investments/operations/locales/uk.json';
import landingEn from '../landing/locales/en.json';
import landingUk from '../landing/locales/uk.json';
import recurringEn from '../recurring/locales/en.json';
import recurringUk from '../recurring/locales/uk.json';
import reportsEn from '../reports/locales/en.json';
import reportsUk from '../reports/locales/uk.json';
import settingsEn from '../settings/locales/en.json';
import taxesEn from '../taxes/locales/en.json';
import taxesUk from '../taxes/locales/uk.json';
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
    // Storage can be unavailable (private mode); then the language of the browser decides.
  }
  // Ukrainian for Ukrainian browsers, English for the rest of the world
  const browser = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  return browser.some((language) => language?.toLowerCase().startsWith('uk')) ? 'uk' : 'en';
}

void i18n.use(initReactI18next).init({
  // Feature folders keep their own strings; they are merged into one namespace.
  resources: {
    uk: {
      translation: {
        ...uk,
        ...settingsUk,
        ...importsUk,
        ...goalsUk,
        ...reportsUk,
        ...recurringUk,
        ...investmentsUk,
        ...invOverviewUk,
        ...invPositionsUk,
        ...invDividendsUk,
        ...invInstrumentUk,
        ...invOperationsUk,
        ...taxesUk,
        ...landingUk,
      },
    },
    en: {
      translation: {
        ...en,
        ...settingsEn,
        ...importsEn,
        ...goalsEn,
        ...reportsEn,
        ...recurringEn,
        ...investmentsEn,
        ...invOverviewEn,
        ...invPositionsEn,
        ...invDividendsEn,
        ...invInstrumentEn,
        ...invOperationsEn,
        ...taxesEn,
        ...landingEn,
      },
    },
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
