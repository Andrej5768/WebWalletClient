import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test/render';

const signedOut = { 'POST /api/v1/auth/refresh': () => json({ code: 'INVALID_REFRESH_TOKEN' }, 401) };

it('shows the privacy policy to anyone and switches the language', async () => {
  mockApi(signedOut);
  renderApp('/privacy');

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Політика конфіденційності' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Cookie та сховище браузера' })).toBeInTheDocument();
  expect(screen.getByText(/support@andrew-dev\.org/)).toBeInTheDocument();

  await userEvent.click(screen.getByText('ENG'));
  expect(await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument();
});

it('links the terms from the home page and the registration form', async () => {
  mockApi(signedOut);
  renderApp('/');

  await userEvent.click(await screen.findByRole('link', { name: 'Умови використання' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Умови використання' })).toBeInTheDocument();

  await userEvent.click(screen.getByRole('link', { name: 'Конфіденційність' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Політика конфіденційності' }),
  ).toBeInTheDocument();
});

it('mentions the terms and the policy under the registration form', async () => {
  mockApi(signedOut);
  renderApp('/register');

  expect(await screen.findByRole('link', { name: 'умовами використання' })).toHaveAttribute('href', '/terms');
  expect(screen.getByRole('link', { name: 'політикою конфіденційності' })).toHaveAttribute(
    'href',
    '/privacy',
  );
});
