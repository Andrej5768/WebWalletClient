import { pagePath, type PublicLanguage } from './seo';
import en from './locales/en.json';
import uk from './locales/uk.json';

// The home page as plain HTML inside index.html (English) and uk/index.html (Ukrainian): crawlers that run no
// JavaScript (the Google OAuth verification among them) read what the app is about without signing in. The app
// replaces it when it starts; /boot.js hides it right away for people who have signed in before, so they do not see
// it flash.

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** What the landing texts do not hold: the summary for crawlers and the links of the footer. */
const extra = {
  en: {
    about: (privacy: string, terms: string) =>
      `WebWallet is a personal finance web app: you keep your accounts, transactions, budget, investments and Ukrainian taxes in one place and see reports and plans built from your own data. Signing in is needed only to work with your own data; this page and the <a href="${privacy}">privacy policy</a> and <a href="${terms}">terms of service</a> are open to everyone.`,
    privacy: 'Privacy policy',
    terms: 'Terms of service',
    other: 'Українською',
  },
  uk: {
    about: (privacy: string, terms: string) =>
      `WebWallet — вебзастосунок для особистих фінансів: рахунки, операції, бюджет, інвестиції й українські податки в одному місці, а звіти й плани будуються з ваших власних даних. Вхід потрібен лише для роботи з вашими даними; ця сторінка, <a href="${privacy}">політика конфіденційності</a> та <a href="${terms}">умови використання</a> відкриті для всіх.`,
    privacy: 'Політика конфіденційності',
    terms: 'Умови використання',
    other: 'English',
  },
} as const;

const card = (title: string, text: string) => `<li><h3>${escape(title)}</h3><p>${escape(text)}</p></li>`;

const STYLE = `<style>
html.ww-returning .ww-static { display: none; }
.ww-static { max-width: 960px; margin: 0 auto; padding: 24px 20px 64px; font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #18181b; }
.ww-static a { color: #0d52a8; }
.ww-static header, .ww-static footer { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; }
.ww-static h1 { font-size: 40px; line-height: 1.1; margin: 48px 0 16px; }
.ww-static h2 { font-size: 26px; margin: 48px 0 8px; }
.ww-static h3 { font-size: 17px; margin: 0 0 4px; }
.ww-static ul.cards { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.ww-static ul.cards li { border: 1px solid #e4e4e7; border-radius: 10px; padding: 16px; }
.ww-static .lead { font-size: 19px; color: #52525b; }
.ww-static footer { border-top: 1px solid #e4e4e7; margin-top: 48px; padding-top: 16px; font-size: 14px; }
@media (prefers-color-scheme: dark) {
  .ww-static { color: #e6e6e6; } .ww-static a { color: #7aaef2; } .ww-static .lead { color: #ababab; }
  .ww-static ul.cards li, .ww-static footer { border-color: #45484a; }
}
</style>`;

/** The markup to put inside the root element of index.html, and its style for the head. */
export function staticHome(language: PublicLanguage = 'en'): { style: string; body: string } {
  const l = (language === 'en' ? en : uk).landing;
  const x = extra[language];
  const privacy = pagePath('/privacy', language);
  const terms = pagePath('/terms', language);
  const other = pagePath('/', language === 'en' ? 'uk' : 'en');
  const features = [
    'sync',
    'categories',
    'envelopes',
    'planning',
    'reports',
    'investments',
    'taxes',
    'privacy',
  ] as const;
  const audience = ['banks', 'investors', 'fop'] as const;
  const steps = ['tracking', 'fym', 'compound', 'fire'] as const;
  const body = `<div class="ww-static" lang="${language}">
<header><strong>WebWallet</strong><nav><a href="/login">${escape(l.signIn)}</a> · <a href="/register">${escape(l.register)}</a> · <a href="${other}" hreflang="${language === 'en' ? 'uk' : 'en'}">${x.other}</a></nav></header>
<main>
<h1>WebWallet — ${escape(l.hero.title)}</h1>
<p class="lead">${escape(l.hero.text)}</p>
<p>${x.about(privacy, terms)}</p>
<h2>${escape(l.audience.title)}</h2>
<p>${escape(l.audience.text)}</p>
<ul class="cards">${audience.map((key) => card(l.audience[key].title, l.audience[key].text)).join('')}</ul>
<h2>${escape(l.features.title)}</h2>
<p>${escape(l.features.text)}</p>
<ul class="cards">${features.map((key) => card(l.features[key].title, l.features[key].text)).join('')}</ul>
<h2>${escape(l.independence.title)}</h2>
<p>${escape(l.independence.text1)}</p>
<p>${escape(l.independence.text2)}</p>
<ul class="cards">${steps.map((key) => card(l.independence.steps[key].title, l.independence.steps[key].text)).join('')}</ul>
<h2>${escape(l.google.title)}</h2>
<p>${escape(l.google.text)}</p>
<h2>${escape(l.source.title)}</h2>
<p>${escape(l.source.text)}</p>
<p>${escape(l.source.license)}</p>
</main>
<footer><span>© 2026 WebWallet · ${escape(l.footer)}</span><nav><a href="${privacy}">${x.privacy}</a> · <a href="${terms}">${x.terms}</a> · <a href="mailto:support@andrew-dev.org">support@andrew-dev.org</a></nav></footer>
</div>`;
  return { style: STYLE, body };
}
