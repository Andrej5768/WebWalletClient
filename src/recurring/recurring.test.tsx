import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isoDate, kyivToday } from '../lib/periods';
import { accountOf, occurrenceOf, recurringOf, splitOf, transactionOf } from '../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../test/render';

const today = kyivToday();
const day = (offset: number) => isoDate(today.add(offset, 'day'));

const accounts = [
  accountOf({ id: 1, name: 'Чорна картка', balance: 18452.37, balanceInBase: 18452.37 }),
  accountOf({ id: 2, name: 'Банка «Відпустка»', type: 'SAVINGS', balance: 32000, balanceInBase: 32000 }),
];

const occurrences = [
  occurrenceOf({ recurringId: 3, name: 'Київстар', date: day(-5), overdue: true, amount: 180 }),
  occurrenceOf({ recurringId: 4, name: 'Кишенькові', date: day(4), amount: 500, autoCreate: true }),
  occurrenceOf({ recurringId: 5, name: 'Комунальні', date: day(5), amount: 2300, variableAmount: true }),
  occurrenceOf({ recurringId: 1, name: 'Оренда', date: day(9), amount: 14000 }),
  occurrenceOf({ recurringId: 6, name: 'Зарплата', date: day(15), type: 'INCOME', amount: 52000 }),
];

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/recurring/occurrences': () => json(occurrences),
    ...extra,
  });
}

it('shows only the nearest planned payments above today until asked for more', async () => {
  api();
  renderApp('/transactions');

  expect(await screen.findByText(/Заплановано до .* 5 платежів/)).toBeInTheDocument();
  expect(screen.getByText('Київстар')).toBeInTheDocument();
  expect(screen.getByText('Не знайдено в банку')).toBeInTheDocument();
  expect(screen.getByText('Кишенькові')).toBeInTheDocument();
  expect(screen.getByText('Створиться автоматично')).toBeInTheDocument();
  expect(screen.getByText('Комунальні')).toBeInTheDocument();
  expect(screen.queryByText('Оренда')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Ще 2/ }));
  expect(screen.getByText('Оренда')).toBeInTheDocument();
  expect(screen.getByText('Зарплата')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Згорнути до найближчих' }));
  expect(screen.queryByText('Оренда')).not.toBeInTheDocument();
});

it('saves a planned payment as a transaction, asking for a varying amount', async () => {
  const requests = api({
    [`POST /api/v1/recurring/3/occurrences/${day(-5)}/confirm`]: () =>
      json({ ...occurrences[0], status: 'PAID', transactionId: 9 }),
    [`POST /api/v1/recurring/5/occurrences/${day(5)}/confirm`]: () =>
      json({ ...occurrences[2], status: 'PAID', transactionId: 10 }),
  });
  renderApp('/transactions');

  // The overdue one has the action inline
  await userEvent.click(await screen.findByRole('button', { name: 'Зберегти як операцію' }));
  await waitFor(() =>
    expect(
      requests.some((request) => request.url.endsWith(`/recurring/3/occurrences/${day(-5)}/confirm`)),
    ).toBe(true),
  );

  await userEvent.click(screen.getByRole('button', { name: 'Дії з платежем «Комунальні»' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Зберегти як операцію' }));
  const dialog = await screen.findByRole('dialog');
  const amount = within(dialog).getByLabelText('Сума');
  await userEvent.clear(amount);
  await userEvent.type(amount, '2140,36');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти як операцію' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', `/api/v1/recurring/5/occurrences/${day(5)}/confirm`)).toMatchObject(
      {
        amount: 2140.36,
        date: today.format('YYYY-MM-DD'),
      },
    ),
  );
});

it('links a planned payment to an existing transaction', async () => {
  const candidate = transactionOf({
    id: 42,
    date: day(-6),
    accountId: 1,
    amount: 200,
    payee: { id: 8, name: 'LIQPAY*KYIVSTAR' },
    splits: [splitOf({ amount: 200 })],
  });
  const requests = api({
    [`GET /api/v1/recurring/3/occurrences/${day(-5)}/candidates`]: () => json([candidate]),
    [`POST /api/v1/recurring/3/occurrences/${day(-5)}/link`]: () =>
      json({ ...occurrences[0], status: 'PAID', transactionId: 42 }),
    'GET /api/v1/recurring': () => json([recurringOf({ id: 3, name: 'Київстар', amount: 180 })]),
    'PUT /api/v1/recurring/3': () => json(recurringOf({ id: 3, amount: 200 })),
  });
  renderApp('/transactions');

  await userEvent.click(await screen.findByRole('button', { name: 'Дії з платежем «Київстар»' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Пов’язати з операцією' }));
  const dialog = await screen.findByRole('dialog');
  expect(await within(dialog).findByText(/сума більша на 20,00 ₴ \(11 %\)/)).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole('radio'));
  await userEvent.click(within(dialog).getByLabelText(/Оновити суму серії до 200,00 ₴/));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Пов’язати' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', `/api/v1/recurring/3/occurrences/${day(-5)}/link`)).toEqual({
    transactionId: 42,
  });
  expect(await bodyOf(requests, 'PUT', '/api/v1/recurring/3')).toMatchObject({
    amount: 200,
    name: 'Київстар',
  });
});

