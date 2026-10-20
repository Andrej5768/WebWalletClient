import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setAccessToken } from '../api/session';
import { accountOf, categoryOf } from '../test/fixtures';
import { bodyOf, json, mockApi, plain, renderWithProviders } from '../test/render';
import { ImportsPage } from './ImportsPage';

const accounts = [
  accountOf({ id: 1, name: 'Чорна картка', balance: 18452.37 }),
  accountOf({ id: 2, name: 'Картка «Універсальна»', balance: 6318.9 }),
];

const categories = [
  categoryOf({ id: 10, name: 'Їжа', children: [categoryOf({ id: 11, name: 'Продукти', parentId: 10 })] }),
];

const connection = {
  clientName: 'Олена Коваль',
  connectedAt: '2026-10-02T10:00:00Z',
  syncMode: 'INTERVAL',
  windowStart: '08:00',
  windowEnd: '23:00',
  dailyAt: '06:00',
  nextSyncAt: '2026-10-15T11:45:00Z',
  accounts: [
    {
      id: 7,
      accountId: 1,
      accountName: 'Чорна картка',
      title: 'Чорна',
      currency: 'UAH',
      balance: 18452.37,
      bankBalance: 19692.37,
      difference: 1240,
      syncedUntil: '2026-10-15T11:30:00Z',
    },
  ],
};

const preview = {
  id: 'f5e1c0de-0000-4000-8000-000000000001',
  source: 'PRIVATBANK',
  summary: {
    transactionsImported: 1,
    transactionsMatched: 1,
    accountsCreated: 0,
    categoriesCreated: 0,
    warnings: [],
  },
  operations: {
    page: 0,
    size: 100,
    totalItems: 2,
    totalPages: 1,
    items: [
      {
        key: 'op-1',
        date: '2026-10-11',
        payee: 'LIQPAY*Prom',
        amount: 640,
        currency: 'UAH',
        type: 'EXPENSE',
        account: { id: 2, name: 'Картка «Універсальна»', currency: 'UAH', created: false },
        tagIds: [],
        duplicate: false,
      },
      {
        key: 'op-2',
        date: '2026-10-10',
        payee: 'Сільпо',
        amount: 1284.5,
        currency: 'UAH',
        type: 'EXPENSE',
        categoryId: 11,
        account: { id: 2, name: 'Картка «Універсальна»', currency: 'UAH', created: false },
        tagIds: [],
        duplicate: true,
      },
    ],
  },
};

const base = {
  'GET /api/v1/accounts': () => json(accounts),
  'GET /api/v1/categories': () => json(categories),
  'GET /api/v1/tags': () => json([]),
};

function renderPage() {
  setAccessToken('token');
  return renderWithProviders(<ImportsPage />);
}

it('connects Monobank with a token and a daily schedule', async () => {
  const requests = mockApi({
    ...base,
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
    'POST /api/v1/banks/monobank': () => json(connection),
  });
  renderPage();

  await userEvent.click(await screen.findByRole('button', { name: 'Підключити' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Особистий токен'), 'u-secret');
  await userEvent.click(within(dialog).getByText('Раз на день'));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Підключити' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/banks/monobank')).toMatchObject({
    token: 'u-secret',
    syncMode: 'DAILY',
    dailyAt: '06:00',
  });
});

it('shows the difference, changes the schedule and stops syncing a card', async () => {
  const requests = mockApi({
    ...base,
    'GET /api/v1/banks/monobank': () => json(connection),
    'PUT /api/v1/banks/monobank/schedule': () => json(connection),
    'PUT /api/v1/banks/monobank/accounts/7': () => json(connection),
  });
  renderPage();

  expect(await screen.findByText('Банк показує більше: бракує доходів?')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Раз на день'));
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти розклад' }));
  await waitFor(() => expect(requests.some((request) => request.url.endsWith('/schedule'))).toBe(true));
  expect(await bodyOf(requests, 'PUT', '/api/v1/banks/monobank/schedule')).toEqual({
    syncMode: 'DAILY',
    windowStart: '08:00',
    windowEnd: '23:00',
    dailyAt: '06:00',
  });

  const link = screen.getAllByLabelText('Рахунок для Чорна').find((element) => element.tagName === 'INPUT')!;
  await userEvent.clear(link);
  await userEvent.type(link, 'Не синхр');
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await waitFor(() => expect(requests.some((request) => request.url.endsWith('/accounts/7'))).toBe(true));
  expect(await bodyOf(requests, 'PUT', '/api/v1/banks/monobank/accounts/7')).toEqual({ accountId: null });
});

it('reviews a PrivatBank statement before importing it', async () => {
  const requests = mockApi({
    ...base,
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
    'POST /api/v1/imports/privatbank/preview': () => json(preview),
    [`POST /api/v1/imports/previews/${preview.id}/confirm`]: () =>
      json({ transactionsImported: 1, transactionsMatched: 0, warnings: [] }),
  });
  const { container } = renderPage();

  const fileInput = container.querySelector('#privatbank input[type="file"]') as HTMLInputElement;
  await userEvent.upload(fileInput, new File(['%PDF'], 'statement.pdf', { type: 'application/pdf' }));
  const card = container.querySelector('#privatbank') as HTMLElement;
  await userEvent.click(within(card).getByRole('button', { name: 'Завантажити й переглянути' }));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Дублікат — уже є в обліку')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Імпортувати Сільпо')).not.toBeChecked();

  const category = within(dialog).getByLabelText('Категорія: LIQPAY*Prom');
  await userEvent.type(category, 'Продукти');
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await userEvent.click(within(dialog).getByLabelText('Запам’ятати як правило'));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Імпортувати 1 операцію' }));

  expect(await within(dialog).findByText('Імпортовано операцій')).toBeInTheDocument();
  const confirm = await bodyOf(requests, 'POST', `/api/v1/imports/previews/${preview.id}/confirm`);
  // The duplicate is never imported, so it is not sent; the changed row carries all its values.
  expect((confirm as { operations: unknown[] }).operations).toEqual([
    expect.objectContaining({
      key: 'op-1',
      include: true,
      categoryId: 11,
      keepSuggestedCategory: false,
      rememberRule: true,
      type: 'EXPENSE',
      tagIds: [],
    }),
  ]);
});

