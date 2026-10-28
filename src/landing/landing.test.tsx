import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../i18n';
import { json, mockApi, renderApp } from '../test/render';

const signedOut = { 'POST /api/v1/auth/refresh': () => json({ code: 'INVALID_REFRESH_TOKEN' }, 401) };

describe('home page', () => {
  it('describes the project to a signed-out visitor at the root', async () => {
    mockApi(signedOut);
    const router = renderApp('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Гроші, інвестиції та податки — в одному місці' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Шлях до фінансової незалежності' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Сервер/ })).toHaveAttribute(
      'href',
      'https://github.com/Andrej5768/WebWallet',
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('leads to registration and sign-in', async () => {
    mockApi(signedOut);
    const router = renderApp('/');

    const header = within(await screen.findByRole('banner'));
    await userEvent.click(header.getByRole('link', { name: 'Створити акаунт' }));
    expect(router.state.location.pathname).toBe('/register');

    await router.navigate('/');
    await userEvent.click(within(await screen.findByRole('banner')).getByRole('link', { name: 'Увійти' }));
    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument();
  });

  it('still sends a signed-out visitor of another page to the sign-in page', async () => {
    mockApi(signedOut);
    const router = renderApp('/accounts');

    expect(await screen.findByRole('heading', { name: 'Вхід' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('Ukrainian public pages', () => {
  it('shows /uk/ in Ukrainian without changing the language chosen before', async () => {
    await i18n.changeLanguage('en');
    mockApi(signedOut);
    renderApp('/uk/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Гроші, інвестиції та податки — в одному місці' }),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('uk');
    expect(i18n.language).toBe('en');
    expect(localStorage.getItem('ww-language')).toBe('en');
    expect(screen.getByRole('link', { name: 'Конфіденційність' })).toHaveAttribute('href', '/uk/privacy');
  });

  it('opens the English pair when English is chosen on a Ukrainian page', async () => {
    mockApi(signedOut);
    const router = renderApp('/uk/terms');

    expect(await screen.findByRole('heading', { level: 1, name: 'Умови використання' })).toBeInTheDocument();
    await userEvent.click(screen.getByText('ENG'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/terms'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of service' })).toBeInTheDocument();
    expect(i18n.language).toBe('en');
  });
});
