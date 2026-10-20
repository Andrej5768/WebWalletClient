import { privacy, terms, type LegalDocument } from './content';

// The legal pages are also built as plain HTML, so that they read without JavaScript: Google and other crawlers check
// the privacy policy that way. The reverse proxy serves /privacy and /terms from these files; the app shows the same
// text when it navigates there itself.

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

/** A complete page with the English text first and the Ukrainian one below. */
export function legalPage(page: 'privacy' | 'terms'): string {
  const documents = page === 'privacy' ? privacy : terms;
  const other =
    page === 'privacy'
      ? { href: '/terms', label: 'Terms of service' }
      : { href: '/privacy', label: 'Privacy policy' };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light dark" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<title>${escape(documents.en.title)} — WebWallet</title>
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
<header><a class="brand" href="/">WebWallet</a><nav><a href="#en">English</a> · <a href="#uk">Українська</a></nav></header>
${section(documents.en, 'en', 'en')}
${section(documents.uk, 'uk', 'uk')}
<footer><a href="/">WebWallet</a><a href="${other.href}">${other.label}</a></footer>
</main>
</body>
</html>
`;
}
