import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isoDate, kyivToday } from '../lib/periods';
import { accountOf, categoryOf, splitOf, transactionOf } from '../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../test/render';

const today = isoDate(kyivToday());

const accounts = [
  accountOf({ id: 1, name: 'Чорна картка', balance: 18452.37, balanceInBase: 18452.37 }),
  accountOf({ id: 2, name: 'Біла картка', currency: 'USD', balance: 1240, balanceInBase: 51212 }),
];

const categories = [
  categoryOf({
    id: 10,
    name: 'Їжа',
    icon: 'utensils',
    color: 'orange',
    children: [categoryOf({ id: 11, name: 'Продукти', parentId: 10, icon: 'shopping-cart' })],
  }),
  categoryOf({ id: 20, name: 'Зарплата', kind: 'INCOME', color: 'green' }),
];

const transactions = [
  transactionOf({
    id: 100,
    type: 'EXPENSE',
    date: today,
    accountId: 1,
    amount: 1284.5,
    currency: 'UAH',
    payee: { id: 5, name: 'Сільпо' },
    splits: [splitOf({ id: 1, categoryId: 11, amount: 1284.5 })],
    tagIds: [7],
    source: 'MONOBANK',
  }),
  transactionOf({
    id: 101,
    type: 'EXPENSE',
    date: today,
    accountId: 1,
    amount: 640,
    currency: 'UAH',
    payee: { id: 6, name: 'LIQPAY*Prom' },
    splits: [splitOf({ id: 2, amount: 640 })],
    tagIds: [],
    source: 'MONOBANK',
  }),
  transactionOf({
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
  }),
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

it('shows the feed by day with categories, tags and transfers', async () => {
  api();
  renderApp('/transactions');

  const row = await screen.findByTestId('transaction-100');
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
    expect(last.searchParams.get('from')).toBe(isoDate(kyivToday().startOf('month')));
  });
});

