import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { budgetRowOf } from '../test/fixtures';
import { bodyOf, currentMonth as month, json, mockApi, plain, renderApp, signedInApi } from '../test/render';

const food = budgetRowOf({
  categoryId: 1,
  name: 'Їжа',
  children: [
    budgetRowOf({
      categoryId: 2,
      name: 'Продукти',
      parentId: 1,
      ownAssigned: 9000,
      ownActivity: -4950,
      ownAvailable: 4050,
    }),
    budgetRowOf({
      categoryId: 3,
      name: 'Кафе',
      parentId: 1,
      ownAssigned: 2000,
      ownActivity: -2340,
      ownAvailable: -340,
    }),
  ],
});

const budget = {
  month,
  currency: 'UAH',
  readyToAssign: 4250,
  assigned: 11000,
  activity: -7290,
  available: 3710,
  unconvertedCurrencies: [],
  categories: [food],
};

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/categories': () => json([]),
    [`GET /api/v1/budget/${month}`]: () => json(budget),
    ...extra,
  });
}

it('shows ready to assign, group totals counted once, envelopes and overspending', async () => {
  api();
  renderApp('/budget');

  expect(plain((await screen.findByText(/4\s250,00/)).textContent)).toBe('4 250,00 ₴');
  expect(screen.getByText('Продукти')).toBeInTheDocument();
  // The group row shows the server total, not the total plus its children again.
  expect(
    screen.getAllByText((_, element) => plain(element?.textContent) === '11 000,00 ₴').length,
  ).toBeGreaterThan(0);
  expect(
    screen.queryByText((_, element) => plain(element?.textContent) === '22 000,00 ₴'),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Перевитрата: Кафе/)).toBeInTheDocument();
});

it('saves a new assignment when the field loses focus', async () => {
  const requests = api({ [`PUT /api/v1/budget/${month}/categories/2`]: () => json(budget) });
  renderApp('/budget');

  const input = await screen.findByLabelText('Призначено: Продукти');
  await userEvent.clear(input);
  await userEvent.type(input, '9500');
  fireEvent.blur(input);

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  expect(await bodyOf(requests, 'PUT', `/api/v1/budget/${month}/categories/2`)).toEqual({ assigned: 9500 });
});

it('covers overspending by moving money in one request', async () => {
  const requests = api({ [`POST /api/v1/budget/${month}/move`]: () => json(budget) });
  renderApp('/budget');

  await userEvent.click(await screen.findByRole('button', { name: 'Покрити' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByLabelText('Сума')).toHaveValue('340');
  await userEvent.click(within(dialog).getByLabelText('Звідки'));
  await userEvent.keyboard('Продукти{ArrowDown}{Enter}');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Перемістити' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', `/api/v1/budget/${month}/move`)).toEqual({
    fromCategoryId: 2,
    toCategoryId: 3,
    amount: 340,
  });
});

it('copies the previous month with one request', async () => {
  const requests = api({ [`POST /api/v1/budget/${month}/copy-previous`]: () => json(budget) });
  renderApp('/budget');

  await userEvent.click(await screen.findByRole('button', { name: 'Як минулого місяця' }));

  await waitFor(() =>
    expect(requests.some((request) => new URL(request.url).pathname.endsWith('/copy-previous'))).toBe(true),
  );
});
