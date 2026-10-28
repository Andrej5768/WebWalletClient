import { firstSentence, pagePath, seoHead, type PublicLanguage } from '../landing/seo';
import { privacy, terms, type LegalDocument } from './content';

// The legal pages are also built as plain HTML, so that they read without JavaScript: Google and other crawlers check
// the privacy policy that way. The reverse proxy serves /privacy and /terms from these files; the app shows the same
// text when it navigates there itself.

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const label: Record<PublicLanguage, string> = { en: 'English', uk: 'Українська' };

function section(document: LegalDocument, lang: string, id: string): string {
  const parts = document.sections.map((part) => {
    const paragraphs = (part.paragraphs ?? []).map((text) => `<p>${escape(text)}</p>`).join('');
    const items = part.items
      ? `<ul>${part.items.map((text) => `<li>${escape(text)}</li>`).join('')}</ul>`
      : '';
    return `<h2>${escape(part.title)}</h2>${paragraphs}${items}`;
  });
  return `<article lang="${lang}" id="${id}"><h1>${escape(document.title)}</h1><p class="updated">${escape(
    document.updated,
  )}</p><p>${escape(document.intro)}</p>${parts.join('')}</article>`;
}

/**
 * A complete page with both texts: at /privacy and /terms the English one first (these addresses are registered with
 * Google and keep their content), at /uk/privacy and /uk/terms the Ukrainian one first.
 */
export function legalPage(page: 'privacy' | 'terms', language: PublicLanguage = 'en'): string {
  const documents = page === 'privacy' ? privacy : terms;
  const main = documents[language];
  const second: PublicLanguage = language === 'en' ? 'uk' : 'en';
  const otherPage = page === 'privacy' ? '/terms' : '/privacy';
  const otherLabel = (page === 'privacy' ? terms : privacy)[language].title;
  const home = pagePath('/', language);
  const title = `${main.title} — WebWallet`;
  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<title>${escape(title)}</title>
<meta name="description" content="${escape(firstSentence(main.intro))}" />
${seoHead(`/${page}`, language, title, firstSentence(main.intro))}
<style>
:root { color-scheme: light dark; --bg: #fafafa; --text: #18181b; --muted: #52525b; --border: #e4e4e7; --link: #0d52a8; }
@media (prefers-color-scheme: dark) { :root { --bg: #2b2b2b; --text: #e6e6e6; --muted: #ababab; --border: #45484a; --link: #7aaef2; } }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; }
header, footer { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; }
header { margin-bottom: 24px; }
footer { border-top: 1px solid var(--border); padding-top: 16px; margin-top: 48px; font-size: 14px; }
a { color: var(--link); }
.brand { font-weight: 600; color: var(--text); text-decoration: none; }
h1 { font-size: 30px; line-height: 1.2; margin: 0 0 4px; }
h2 { font-size: 19px; margin: 28px 0 8px; }
.updated { color: var(--muted); font-size: 14px; margin-top: 0; }
article + article { border-top: 1px solid var(--border); margin-top: 48px; padding-top: 32px; }
</style>
</head>
<body>
<main>
<header><a class="brand" href="${home}">WebWallet</a><nav><a href="#${language}">${label[language]}</a> · <a href="#${second}">${label[second]}</a></nav></header>
${section(main, language, language)}
${section(documents[second], second, second)}
<footer><a href="${home}">WebWallet</a><a href="${pagePath(otherPage, language)}">${escape(otherLabel)}</a></footer>
</main>
</body>
</html>
`;
}
