import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { bodyOf, json, mockApi, renderApp, signedInApi } from '../test/render';

const categories = [
  {
    id: 1,
    name: 'Їжа',
    kind: 'EXPENSE',
    icon: 'utensils',
    color: 'orange',
    necessity: 'NEEDS',
    children: [{ id: 2, name: 'Кафе', kind: 'EXPENSE', parentId: 1, necessity: 'WANTS' }],
  },
];

it('saves the profile with an optional last name', async () => {
  const requests = mockApi({
    ...signedInApi,
    'PUT /api/v1/me': () => json({ id: 1, firstName: 'Олена', email: 'olena@example.com', locale: 'uk' }),
  });
  renderApp('/settings');

  const lastName = await screen.findByLabelText('Прізвище');
  await userEvent.clear(lastName);
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  expect(await bodyOf(requests, 'PUT', '/api/v1/me')).toEqual({
    firstName: 'Олена',
    baseCurrency: 'UAH',
    locale: 'uk',
  });
});

it('starts over only after typing the confirmation word', async () => {
  const requests = mockApi({
    ...signedInApi,
    'POST /api/v1/me/reset': () => new Response(null, { status: 204 }),
  });
  renderApp('/settings?tab=data');

  await userEvent.click(await screen.findByRole('button', { name: 'Почати спочатку' }));
  const dialog = await screen.findByRole('dialog');
  const submit = within(dialog).getByRole('button', { name: 'Видалити все' });
  expect(submit).toBeDisabled();

  await userEvent.type(within(dialog).getByLabelText('Введіть DELETE, щоб підтвердити'), 'DELETE');
  await userEvent.click(submit);

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/me/reset')).toEqual({
    keepCategories: true,
    confirm: 'DELETE',
  });
});

it('edits a category: icon, color and needs or wants', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/categories': () => json(categories),
    'PUT /api/v1/categories/2': () => json({ id: 2 }),
  });
  renderApp('/settings?tab=categories');

  expect(await screen.findByText('Необов’язкова')).toBeInTheDocument();
  fireEvent.doubleClick(screen.getByText('Кафе'));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('radio', { name: 'coffee' }));
  await userEvent.click(within(dialog).getByRole('radio', { name: 'Рожевий' }));
  await userEvent.click(within(dialog).getByText('Як у групи'));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'PUT', '/api/v1/categories/2')).toEqual({
    name: 'Кафе',
    kind: 'EXPENSE',
    parentId: 1,
    icon: 'coffee',
    color: 'pink',
    necessity: null,
    carryOver: false,
    archived: false,
  });
});

it('creates a tag with a color', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/tags': () => json([]),
    'POST /api/v1/tags': () => json({ id: 1 }, 201),
  });
  renderApp('/settings?tab=tags');

  await userEvent.click(await screen.findByRole('button', { name: 'Новий тег' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/Назва/), 'відпустка');
  await userEvent.click(within(dialog).getByRole('radio', { name: 'Блакитний' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/tags')).toEqual({ name: 'відпустка', color: 'cyan' });
});

it('deletes a tag only after confirming', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/tags': () => json([{ id: 3, name: 'відпустка', color: null }]),
    'DELETE /api/v1/tags/3': () => new Response(null, { status: 204 }),
  });
  renderApp('/settings?tab=tags');

  await userEvent.click(await screen.findByRole('button', { name: '#відпустка' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Видалити' }));

  const confirm = await screen.findByRole('dialog', { name: 'Видалити тег #відпустка?' });
  expect(requests.some((request) => request.method === 'DELETE')).toBe(false);
  await userEvent.click(within(confirm).getByRole('button', { name: 'Видалити' }));

  await waitFor(() => expect(requests.some((request) => request.method === 'DELETE')).toBe(true));
});
