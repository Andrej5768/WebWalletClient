import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyOf, json, mockApi, renderApp, signedInApi, user } from '../test/render';

const signedOut = { 'POST /api/v1/auth/refresh': () => json({ code: 'INVALID_REFRESH_TOKEN' }, 401) };

describe('sign-in with Google', () => {
  it('offers Google on the sign-in page when the server has it', async () => {
    mockApi({ ...signedOut, 'GET /api/v1/auth/options': () => json({ googleSignIn: true }) });
    renderApp('/login');

    expect(await screen.findByRole('link', { name: 'Увійти через Google' })).toHaveAttribute(
      'href',
      '/api/v1/auth/google/start',
    );
  });

  it('hides Google when the server does not have it', async () => {
    mockApi(signedOut);
    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Увійти через Google' })).not.toBeInTheDocument();
  });

  it('exchanges the ticket of the redirect for a session', async () => {
    const requests = mockApi({
      ...signedInApi,
      ...signedOut,
      'POST /api/v1/auth/google/complete': () =>
        json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }),
    });
    const router = renderApp('/auth/google#ticket=ticket-1');

    expect(await screen.findByRole('heading', { name: 'Огляд' })).toBeInTheDocument();
    expect(await bodyOf(requests, 'POST', '/api/v1/auth/google/complete')).toEqual({ ticket: 'ticket-1' });
    expect(router.state.location.hash).toBe('');
  });

  it('asks for the two-factor code after Google', async () => {
    mockApi({
      ...signedOut,
      'POST /api/v1/auth/google/complete': () => json({ twoFactorChallenge: 'challenge-1' }),
    });
    renderApp('/auth/google#ticket=ticket-1');

    expect(await screen.findByRole('heading', { name: 'Підтвердження входу' })).toBeInTheDocument();
  });

  it('explains why Google sign-in failed', async () => {
    mockApi(signedOut);
    renderApp('/auth/google#error=email_taken');

    expect(await screen.findByRole('alert')).toHaveTextContent('Акаунт із цією поштою вже є');
    expect(screen.getByRole('link', { name: 'Повернутися до входу' })).toHaveAttribute('href', '/login');
  });
});

describe('Google in the settings', () => {
  it('keeps Google for an account without a password and offers to set one by email', async () => {
    const requests = mockApi({
      ...signedInApi,
      'GET /api/v1/auth/options': () => json({ googleSignIn: true }),
      'GET /api/v1/me': () => json({ ...user, hasPassword: false, googleEmail: 'olena@gmail.com' }),
      'POST /api/v1/auth/forgot-password': () => new Response(null, { status: 202 }),
    });
    renderApp('/settings?tab=security');

    expect(await screen.findByText('olena@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Відключити' })).toBeDisabled();
    expect(screen.queryByLabelText('Поточний пароль')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Встановити пароль' }));

    expect(await screen.findByText('Лист із посиланням надіслано')).toBeInTheDocument();
    expect(await bodyOf(requests, 'POST', '/api/v1/auth/forgot-password')).toEqual({ email: user.email });
  });

  it('disconnects Google from an account with a password', async () => {
    let linked = true;
    mockApi({
      ...signedInApi,
      'GET /api/v1/auth/options': () => json({ googleSignIn: true }),
      'GET /api/v1/me': () =>
        json({ ...user, hasPassword: true, googleEmail: linked ? 'olena@gmail.com' : null }),
      'POST /api/v1/me/google/unlink': () => {
        linked = false;
        return new Response(null, { status: 204 });
      },
    });
    renderApp('/settings?tab=security');

    await userEvent.click(await screen.findByRole('button', { name: 'Відключити' }));

    expect(await screen.findByRole('button', { name: 'Підключити' })).toBeInTheDocument();
  });

  it('reports the result of linking from the redirect', async () => {
    mockApi({
      ...signedInApi,
      'GET /api/v1/auth/options': () => json({ googleSignIn: true }),
      'GET /api/v1/me': () => json({ ...user, hasPassword: true, googleEmail: null }),
    });
    const router = renderApp('/settings?tab=security#error=taken');

    expect(
      await screen.findByText('Цей акаунт Google уже підключено до іншого акаунта WebWallet.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.hash).toBe(''));
    expect(within(document.body).getByRole('button', { name: 'Підключити' })).toBeInTheDocument();
  });
});

describe('linking Google in the settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks for the password and sends it with the link request', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const requests = mockApi({
      ...signedInApi,
      'GET /api/v1/auth/options': () => json({ googleSignIn: true }),
      'GET /api/v1/me': () => json({ ...user, hasPassword: true, googleEmail: null }),
      'POST /api/v1/me/google/link': () =>
        json({ url: 'https://accounts.google.com/o/oauth2/v2/auth?state=s' }),
    });
    renderApp('/settings?tab=security');

    await userEvent.click(await screen.findByRole('button', { name: 'Підключити' }));
    const dialog = await screen.findByRole('dialog', { name: 'Підтвердіть, що це ви' });
    await userEvent.type(within(dialog).getByLabelText('Поточний пароль'), 'secret-password');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Продовжити' }));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=s'),
    );
    expect(await bodyOf(requests, 'POST', '/api/v1/me/google/link')).toEqual({ password: 'secret-password' });
  });

  it('asks an account without a password for the code of two-factor authentication', async () => {
    const requests = mockApi({
      ...signedInApi,
      'GET /api/v1/auth/options': () => json({ googleSignIn: true }),
      'GET /api/v1/me': () =>
        json({ ...user, hasPassword: false, twoFactorEnabled: true, googleEmail: null }),
      'POST /api/v1/me/google/link': () =>
        json({ code: 'INVALID_TWO_FACTOR_CODE', detail: 'Код неправильний або вже використаний' }, 400),
    });
    renderApp('/settings?tab=security');

    await userEvent.click(await screen.findByRole('button', { name: 'Підключити' }));
    const dialog = await screen.findByRole('dialog', { name: 'Підтвердіть, що це ви' });
    expect(within(dialog).queryByLabelText('Поточний пароль')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Код із застосунку або резервний код'), '482913');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Продовжити' }));

    expect(await within(dialog).findByText('Код неправильний або вже використаний')).toBeInTheDocument();
    expect(await bodyOf(requests, 'POST', '/api/v1/me/google/link')).toEqual({ code: '482913' });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});
