import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { setAccessToken } from '../api/session';
import i18n from '../i18n';
import { json, mockApi, renderApp, signedInApi } from '../test/render';

const today = dayjs().format('YYYY-MM-DD');

const accounts = [
  { id: 1, name: 'Чорна картка', type: 'CARD', currency: 'UAH', balance: 18452.37, balanceInBase: 18452.37 },
  { id: 2, name: 'Біла картка', type: 'CARD', currency: 'USD', balance: 1240, balanceInBase: 51212 },
];

const categories = [
  {
    id: 10,
    name: 'Їжа',
    kind: 'EXPENSE',
    icon: 'utensils',
    color: 'orange',
    children: [{ id: 11, name: 'Продукти', kind: 'EXPENSE', parentId: 10, icon: 'shopping-cart' }],
  },
  { id: 20, name: 'Зарплата', kind: 'INCOME', color: 'green' },
];

const transactions = [
  {
    id: 100,
    type: 'EXPENSE',
    date: today,
    accountId: 1,
    amount: 1284.5,
    currency: 'UAH',
    payee: { id: 5, name: 'Сільпо' },
    splits: [{ id: 1, categoryId: 11, amount: 1284.5 }],
    tagIds: [7],
    source: 'MONOBANK',
  },
  {
    id: 101,
    type: 'EXPENSE',
    date: today,
    accountId: 1,
    amount: 640,
    currency: 'UAH',
    payee: { id: 6, name: 'LIQPAY*Prom' },
    splits: [{ id: 2, amount: 640 }],
    tagIds: [],
    source: 'MONOBANK',
  },
  {
    id: 102,
    type: 'TRANSFER',
    date: today,
    accountId: 1,
    toAccountId: 2,
    amount: 4130,
    toAmount: 100,
    currency: 'UAH',
    toCurrency: 'USD',
    splits: [],
    tagIds: [],
    source: 'MANUAL',
  },
];

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/categories': () => json(categories),
    'GET /api/v1/payees': () => json([{ id: 5, name: 'Сільпо' }]),
    'GET /api/v1/tags': () => json([{ id: 7, name: 'дім', color: 'teal' }]),
    'GET /api/v1/transactions': () =>
      json({ items: transactions, page: 0, size: 50, totalItems: 3, totalPages: 1 }),
    ...extra,
  });
}

beforeEach(async () => {
  setAccessToken(null);
  localStorage.clear();
  await i18n.changeLanguage('uk');
});

afterEach(() => vi.unstubAllGlobals());

it('shows the feed by day with categories, tags and transfers', async () => {
  api();
  renderApp('/transactions');

  const row = await screen.findByRole('button', { name: /Сільпо/ });
  expect(screen.getByText(/^Сьогодні, /)).toBeInTheDocument();
  expect(await within(row).findByText('Їжа › Продукти')).toBeInTheDocument();
  expect(within(row).getByText('#дім')).toBeInTheDocument();
  expect(screen.getByText('Чорна картка → Біла картка')).toBeInTheDocument();
  expect(screen.getByText('3 операції')).toBeInTheDocument();
});

it('sends the current month and the search query to the API', async () => {
  const requests = api();
  renderApp('/transactions');

  await userEvent.click(await screen.findByRole('button', { name: /Пошук/ }));
  await userEvent.type(screen.getByLabelText('Пошук'), 'сільпо');

  await waitFor(() => {
    const last = new URL(requests.filter((request) => request.url.includes('/transactions')).at(-1)!.url);
    expect(last.searchParams.get('q')).toBe('сільпо');
    expect(last.searchParams.get('from')).toBe(dayjs().startOf('month').format('YYYY-MM-DD'));
  });
});

it('categorizes an uncategorized transaction from the row', async () => {
  const requests = api({ 'PUT /api/v1/transactions/101': () => json({ id: 101 }) });
  renderApp('/transactions');

  const picker = await screen.findByPlaceholderText('Обрати категорію');
  await userEvent.type(picker, 'Продукти');
  await userEvent.keyboard('{ArrowDown}{Enter}');

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  const put = requests.find((request) => request.method === 'PUT')!;
  expect(await put.json()).toMatchObject({
    type: 'EXPENSE',
    amount: 640,
    accountId: 1,
    payeeId: 6,
    categoryId: 11,
  });
});

it('adds an expense with a new tag', async () => {
  const requests = api({
    'POST /api/v1/tags': () => json({ id: 8, name: 'відпустка' }, 201),
    'POST /api/v1/transactions': () => json({ id: 200 }, 201),
  });
  renderApp('/transactions?new=1&accountId=1');

  const drawer = await screen.findByRole('dialog');
  await userEvent.type(within(drawer).getByLabelText('Сума'), '95');
  await userEvent.type(within(drawer).getByLabelText('Отримувач'), 'Aroma Kava');
  await userEvent.type(within(drawer).getByLabelText('Теги'), 'відпустка{enter}');
  await userEvent.click(within(drawer).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const create = requests.find(
    (request) => request.method === 'POST' && request.url.endsWith('/transactions'),
  )!;
  expect(await create.json()).toMatchObject({
    type: 'EXPENSE',
    amount: 95,
    accountId: 1,
    date: today,
    payeeName: 'Aroma Kava',
    tagIds: [8],
  });
});

it('asks for the received amount of a transfer between currencies', async () => {
  api();
  renderApp('/transactions?edit=102');

  const drawer = await screen.findByRole('dialog');
  expect(within(drawer).getByLabelText('Зараховано')).toHaveValue('100');
  expect(within(drawer).queryByLabelText('Отримувач')).not.toBeInTheDocument();
});
