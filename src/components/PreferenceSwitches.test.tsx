import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyOf, json, mockApi, renderApp, signedInApi, user } from '../test/render';

it('saves the language chosen in the header to the profile, which decides it on the next start', async () => {
  const requests = mockApi({
    ...signedInApi,
    'PUT /api/v1/me': () => json({ ...user, locale: 'en' }),
  });
  renderApp('/');

  await userEvent.click(await screen.findByText('ENG'));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/me')).toEqual({
      firstName: user.firstName,
      lastName: user.lastName,
      baseCurrency: user.baseCurrency,
      locale: 'en',
    }),
  );
});
