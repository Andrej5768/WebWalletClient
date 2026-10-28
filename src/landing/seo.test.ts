import {
  firstSentence,
  isUkrainianPath,
  pagePath,
  robots,
  seoHead,
  sitemap,
  withoutUkrainianPrefix,
} from './seo';

it('keeps the English addresses and puts the Ukrainian ones under /uk/', () => {
  expect(['/', '/privacy', '/terms'].map((page) => pagePath(page as '/', 'en'))).toEqual([
    '/',
    '/privacy',
    '/terms',
  ]);
  expect(pagePath('/', 'uk')).toBe('/uk/');
  expect(pagePath('/terms', 'uk')).toBe('/uk/terms');
});

it('tells the Ukrainian public pages from the others', () => {
  expect(['/uk', '/uk/', '/uk/privacy', '/ukraine', '/budget'].map(isUkrainianPath)).toEqual([
    true,
    true,
    true,
    false,
    false,
  ]);
  expect(withoutUkrainianPrefix('/uk/terms')).toBe('/terms');
  expect(withoutUkrainianPrefix('/uk/')).toBe('/');
  expect(withoutUkrainianPrefix('/uk')).toBe('/');
});

it('links a page to itself and to its pair, with English as the default', () => {
  const head = seoHead('/privacy', 'uk', 'Політика — WebWallet', 'Опис');

  expect(head).toContain('<link rel="canonical" href="https://wallet.andrew-dev.org/uk/privacy" />');
  expect(head).toContain('hreflang="en" href="https://wallet.andrew-dev.org/privacy"');
  expect(head).toContain('hreflang="uk" href="https://wallet.andrew-dev.org/uk/privacy"');
  expect(head).toContain('hreflang="x-default" href="https://wallet.andrew-dev.org/privacy"');
  expect(head).toContain('<meta property="og:locale" content="uk_UA" />');
  expect(head).toContain('<meta property="og:image" content="https://wallet.andrew-dev.org/og-image.png" />');
});

it('lists every public page in both languages in the sitemap', () => {
  const xml = sitemap('2026-10-28');

  expect(xml.match(/<url>/g)).toHaveLength(6);
  for (const path of ['/', '/uk/', '/privacy', '/uk/privacy', '/terms', '/uk/terms']) {
    expect(xml).toContain(`<loc>https://wallet.andrew-dev.org${path}</loc>`);
  }
  expect(xml).toContain('<lastmod>2026-10-28</lastmod>');
  expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
});

it('opens everything but the API to crawlers and points them to the sitemap', () => {
  expect(robots).toContain('Disallow: /api/');
  expect(robots).toContain('Sitemap: https://wallet.andrew-dev.org/sitemap.xml');
});

it('takes the first sentence for a description', () => {
  expect(firstSentence('We keep little. We sell nothing.')).toBe('We keep little.');
  expect(firstSentence('No full stop')).toBe('No full stop');
});
