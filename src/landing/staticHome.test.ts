import { staticHome } from './staticHome';

it('explains the app without JavaScript, links the policies and tells how Google is used', () => {
  const { style, body } = staticHome();

  expect(body).toContain('<h1>WebWallet — Money, investments and taxes in one place</h1>');
  expect(body).toContain('<h2>Features</h2>');
  expect(body).toContain('<h2>Sign-in with Google</h2>');
  expect(body).toContain('never used to train or run AI models');
  expect(body).toContain('href="/privacy"');
  expect(body).toContain('href="/terms"');
  expect(body).not.toContain('<script');
  // Hidden for browsers that have signed in before, see /boot.js
  expect(style).toContain('html.ww-returning .ww-static');
});

it('builds the Ukrainian home with links to the Ukrainian policies and back to English', () => {
  const { body } = staticHome('uk');

  expect(body).toContain('<div class="ww-static" lang="uk">');
  expect(body).toContain('<h1>WebWallet — Гроші, інвестиції та податки — в одному місці</h1>');
  expect(body).toContain('href="/uk/privacy"');
  expect(body).toContain('href="/uk/terms"');
  expect(body).toContain('<a href="/" hreflang="en">English</a>');
  expect(staticHome('en').body).toContain('<a href="/uk/" hreflang="uk">Українською</a>');
});
