import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { components } from '../api/schema';
import { bodyOf, json, mockApi, renderApp, signedInApi, user } from '../test/render';

type Status = components['schemas']['TelegramStatus'];

const settings = {
  hour: 9,
  recurring: true,
  budgets: true,
  taxes: true,
  banks: true,
  forecast: true,
  goals: true,
  weekly: true,
  monthly: true,
};

const notLinked: Status = {
  enabled: true,
  botUsername: 'WebWalletUaBot',
  linked: false,
  username: null,
  firstName: null,
  linkedAt: null,
  quickEntryAccountId: null,
};

const linked: Status = {
  ...notLinked,
  linked: true,
  username: 'olena_k',
  firstName: 'Олена',
  linkedAt: '2026-10-21T09:12:00Z',
};

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

it('connects Telegram by the link and notices when Start was pressed', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  let status = notLinked;
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/me': () => json({ ...user, hasPassword: false, twoFactorEnabled: false }),
    'GET /api/v1/telegram': () => json(status),
    'GET /api/v1/notifications/settings': () => json(settings),
    'POST /api/v1/telegram/link': () =>
      json({ url: 'https://t.me/WebWalletUaBot?start=code', expiresAt: inMinutes(15) }),
  });
  renderApp('/settings?tab=notifications');

  expect(await screen.findByText('Перемикачі запрацюють після підключення Telegram.')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Бюджети' })).toBeDisabled();

  await userEvent.click(await screen.findByRole('button', { name: 'Підключити Telegram' }));

  // Nothing to confirm without a password and two-factor authentication
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(open).toHaveBeenCalledWith('https://t.me/WebWalletUaBot?start=code', '_blank', 'noopener'),
  );
  expect(await bodyOf(requests, 'POST', '/api/v1/telegram/link')).toEqual({});
  expect(await screen.findByText(/Відкрийте бота @WebWalletUaBot/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Відкрити Telegram' })).toHaveAttribute(
    'href',
    'https://t.me/WebWalletUaBot?start=code',
  );

  status = linked;

  expect(await screen.findByText('Telegram підключено', {}, { timeout: 5000 })).toBeInTheDocument();
  expect(await screen.findByText(/Олена · @olena_k/)).toBeInTheDocument();
  open.mockRestore();
});

it('asks for the password before connecting Telegram', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/me': () => json({ ...user, hasPassword: true }),
    'GET /api/v1/telegram': () => json(notLinked),
    'GET /api/v1/notifications/settings': () => json(settings),
    'POST /api/v1/telegram/link': () =>
      json({ url: 'https://t.me/WebWalletUaBot?start=code', expiresAt: inMinutes(15) }),
  });
  renderApp('/settings?tab=notifications');

  await userEvent.click(await screen.findByRole('button', { name: 'Підключити Telegram' }));
  const dialog = await screen.findByRole('dialog', { name: 'Підтвердіть, що це ви' });
  await userEvent.type(within(dialog).getByLabelText('Поточний пароль'), 'secret-password');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Продовжити' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(open).toHaveBeenCalledWith('https://t.me/WebWalletUaBot?start=code', '_blank', 'noopener');
  expect(await bodyOf(requests, 'POST', '/api/v1/telegram/link')).toEqual({ password: 'secret-password' });
  expect(await screen.findByText(/Відкрийте бота @WebWalletUaBot/)).toBeInTheDocument();
  open.mockRestore();
});

it('saves a switch at once', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/telegram': () => json(linked),
    'GET /api/v1/notifications/settings': () => json(settings),
    'PUT /api/v1/notifications/settings': async (request) => json(await request.clone().json()),
  });
  renderApp('/settings?tab=notifications');

  await userEvent.click(await screen.findByRole('switch', { name: 'Тижневий аналіз' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/notifications/settings')).toEqual({
      ...settings,
      weekly: false,
    }),
  );
  expect(screen.getByRole('switch', { name: 'Тижневий аналіз' })).not.toBeChecked();
});

it('stops waiting for Start when the link expires', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/telegram': () => json(notLinked),
    'GET /api/v1/notifications/settings': () => json(settings),
    'POST /api/v1/telegram/link': () =>
      json({ url: 'https://t.me/WebWalletUaBot?start=code', expiresAt: inMinutes(0.02) }),
  });
  renderApp('/settings?tab=notifications');

  await userEvent.click(await screen.findByRole('button', { name: 'Підключити Telegram' }));

  expect(
    await screen.findByText('Посилання для підключення Telegram минуло. Створіть нове.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Підключити Telegram' })).toBeInTheDocument();
  expect(screen.queryByText(/Відкрийте бота @WebWalletUaBot/)).not.toBeInTheDocument();
  // No more checks once the link is gone
  const checks = requests.filter((request) => new URL(request.url).pathname === '/api/v1/telegram').length;
  await new Promise((resolve) => setTimeout(resolve, 3500));
  expect(requests.filter((request) => new URL(request.url).pathname === '/api/v1/telegram')).toHaveLength(
    checks,
  );
  open.mockRestore();
});

it('saves quick switches one after another and keeps the last state', async () => {
  const answers: (() => void)[] = [];
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/telegram': () => json(linked),
    'GET /api/v1/notifications/settings': () => json(settings),
    'PUT /api/v1/notifications/settings': async (request) => {
      const body: unknown = await request.clone().json();
      await new Promise<void>((resolve) => answers.push(resolve));
      return json(body);
    },
  });
  renderApp('/settings?tab=notifications');
  const puts = () => requests.filter((request) => request.method === 'PUT');

  await userEvent.click(await screen.findByRole('switch', { name: 'Тижневий аналіз' }));
  await userEvent.click(screen.getByRole('switch', { name: 'Підсумок місяця' }));

  // The second save waits for the first one
  await waitFor(() => expect(answers).toHaveLength(1));
  expect(puts()).toHaveLength(1);
  answers[0]!();
  await waitFor(() => expect(answers).toHaveLength(2));
  expect(await puts()[1]!.clone().json()).toEqual({ ...settings, weekly: false, monthly: false });
  // The answer of the first save does not turn the second switch back on
  expect(screen.getByRole('switch', { name: 'Підсумок місяця' })).not.toBeChecked();
  answers[1]!();
  await waitFor(() => expect(screen.getByRole('switch', { name: 'Тижневий аналіз' })).not.toBeChecked());
  expect(screen.getByRole('switch', { name: 'Підсумок місяця' })).not.toBeChecked();
});

it('disconnects the chat', async () => {
  let status = linked;
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/telegram': () => json(status),
    'GET /api/v1/notifications/settings': () => json(settings),
    'DELETE /api/v1/telegram': () => {
      status = notLinked;
      return new Response(null, { status: 204 });
    },
  });
  renderApp('/settings?tab=notifications');

  await userEvent.click(await screen.findByRole('button', { name: 'Відключити' }));

  expect(await screen.findByRole('button', { name: 'Підключити Telegram' })).toBeInTheDocument();
  expect(requests.some((request) => request.method === 'DELETE')).toBe(true);
});
