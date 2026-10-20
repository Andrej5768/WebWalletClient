import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyOf, json, mockApi, renderApp, signedInApi, user } from '../test/render';

it('downloads the export under the name the server gives', async () => {
  const createObjectURL = vi.fn((blob: Blob) => {
    expect(blob.size).toBeGreaterThan(0);
    return 'blob:export';
  });
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    expect(this.download).toBe('webwallet-export-2026-10-20.zip');
  });
  mockApi({
    ...signedInApi,
    'GET /api/v1/me/export': () =>
      new Response(new Blob(['PK']), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="webwallet-export-2026-10-20.zip"',
        },
      }),
  });
  renderApp('/settings?tab=data');

  await userEvent.click(await screen.findByRole('button', { name: 'Завантажити архів' }));

  await waitFor(() => expect(click).toHaveBeenCalled());
  click.mockRestore();
});

it('deletes the account with the password and signs out', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/me': () => json({ ...user, hasPassword: true, twoFactorEnabled: false }),
    'POST /api/v1/me/delete': () => json({ deletionScheduledAt: '2026-11-03T10:00:00Z' }),
  });
  const router = renderApp('/settings?tab=data');

  await userEvent.click(await screen.findByRole('button', { name: 'Видалити акаунт' }));
  const dialog = await screen.findByRole('dialog');
  const submit = within(dialog).getByRole('button', { name: 'Видалити акаунт' });
  expect(submit).toBeDisabled();
  expect(within(dialog).queryByLabelText('Код із застосунку або резервний код')).not.toBeInTheDocument();

  await userEvent.type(within(dialog).getByLabelText('Пароль'), 'secret-password');
  await userEvent.click(submit);

  expect(await within(dialog).findByText(/Акаунт буде видалено 03\.11\.2026/)).toBeInTheDocument();
  expect(await bodyOf(requests, 'POST', '/api/v1/me/delete')).toEqual({
    password: 'secret-password',
    confirmEmail: null,
    code: null,
  });
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зрозуміло' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Гроші, інвестиції та податки — в одному місці' }),
  ).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/');
});

it('asks an account without a password for its email and the two-factor code', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/me': () => json({ ...user, hasPassword: false, twoFactorEnabled: true }),
    'POST /api/v1/me/delete': () => json({ deletionScheduledAt: '2026-11-03T10:00:00Z' }),
  });
  renderApp('/settings?tab=data');

  await userEvent.click(await screen.findByRole('button', { name: 'Видалити акаунт' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByLabelText('Пароль')).not.toBeInTheDocument();
  await userEvent.type(within(dialog).getByLabelText(/Введіть адресу пошти цього акаунта/), user.email);
  await userEvent.type(within(dialog).getByLabelText('Код із застосунку або резервний код'), '482913');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Видалити акаунт' }));

  await within(dialog).findByText(/Акаунт буде видалено/);
  expect(await bodyOf(requests, 'POST', '/api/v1/me/delete')).toEqual({
    password: null,
    confirmEmail: user.email,
    code: '482913',
  });
});
