// The public pages that search engines index, in English and Ukrainian, and the markup that tells them apart:
// language, canonical address, the pair of each page in the other language, a description and the link preview.
// The English address is also the default for every other language (x-default) and keeps showing the language a
// visitor chose before; the /uk/ address is always Ukrainian. The build writes these pages as plain HTML.

export const SITE = 'https://wallet.andrew-dev.org';

export type PublicLanguage = 'en' | 'uk';

/** The English addresses of the public pages; /privacy and /terms are registered with Google and must not move. */
export const PUBLIC_PAGES = ['/', '/privacy', '/terms'] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** Where a public page lives in a language: `/terms` in Ukrainian is `/uk/terms`, the home page is `/uk/`. */
export function pagePath(page: PublicPage, language: PublicLanguage): string {
  if (language === 'en') return page;
  return page === '/' ? '/uk/' : `/uk${page}`;
}

/** The Ukrainian address prefix of the public pages, without the trailing slash. */
export const UK_PREFIX = '/uk';

/** Whether a path of the app is one of the Ukrainian public pages. */
export function isUkrainianPath(pathname: string): boolean {
  return pathname === UK_PREFIX || pathname.startsWith(`${UK_PREFIX}/`);
}

/** The same page without the Ukrainian prefix: `/uk/terms` → `/terms`, `/uk/` → `/`. */
export function withoutUkrainianPrefix(pathname: string): string {
  return isUkrainianPath(pathname) ? pathname.slice(UK_PREFIX.length) || '/' : pathname;
}

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Tags for the head of a public page: canonical, both language versions, description and link preview. */
export function seoHead(
  page: PublicPage,
  language: PublicLanguage,
  title: string,
  description: string,
): string {
  const url = (lang: PublicLanguage) => SITE + pagePath(page, lang);
  const other: PublicLanguage = language === 'en' ? 'uk' : 'en';
  return [
    `<link rel="canonical" href="${url(language)}" />`,
    `<link rel="alternate" hreflang="en" href="${url('en')}" />`,
    `<link rel="alternate" hreflang="uk" href="${url('uk')}" />`,
    `<link rel="alternate" hreflang="x-default" href="${url('en')}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="WebWallet" />`,
    `<meta property="og:title" content="${escape(title)}" />`,
    `<meta property="og:description" content="${escape(description)}" />`,
    `<meta property="og:url" content="${url(language)}" />`,
    `<meta property="og:image" content="${SITE}/og-image.png" />`,
    `<meta property="og:locale" content="${language === 'en' ? 'en_US' : 'uk_UA'}" />`,
    `<meta property="og:locale:alternate" content="${other === 'en' ? 'en_US' : 'uk_UA'}" />`,
  ].join('\n');
}

/** The sitemap: every public page in both languages, each listing its pair. */
export function sitemap(lastModified: string): string {
  const entries = PUBLIC_PAGES.flatMap((page) =>
    (['en', 'uk'] as const).map(
      (language) => `  <url>
    <loc>${SITE}${pagePath(page, language)}</loc>
    <lastmod>${lastModified}</lastmod>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE}${pagePath(page, 'en')}" />
    <xhtml:link rel="alternate" hreflang="uk" href="${SITE}${pagePath(page, 'uk')}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${pagePath(page, 'en')}" />
  </url>`,
    ),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
}

export const robots = `User-agent: *
Disallow: /api/
Sitemap: ${SITE}/sitemap.xml
`;

/** The first sentence of a text, for a description. */
export function firstSentence(text: string): string {
  const match = /^.+?[.!?](?=\s|$)/.exec(text.trim());
  return match ? match[0] : text.trim();
}