it('previews a Zen Money import by token', async () => {
  const requests = mockApi({
    ...base,
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
    'POST /api/v1/imports/zenmoney/preview': () => json({ ...preview, source: 'ZENMONEY' }),
  });
  renderPage();

  await userEvent.type(await screen.findByLabelText('API-токен Дзен-мані'), 'zen-token');
  await userEvent.click(screen.getByRole('button', { name: 'Імпортувати з Дзен-мані' }));

  expect(await screen.findByText('Перегляд перед імпортом')).toBeInTheDocument();
  expect(await bodyOf(requests, 'POST', '/api/v1/imports/zenmoney/preview')).toEqual({ token: 'zen-token' });
});

it('merges expenses and incomes into transfers: exact matches chosen, the rest on request', async () => {
  const account = (id: number, name: string) => ({ id, name, currency: 'UAH', created: false });
  const operation = (key: string, type: string, amount: number, onAccount: ReturnType<typeof account>) => ({
    key,
    date: '2026-10-20',
    comment: key,
    amount,
    currency: 'UAH',
    type,
    account: onAccount,
    tagIds: [],
    duplicate: false,
    transferLike: true,
  });
  const suggestion = (
    target: { operationKey?: string; transactionId?: number },
    amount: number,
    difference: number,
  ) => ({
    ...target,
    date: '2026-10-20',
    accountName: 'Monobank',
    amount,
    currency: 'UAH',
    exact: difference === 0,
    difference,
  });
  const universal = account(2, 'Картка «Універсальна»');
  const black = account(1, 'Чорна картка');
  const withPairs = {
    ...preview,
    summary: { ...preview.summary, transactionsImported: 3 },
    operations: {
      ...preview.operations,
      totalItems: 3,
      items: [
        {
          ...operation('На Монобанк', 'EXPENSE', 5000, universal),
          transferSuggestions: [suggestion({ transactionId: 99 }, 5000, 0)],
        },
        {
          ...operation('Зі своєї картки', 'INCOME', 9650, universal),
          transferSuggestions: [
            suggestion({ operationKey: 'На ФОП' }, 10000, -0.035),
            suggestion({ transactionId: 77 }, 9800, -0.0153),
          ],
        },
        {
          ...operation('На ФОП', 'EXPENSE', 10000, black),
          transferSuggestions: [suggestion({ operationKey: 'Зі своєї картки' }, 9650, -0.035)],
        },
      ],
    },
  };
  const requests = mockApi({
    ...base,
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
    'POST /api/v1/imports/zenmoney/preview': () => json({ ...withPairs, source: 'ZENMONEY' }),
    [`POST /api/v1/imports/previews/${preview.id}/confirm`]: () =>
      json({ transactionsImported: 2, transactionsMatched: 0, warnings: [] }),
  });
  renderPage();
  await userEvent.type(await screen.findByLabelText('API-токен Дзен-мані'), 'zen-token');
  await userEvent.click(screen.getByRole('button', { name: 'Імпортувати з Дзен-мані' }));
  const dialog = await screen.findByRole('dialog');

  // The exact match is chosen, the one within 10 % waits for the user
  expect(within(dialog).getByText(/Знайдено 2 можливі перекази .* об’єднати: 1\./)).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Об’єднати в переказ: На Монобанк')).toBeChecked();
  expect(within(dialog).getByLabelText('Об’єднати в переказ: Зі своєї картки')).not.toBeChecked();

  await userEvent.click(within(dialog).getByLabelText('Об’єднати в переказ: Зі своєї картки'));
  // The other half in the file is merged with it too, and the best match is offered first
  expect(within(dialog).getByLabelText('Об’єднати в переказ: На ФОП')).toBeChecked();
  expect(within(dialog).getByText(/об’єднати: 2\./)).toBeInTheDocument();
  const choices = within(dialog).getAllByLabelText('З операцією') as HTMLInputElement[];
  expect(choices.map((input) => plain(input.value))).toContainEqual(
    expect.stringMatching(/^Monobank · [-−]10 000,00 ₴ · 20 жовт\. · з цього файлу · менше на 3,5 ?%$/),
  );

  await userEvent.click(within(dialog).getByRole('button', { name: 'Імпортувати 3 операції' }));
  expect(await within(dialog).findByText('Імпортовано операцій')).toBeInTheDocument();
  const confirm = (await bodyOf(requests, 'POST', `/api/v1/imports/previews/${preview.id}/confirm`)) as {
    operations: unknown[];
  };
  expect(confirm.operations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'На Монобанк', pairTransactionId: 99 }),
      expect.objectContaining({ key: 'Зі своєї картки', pairKey: 'На ФОП' }),
      expect.objectContaining({ key: 'На ФОП', pairKey: 'Зі своєї картки' }),
    ]),
  );
});
