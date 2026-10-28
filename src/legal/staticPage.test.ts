import { legalPage } from './staticPage';

it('builds the privacy policy as plain HTML in both languages', () => {
  const html = legalPage('privacy');

  expect(html).toMatch(/^<!doctype html>/);
  expect(html).toContain('<h1>Privacy policy</h1>');
  expect(html).toContain('<h1>Політика конфіденційності</h1>');
  expect(html).toContain('<h2>Data we receive from Google</h2>');
  expect(html).toContain('Google API Services User Data Policy, including the Limited Use requirements');
  expect(html).toContain('href="/terms"');
  expect(html).not.toContain('<script');
});

it('escapes the text of the terms', () => {
  const html = legalPage('terms');

  expect(html).toContain('<h1>Terms of service</h1>');
  expect(html).toContain('&quot;as is&quot;');
});

it('puts the Ukrainian text first under /uk/ and keeps the English page as it was', () => {
  const html = legalPage('terms', 'uk');

  expect(html).toContain('<html lang="uk">');
  expect(html.indexOf('<h1>Умови використання</h1>')).toBeLessThan(html.indexOf('<h1>Terms of service</h1>'));
  expect(html).toContain('<link rel="canonical" href="https://wallet.andrew-dev.org/uk/terms" />');
  expect(html).toContain('href="/uk/privacy"');
  expect(html).toContain('<a class="brand" href="/uk/">');

  const english = legalPage('terms');
  expect(english).toContain('<html lang="en">');
  expect(english).toContain('<link rel="canonical" href="https://wallet.andrew-dev.org/terms" />');
  expect(english).toContain('hreflang="uk" href="https://wallet.andrew-dev.org/uk/terms"');
  expect(english.indexOf('<h1>Terms of service</h1>')).toBeLessThan(
    english.indexOf('<h1>Умови використання</h1>'),
  );
});
