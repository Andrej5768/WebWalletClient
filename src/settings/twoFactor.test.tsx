import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyOf, json, mockApi, renderApp, signedInApi, user } from '../test/render';

const codes = [
  '7KQ4-MZ2P',
  'H8D2-QW7L',
  '3RXV-9TNB',
  'PZ6M-4KJC',
  'W2YF-8HQD',
  'C9LN-5VRT',
  'M4TB-2XEW',
  'J7GP-6NZK',
  'R5KD-3MYQ',
  'X8VH-7CPL',
];

it('turns on two-factor authentication and shows the recovery codes once', async () => {
  let enabled = false;
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/me': () => json({ ...user, twoFactorEnabled: enabled, recoveryCodesLeft: enabled ? 10 : 0 }),
    'POST /api/v1/me/two-factor/setup': () =>
      json({
        secret: 'JBSWY3DPEHPK3PXP7KQ4MZ2P',
        otpauthUri:
          'otpauth://totp/WebWallet:olena%40example.com?secret=JBSWY3DPEHPK3PXP7KQ4MZ2P&issuer=WebWallet',
      }),
    'POST /api/v1/me/two-factor/enable': () => {
      enabled = true;
      return json({ recoveryCodes: codes });
    },
  });
  renderApp('/settings?tab=security');

  await userEvent.click(await screen.findByRole('button', { name: 'Увімкнути' }));
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByText('JBSW Y3DP EHPK 3PXP 7KQ4 MZ2P')).toBeInTheDocument();
  expect(await within(dialog).findByAltText('QR-код для застосунку-автентифікатора')).toBeInTheDocument();

  await userEvent.type(within(dialog).getByLabelText('Код із застосунку'), '482913');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Підтвердити' }));

  expect(await within(dialog).findByText('7KQ4-MZ2P')).toBeInTheDocument();
  expect(await bodyOf(requests, 'POST', '/api/v1/me/two-factor/enable')).toEqual({ code: '482913' });
  const done = within(dialog).getByRole('button', { name: 'Готово' });
  expect(done).toBeDisabled();
  await userEvent.click(within(dialog).getByLabelText('Резервні коди збережено'));
  await userEvent.click(done);

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByText('Увімкнено')).toBeInTheDocument();
  expect(screen.getByText('Залишилось 10 резервних кодів')).toBeInTheDocument();
});

it('turns off two-factor authentication with the password and a code', async () => {
  let enabled = true;
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/me': () => json({ ...user, twoFactorEnabled: enabled, recoveryCodesLeft: enabled ? 8 : 0 }),
    'POST /api/v1/me/two-factor/disable': () => {
      enabled = false;
      return new Response(null, { status: 204 });
    },
  });
  renderApp('/settings?tab=security');

  expect(await screen.findByText('Залишилось 8 резервних кодів')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Вимкнути' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Пароль'), 'secret-password');
  await userEvent.type(within(dialog).getByLabelText('Код із застосунку або резервний код'), '7KQ4-MZ2P');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Вимкнути' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/me/two-factor/disable')).toEqual({
    password: 'secret-password',
    code: '7KQ4-MZ2P',
  });
  expect(screen.getByRole('button', { name: 'Увімкнути' })).toBeInTheDocument();
});
