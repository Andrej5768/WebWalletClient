import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, renderApp, signedInApi, user } from '../test/render';

const signedOut = { 'POST /api/v1/auth/refresh': () => json({ code: 'INVALID_REFRESH_TOKEN' }, 401) };

describe('session', () => {
  it('sends a signed-out visitor to the sign-in page and back after signing in', async () => {
    mockApi({
      ...signedOut,
      'POST /api/v1/auth/login': () => json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 }),
      'GET /api/v1/me': () => json(user),
      'GET /api/v1/accounts': () => json([]),
      'GET /api/v1/accounts/summary': signedInApi['GET /api/v1/accounts/summary']!,
      'GET /api/v1/categories': () => json([]),
      'GET /api/v1/reports/spending': signedInApi['GET /api/v1/reports/spending']!,
      'GET /api/v1/goals': signedInApi['GET /api/v1/goals']!,
    });
    const router = renderApp('/reports');

    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Електронна пошта'), 'olena@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByRole('heading', { name: 'Звіти' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reports');
    expect(screen.getByText('Олена Коваль')).toBeInTheDocument();
  });

  it('restores the session from the refresh cookie', async () => {
    mockApi(signedInApi);
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Огляд' })).toBeInTheDocument();
  });

  it('signs out', async () => {
    mockApi({
      ...signedInApi,
      'POST /api/v1/auth/logout': () => new Response(null, { status: 204 }),
    });
    renderApp('/');

    await userEvent.click(await screen.findByRole('button', { name: 'Вийти' }));

    // The root shows the home page to a signed-out visitor
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Гроші, інвестиції та податки — в одному місці' }),
    ).toBeInTheDocument();
  });
});

describe('sign in', () => {
  it('shows the server message next to the button', async () => {
    mockApi({
      ...signedOut,
      'POST /api/v1/auth/login': () =>
        json({ code: 'INVALID_CREDENTIALS', detail: 'Неправильна пошта або пароль.' }, 401),
    });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Електронна пошта'), 'olena@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Неправильна пошта або пароль.');
  });

  it('asks for the two-factor code after the password', async () => {
    const requests = mockApi({
      ...signedOut,
      'POST /api/v1/auth/login': () => json({ twoFactorChallenge: 'challenge-1' }),
      'POST /api/v1/auth/login/two-factor': async (request) => {
        const body = (await request.clone().json()) as { code: string };
        return body.code === '482913'
          ? json({ accessToken: 'token', tokenType: 'Bearer', expiresIn: 900 })
          : json({ code: 'INVALID_TWO_FACTOR_CODE', detail: 'Код неправильний або вже використаний' }, 400);
      },
      'GET /api/v1/me': () => json(user),
      'GET /api/v1/accounts': () => json([]),
      'GET /api/v1/accounts/summary': signedInApi['GET /api/v1/accounts/summary']!,
      'GET /api/v1/categories': () => json([]),
      'GET /api/v1/reports/spending': signedInApi['GET /api/v1/reports/spending']!,
      'GET /api/v1/goals': signedInApi['GET /api/v1/goals']!,
    });
    renderApp('/reports');

    await userEvent.type(await screen.findByLabelText('Електронна пошта'), 'olena@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }));

    expect(await screen.findByRole('heading', { name: 'Підтвердження входу' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Код'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Код неправильний або вже використаний');

    await userEvent.type(screen.getByLabelText('Код'), '482913');
    await userEvent.click(screen.getByLabelText('Довіряти цьому пристрою'));
    await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(await screen.findByRole('heading', { name: 'Звіти' })).toBeInTheDocument();
    const attempts = requests.filter((request) => request.url.endsWith('/api/v1/auth/login/two-factor'));
    expect(await attempts[1]!.clone().json()).toEqual({
      challenge: 'challenge-1',
      code: '482913',
      trustDevice: true,
    });
  });

  it('starts over when the time for the code is over', async () => {
    mockApi({
      ...signedOut,
      'POST /api/v1/auth/login': () => json({ twoFactorChallenge: 'challenge-1' }),
      'POST /api/v1/auth/login/two-factor': () =>
        json({ code: 'TWO_FACTOR_EXPIRED', detail: 'Час на введення коду минув. Увійдіть знову' }, 401),
    });
    renderApp('/login');

    await userEvent.type(await screen.findByLabelText('Електронна пошта'), 'olena@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Використати резервний код' }));
    await userEvent.type(screen.getByLabelText('Резервний код'), '7KQ4-MZ2P');
    await userEvent.click(screen.getByRole('button', { name: 'Підтвердити' }));

    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Час на введення коду минув');
  });
});

describe('registration', () => {
  it('requires first name, email and password but not last name', async () => {
    const requests = mockApi({
      ...signedOut,
      'POST /api/v1/auth/register': () => new Response(null, { status: 202 }),
    });
    renderApp('/register');

    await userEvent.click(await screen.findByRole('button', { name: 'Створити акаунт' }));
    expect(screen.getAllByText('Обов’язкове поле')).toHaveLength(3);

    await userEvent.type(screen.getByLabelText(/Ім’я/), 'Олена');
    await userEvent.type(screen.getByLabelText(/Електронна пошта/), 'olena@example.com');
    await userEvent.type(screen.getByLabelText(/^Пароль/), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Створити акаунт' }));

    expect(await screen.findByRole('heading', { name: 'Перевірте пошту' })).toBeInTheDocument();
    const register = requests.find((request) => request.url.endsWith('/auth/register'))!;
    expect(await register.json()).toMatchObject({
      firstName: 'Олена',
      lastName: '',
      email: 'olena@example.com',
    });
  });
});

describe('email links', () => {
  it('confirms the email with the token from the fragment', async () => {
    const requests = mockApi({
      ...signedOut,
      'POST /api/v1/auth/verify-email': () => new Response(null, { status: 204 }),
    });
    const router = renderApp('/verify-email#token=abc123');

    expect(await screen.findByRole('heading', { name: 'Пошту підтверджено' })).toBeInTheDocument();
    expect(router.state.location.hash).toBe('');
    const verify = requests.find((request) => request.url.endsWith('/auth/verify-email'))!;
    expect(await verify.json()).toEqual({ token: 'abc123' });
  });

  it('offers a new link when the confirmation link has expired', async () => {
    mockApi({
      ...signedOut,
      'POST /api/v1/auth/verify-email': () => json({ code: 'INVALID_TOKEN' }, 400),
    });
    renderApp('/verify-email#token=old');

    expect(await screen.findByText('Упс!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Надіслати ще раз' })).toBeInTheDocument();
  });

  it('checks that the new passwords match', async () => {
    mockApi(signedOut);
    renderApp('/reset-password#token=abc');

    await userEvent.type(await screen.findByLabelText('Новий пароль'), 'secret-password');
    await userEvent.type(screen.getByLabelText('Повторіть пароль'), 'other-password');
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти пароль' }));

    await waitFor(() => expect(screen.getByText('Паролі не збігаються')).toBeInTheDocument());
  });
});
