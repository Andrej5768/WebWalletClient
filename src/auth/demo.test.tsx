import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyOf, json, mockApi, renderApp, signedInApi, user } from '../test/render';

const signedOut = { 'POST /api/v1/auth/refresh': () => json({ code: 'INVALID_REFRESH_TOKEN' }, 401) };

describe('demo sandbox', () => {
  it('opens a sandbox from the sign-in page and lands on the overview', async () => {
    const requests = mockApi({
      ...signedInApi,
      ...signedOut,
      'GET /api/v1/auth/options': () => json({ googleSignIn: false, demo: true }),
      'POST /api/v1/auth/demo': () =>
        json({ accessToken: 'demo-token', tokenType: 'Bearer', expiresIn: 900 }),
      'GET /api/v1/me': () => json({ ...user, demo: true, demoExpiresAt: '2026-10-27T18:30:00Z' }),
    });
    const router = renderApp('/login');

    await userEvent.click(await screen.findByRole('button', { name: 'Спробувати демо' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(requests.some((request) => request.url.endsWith('/api/v1/auth/demo'))).toBe(true);
    expect(await screen.findByText(/Це демо: дані зникнуть/)).toBeInTheDocument();
  });

  it('hides the button when the server does not offer the demo', async () => {
    mockApi({ ...signedOut, 'GET /api/v1/auth/options': () => json({ googleSignIn: false, demo: false }) });
    renderApp('/login');

    expect(await screen.findByRole('button', { name: 'Увійти' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Спробувати демо' })).not.toBeInTheDocument();
  });

  it('keeps the sandbox with an email and a password', async () => {
    let demo = true;
    const requests = mockApi({
      ...signedInApi,
      'GET /api/v1/me': () => json({ ...user, demo, demoExpiresAt: demo ? '2026-10-27T18:30:00Z' : null }),
      'POST /api/v1/me/demo/claim': () => {
        demo = false;
        return new Response(null, { status: 204 });
      },
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Зберегти акаунт' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Ім’я'), 'Ада');
    await userEvent.type(within(dialog).getByLabelText('Електронна пошта'), 'ada@example.com');
    await userEvent.type(within(dialog).getByLabelText('Пароль'), 'secret-pass-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

    expect(await bodyOf(requests, 'POST', '/api/v1/me/demo/claim')).toEqual({
      firstName: 'Ада',
      email: 'ada@example.com',
      password: 'secret-pass-1',
    });
    await waitFor(() => expect(screen.queryByText(/Це демо: дані зникнуть/)).not.toBeInTheDocument());
    expect(await screen.findByText(/Акаунт збережено/)).toBeInTheDocument();
  });
});