it('lists the recurring payments and creates one', async () => {
  const requests = api({
    'GET /api/v1/recurring': () =>
      json([
        recurringOf({ id: 1, name: 'Оренда', startDate: '2026-09-24', nextDate: day(9), autoCreate: true }),
        recurringOf({
          id: 7,
          name: 'Spotify',
          startDate: '2026-05-05',
          nextDate: null,
          endDate: '2026-09-05',
          amount: 5.99,
          currency: 'USD',
        }),
      ]),
    'POST /api/v1/recurring': () => json(recurringOf({ id: 8 }), 201),
  });
  renderApp('/transactions');

  await userEvent.click(await screen.findByRole('button', { name: 'Регулярні' }));
  const drawer = await screen.findByRole('dialog');
  expect(await within(drawer).findByText('Оренда')).toBeInTheDocument();
  expect(within(drawer).getByText(/щомісяця 24-го · Чорна картка/)).toBeInTheDocument();
  expect(within(drawer).getByText('Автоматично')).toBeInTheDocument();
  expect(within(drawer).getByText('Зупинені')).toBeInTheDocument();

  await userEvent.click(within(drawer).getByRole('button', { name: 'Новий платіж' }));
  await userEvent.type(await within(drawer).findByLabelText('Назва'), 'Інтернет');
  await userEvent.type(within(drawer).getByLabelText('Сума'), '250');
  await userEvent.click(within(drawer).getByLabelText('Рахунок'));
  await userEvent.click(await screen.findByRole('option', { name: 'Чорна картка', hidden: true }));
  await userEvent.click(within(drawer).getByRole('radio', { name: /Створювати автоматично/ }));
  await userEvent.click(within(drawer).getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', '/api/v1/recurring')).toMatchObject({
      name: 'Інтернет',
      type: 'EXPENSE',
      accountId: 1,
      amount: 250,
      frequency: 'MONTHLY',
      interval: 1,
      startDate: today.format('YYYY-MM-DD'),
      autoCreate: true,
      tolerance: 10,
    }),
  );
});

it('marks transactions that pay a recurring payment and folds the filters away', async () => {
  api({
    'GET /api/v1/transactions': () =>
      json({
        items: [
          transactionOf({
            id: 5,
            date: day(0),
            amount: 9.99,
            payee: { id: 1, name: 'Netflix' },
            splits: [splitOf({ categoryId: 1, amount: 9.99 })],
            recurring: { id: 9, name: 'Netflix', dueDate: day(0) },
          }),
        ],
        page: 0,
        size: 50,
        totalItems: 1,
        totalPages: 1,
      }),
  });
  renderApp('/transactions');

  expect(await screen.findByText('регулярний')).toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: 'Фільтри' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
});

it('opens a transfer to a given account from a link', async () => {
  api();
  renderApp('/transactions?new=1&newType=TRANSFER&toAccountId=2');

  const drawer = await screen.findByRole('dialog');
  expect(await within(drawer).findByRole('radio', { name: 'Переказ' })).toBeChecked();
  expect(plain((within(drawer).getByLabelText('На рахунок') as HTMLInputElement).value)).toBe(
    'Банка «Відпустка» · 32 000,00 ₴',
  );
});

it('keeps what the editor does not show when a series is saved', async () => {
  const requests = api({
    'GET /api/v1/recurring': () =>
      json([
        recurringOf({
          id: 1,
          name: 'Оренда',
          comment: 'Договір до 2027',
          payee: { id: 4, name: 'Landlord' },
        }),
      ]),
    'PUT /api/v1/recurring/1': () => json(recurringOf({ id: 1 })),
  });
  renderApp('/transactions?recurring=1');

  const drawer = await screen.findByRole('dialog');
  const name = await within(drawer).findByLabelText('Назва');
  await userEvent.clear(name);
  await userEvent.type(name, 'Оренда квартири');
  await userEvent.click(within(drawer).getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/recurring/1')).toMatchObject({
      name: 'Оренда квартири',
      comment: 'Договір до 2027',
      payeeName: 'Landlord',
    }),
  );
  expect(await bodyOf(requests, 'PUT', '/api/v1/recurring/1')).not.toHaveProperty('payeeId');
});

it('moves a weekly payment to the chosen day of the week', async () => {
  const requests = api({
    'GET /api/v1/recurring': () =>
      json([recurringOf({ id: 1, name: 'Спортзал', frequency: 'WEEKLY', startDate: '2026-10-19' })]),
    'PUT /api/v1/recurring/1': () => json(recurringOf({ id: 1 })),
  });
  renderApp('/transactions?recurring=1');

  const drawer = await screen.findByRole('dialog');
  // 2026-10-19 is a Monday; the first Friday from it is the 23rd
  expect(await within(drawer).findByRole('radio', { name: 'пн' })).toBeChecked();
  await userEvent.click(within(drawer).getByRole('radio', { name: 'пт' }));
  expect(within(drawer).getByText('Перший платіж: 23 жовт.')).toBeInTheDocument();
  await userEvent.click(within(drawer).getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/recurring/1')).toMatchObject({
      frequency: 'WEEKLY',
      startDate: '2026-10-23',
    }),
  );
});