it('categorizes an uncategorized transaction from the row', async () => {
  const requests = api({ 'PUT /api/v1/transactions/101': () => json({ id: 101 }) });
  renderApp('/transactions');

  const picker = await screen.findByPlaceholderText('Обрати категорію');
  await userEvent.type(picker, 'Продукти');
  await userEvent.keyboard('{ArrowDown}{Enter}');

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  expect(await bodyOf(requests, 'PUT', '/api/v1/transactions/101')).toMatchObject({
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
  await userEvent.type(await within(drawer).findByLabelText('Сума'), '95');
  await userEvent.type(within(drawer).getByLabelText('Отримувач'), 'Aroma Kava');
  await userEvent.type(within(drawer).getByLabelText('Теги'), 'відпустка{enter}');
  await userEvent.click(within(drawer).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/transactions')).toMatchObject({
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
  expect(await within(drawer).findByLabelText('Зараховано')).toHaveValue('100');
  expect(within(drawer).queryByLabelText('Отримувач')).not.toBeInTheDocument();
});

it('offers the quick category picker only for a single uncategorized part', async () => {
  const split = transactionOf({
    id: 103,
    amount: 300,
    payee: { id: 9, name: 'АТБ' },
    splits: [splitOf({ id: 3, amount: 200 }), splitOf({ id: 4, categoryId: 11, amount: 100 })],
  });
  api({
    'GET /api/v1/transactions': () =>
      json({ items: [...transactions, split], page: 0, size: 50, totalItems: 4, totalPages: 1 }),
  });
  renderApp('/transactions');

  await screen.findByTestId('transaction-103');
  expect(screen.getAllByLabelText('Вибрати категорію для «LIQPAY*Prom»').length).toBeGreaterThan(0);
  expect(screen.queryAllByLabelText('Вибрати категорію для «АТБ»')).toHaveLength(0);
});

it('opens a transaction from another page by its id', async () => {
  api({
    'GET /api/v1/transactions': () => json({ items: [], page: 0, size: 50, totalItems: 0, totalPages: 0 }),
    'GET /api/v1/transactions/100': () => json(transactions[0]),
  });
  renderApp('/transactions?edit=100');

  const drawer = await screen.findByRole('dialog');
  expect(await within(drawer).findByLabelText('Сума')).toHaveValue('1 284,5');
});

it('goes back to the first page when the search changes', async () => {
  const requests = api({
    'GET /api/v1/transactions': () =>
      json({ items: transactions, page: 1, size: 50, totalItems: 53, totalPages: 2 }),
  });
  renderApp('/transactions?page=2');

  await userEvent.click(await screen.findByRole('button', { name: /Пошук/ }));
  await userEvent.type(screen.getByLabelText('Пошук'), 'сільпо');

  await waitFor(() => {
    const last = new URL(requests.filter((request) => request.url.includes('/transactions')).at(-1)!.url);
    expect(last.searchParams.get('q')).toBe('сільпо');
    expect(last.searchParams.get('page')).toBe('0');
  });
});

describe('transfers between own accounts', () => {
  const uah = [accounts[0]!, accountOf({ id: 3, name: 'ПриватБанк ФОП', balance: 9650 })];
  const halves = [
    transactionOf({
      id: 200,
      type: 'EXPENSE',
      date: today,
      accountId: 1,
      amount: 10000,
      currency: 'UAH',
      comment: 'Переказ на картку ПриватБанку',
      splits: [splitOf({ id: 3, amount: 10000 })],
      tagIds: [],
    }),
    transactionOf({
      id: 201,
      type: 'INCOME',
      date: today,
      accountId: 3,
      amount: 9650,
      currency: 'UAH',
      comment: 'Зарахування зі своєї картки',
      splits: [splitOf({ id: 4, amount: 9650 })],
      tagIds: [],
    }),
  ];
  const merged = transactionOf({
    ...halves[0]!,
    type: 'TRANSFER',
    toAccountId: 3,
    toAmount: 9650,
    toCurrency: 'UAH',
    splits: [],
  });

  it('suggests merging an expense and an income of the day, or leaving them apart', async () => {
    const requests = api({
      'GET /api/v1/accounts': () => json(uah),
      'GET /api/v1/transactions': () =>
        json({ items: halves, page: 0, size: 50, totalItems: 2, totalPages: 1 }),
      'GET /api/v1/transactions/transfer-pairs': () =>
        json([{ expenseId: 200, incomeId: 201, date: today, exact: false, difference: -0.035 }]),
      'POST /api/v1/transactions/transfer-pairs/merge': () => json(merged),
      'POST /api/v1/transactions/transfer-pairs/dismiss': () => new Response(null, { status: 204 }),
    });
    renderApp('/transactions');

    const hint = await screen.findByTestId('pair-200-201');
    expect(hint).toHaveTextContent('Схоже, це один переказ Чорна картка → ПриватБанк ФОП:');
    expect(hint).toHaveTextContent(/дійшло на 3,5\s?% менше — можливо, комісія\./);
    const pairs = requests.find((request) => request.url.includes('/transfer-pairs'))!;
    expect(new URL(pairs.url).searchParams.get('from')).toBe(today);
    expect(new URL(pairs.url).searchParams.get('to')).toBe(today);

    await userEvent.click(within(hint).getByRole('button', { name: 'Об’єднати в переказ' }));
    expect(await bodyOf(requests, 'POST', '/api/v1/transactions/transfer-pairs/merge')).toEqual({
      expenseId: 200,
      incomeId: 201,
    });
    await userEvent.click(within(hint).getByRole('button', { name: 'Не переказ' }));
    expect(await bodyOf(requests, 'POST', '/api/v1/transactions/transfer-pairs/dismiss')).toEqual({
      expenseId: 200,
      incomeId: 201,
    });
  });

  it('shows the fee of a transfer and splits it back', async () => {
    const requests = api({
      'GET /api/v1/accounts': () => json(uah),
      'GET /api/v1/transactions': () =>
        json({ items: [merged], page: 0, size: 50, totalItems: 1, totalPages: 1 }),
      'POST /api/v1/transactions/200/split-transfer': () => json(halves[0]),
    });
    renderApp('/transactions');

    const row = await screen.findByTestId('transaction-200');
    expect(plain(within(row).getByText(/^Переказ · комісія/).textContent)).toBe('Переказ · комісія 350,00 ₴');

    await userEvent.click(within(row).getByText('Чорна картка → ПриватБанк ФОП'));
    const drawer = await screen.findByRole('dialog');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Роз’єднати' }));
    await waitFor(() =>
      expect(requests.some((request) => request.url.endsWith('/transactions/200/split-transfer'))).toBe(true),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows no fee for a transfer between currencies', async () => {
    api();
    renderApp('/transactions');
    const row = await screen.findByTestId('transaction-102');
    expect(within(row).getByText('Перекази')).toBeInTheDocument();
  });
});
