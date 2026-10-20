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
