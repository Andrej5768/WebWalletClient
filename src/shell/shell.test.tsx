import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asPhone, mockApi, renderApp, signedInApi } from '../test/render';

it('hides the menu behind a button on a phone and closes it when a section is picked', async () => {
  asPhone();
  mockApi(signedInApi);
  renderApp('/');

  const menuButton = await screen.findByRole('button', { name: 'Меню' });
  expect(screen.queryByRole('navigation', { name: 'Головне меню' })).not.toBeInTheDocument();

  await userEvent.click(menuButton);
  const drawer = await screen.findByRole('dialog');
  // The language and the theme move from the header into the menu
  expect(within(drawer).getByRole('radiogroup', { name: 'Мова' })).toBeInTheDocument();
  await userEvent.click(within(drawer).getByRole('link', { name: 'Рахунки' }));

  expect(await screen.findByRole('heading', { name: 'Рахунки', level: 1 })).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('keeps a new transaction one tap away on a phone', async () => {
  asPhone();
  mockApi(signedInApi);
  const router = renderApp('/');

  await userEvent.click(await screen.findByRole('button', { name: 'Операція' }));

  await waitFor(() => expect(router.state.location.search).toBe('?new=1'));
});
