import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp } from '../test/render';

const signedOut = { 'POST /api/v1/auth/refresh': () => json({ code: 'INVALID_REFRESH_TOKEN' }, 401) };
const noContent = () => new Response(null, { status: 204 });

const queryOf = (requests: Request[], path: string) =>
  requests
    .filter((request) => request.method === 'POST' && new URL(request.url).pathname === path)
    .map((request) => Object.fromEntries(new URL(request.url).searchParams));

it('unsubscribes by the link of the email and subscribes again on the button', async () => {
  const requests = mockApi({
    ...signedOut,
    'POST /api/v1/notifications/unsubscribe': noContent,
    'POST /api/v1/notifications/resubscribe': noContent,
  });
  renderApp('/unsubscribe?user=7&token=abc123');

  expect(await screen.findByRole('heading', { name: 'Ви відписалися від дайджесту' })).toBeInTheDocument();
  expect(queryOf(requests, '/api/v1/notifications/unsubscribe')).toEqual([{ user: '7', token: 'abc123' }]);
  expect(screen.getByRole('link', { name: 'Налаштування сповіщень' })).toHaveAttribute(
    'href',
    '/settings?tab=notifications',
  );

  await userEvent.click(screen.getByRole('button', { name: 'Підписатися знову' }));

  expect(await screen.findByRole('heading', { name: 'Дайджест знову увімкнено' })).toBeInTheDocument();
  expect(screen.getByText('Наступний лист прийде в понеділок.')).toBeInTheDocument();
  expect(queryOf(requests, '/api/v1/notifications/resubscribe')).toEqual([{ user: '7', token: 'abc123' }]);
});

it('tells when the link is not valid', async () => {
  mockApi({
    ...signedOut,
    'POST /api/v1/notifications/unsubscribe': () => json({ code: 'NOT_FOUND' }, 404),
  });
  renderApp('/unsubscribe?user=7&token=forged');

  expect(await screen.findByRole('heading', { name: 'Посилання недійсне' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Налаштування сповіщень' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Підписатися знову' })).not.toBeInTheDocument();
});
