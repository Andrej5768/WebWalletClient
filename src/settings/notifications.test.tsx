import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { components } from '../api/schema';
import { bodyOf, json, mockApi, renderApp, signedInApi } from '../test/render';

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

it('connects Telegram by the link and notices when Start was pressed', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null);
  let status = notLinked;
  mockApi({
    ...signedInApi,
    'GET /api/v1/telegram': () => json(status),
    'GET /api/v1/notifications/settings': () => json(settings),
    'POST /api/v1/telegram/link': () =>
      json({ url: 'https://t.me/WebWalletUaBot?start=code', expiresAt: '2026-10-21T09:27:00Z' }),
  });
  renderApp('/settings?tab=notifications');

  expect(await screen.findByText('Перемикачі запрацюють після підключення Telegram.')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Бюджети' })).toBeDisabled();

  await userEvent.click(await screen.findByRole('button', { name: 'Підключити Telegram' }));

  expect(open).toHaveBeenCalledWith('https://t.me/WebWalletUaBot?start=code', '_blank', 'noopener');
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
