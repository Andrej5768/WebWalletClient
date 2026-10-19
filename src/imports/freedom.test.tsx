import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setAccessToken } from '../api/session';
import { accountOf } from '../test/fixtures';
import { bodyOf, json, mockApi, plain, renderWithProviders } from '../test/render';
import type { BrokerOperation, BrokerPreview } from './api';
import { cashAfter, choiceRequest, filterOf, quantityAfter } from './broker';
import { ImportsPage } from './ImportsPage';

function row(overrides: Partial<BrokerOperation>): BrokerOperation {
  return {
    key: 'trade:1',
    date: '2030-02-01',
    type: 'BUY',
    ticker: null,
    quantity: null,
    price: null,
    amount: 0,
    fee: 0,
    tax: 0,
    currency: 'USD',
    cash: 0,
    toAmount: null,
    toCurrency: null,
    description: '',
    status: 'NEW',
    skip: null,
    ...overrides,
  };
}

const preview: BrokerPreview = {
  id: 'b0b0b0b0-0000-4000-8000-000000000001',
  source: 'FREEDOM',
  expiresAt: '2030-03-15T13:00:00Z',
  account: { id: null, name: 'Freedom Finance', currency: 'USD' },
  from: '2030-01-10',
  to: '2030-03-02',
  instruments: [
    {
      ticker: 'SCHD.US',
      currency: 'USD',
      suggestion: {
        instrumentId: null,
        symbol: 'SCHD',
        micCode: 'ARCX',
        name: 'Schwab US Dividend Equity ETF',
        type: 'ETF',
        currency: 'USD',
        exchange: 'NYSE ARCA',
        manual: false,
      },
      quantityAfter: 6,
      shortfall: false,
    },
    {
      ticker: 'FXUS',
      currency: 'RUB',
      suggestion: {
        instrumentId: null,
        symbol: 'FXUS',
        micCode: null,
        name: 'FXUS',
        type: 'STOCK',
        currency: 'RUB',
        exchange: null,
        manual: true,
      },
      quantityAfter: 0,
      shortfall: false,
    },
  ],
  operations: [
    row({
      key: 'cash:9',
      date: '2030-03-02',
      type: null,
      amount: -50,
      cash: -50,
      description: 'Blocking: Lock. Withdrawal of funds',
      status: 'SKIPPED',
      skip: 'SERVICE',
    }),
    row({
      key: 'cash:6',
      date: '2030-03-01',
      type: 'DIVIDEND',
      ticker: 'SCHD.US',
      amount: 1.5,
      tax: 0.23,
      cash: 1.27,
    }),
    row({
      key: 'trade:105',
      date: '2030-02-10',
      type: 'SELL',
      ticker: 'SCHD.US',
      quantity: 4,
      price: 30,
      amount: 120,
      fee: 2,
      cash: 118,
    }),
    row({
      key: 'trade:102',
      date: '2030-02-02',
      type: 'EXCHANGE',
      amount: 100,
      currency: 'EUR',
      cash: -100,
      toAmount: 110,
      toCurrency: 'USD',
    }),
    row({
      key: 'trade:101',
      date: '2030-02-01',
      type: 'BUY',
      ticker: 'SCHD.US',
      quantity: 10,
      price: 25,
      amount: 250,
      fee: 2,
      cash: -252,
    }),
    row({
      key: 'cash:1',
      date: '2030-01-10',
      type: 'DEPOSIT',
      amount: 500,
      cash: 500,
      description: 'Deposit with a bank card',
      status: 'DUPLICATE',
    }),
  ],
  cash: [
    { currency: 'EUR', amount: -100 },
    { currency: 'USD', amount: 477.27 },
  ],
  merged: 3,
  providerUnavailable: false,
};

it('groups the rows and counts what an exclusion changes', () => {
  expect(preview.operations.map(filterOf)).toEqual([
    'skipped',
    'income',
    'trades',
    'trades',
    'trades',
    'skipped',
  ]);
  const excluded = new Set(['trade:105', 'trade:102']);
  expect(quantityAfter(preview.instruments[0]!, preview.operations, excluded)).toBe(10);
  expect(cashAfter(preview.cash, preview.operations, excluded)).toEqual([
    { currency: 'EUR', amount: 0 },
    { currency: 'USD', amount: 249.27 },
  ]);
  expect(
    choiceRequest(
      new Map([
        ['SCHD.US', { kind: 'suggested' }],
        ['FXUS', { kind: 'other', instrument: { id: 9, label: 'FXUS' } }],
        ['ICLN.US', { kind: 'manual' }],
      ] as const),
    ),
  ).toEqual([
    { ticker: 'FXUS', instrumentId: 9 },
    { ticker: 'ICLN.US', manual: true },
  ]);
});

it('previews Freedom Finance reports and imports them without the excluded rows', async () => {
  const requests = mockApi({
    'GET /api/v1/accounts': () =>
      json([accountOf({ id: 4, name: 'Interactive Brokers', type: 'INVESTMENT', currency: 'USD' })]),
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
    'POST /api/v1/imports/freedom/preview': () => json(preview),
    [`POST /api/v1/imports/freedom/previews/${preview.id}/confirm`]: () =>
      json({
        accountId: 12,
        accountCreated: true,
        instrumentsCreated: 1,
        operationsImported: 3,
        duplicates: 1,
      }),
  });
  setAccessToken('token');
  const { container } = renderWithProviders(<ImportsPage />);

  const card = (await waitFor(() => container.querySelector('#freedom'))) as HTMLElement;
  const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const [trades, cash] = card.querySelectorAll('input[type="file"]');
  await userEvent.upload(trades as HTMLInputElement, new File(['t'], 'Trades.xlsx', { type: xlsx }));
  await userEvent.upload(cash as HTMLInputElement, new File(['c'], 'cash.xlsx', { type: xlsx }));
  await userEvent.click(within(card).getByRole('button', { name: 'Завантажити й переглянути' }));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText(/новий рахунок «Freedom Finance»/)).toBeInTheDocument();
  expect(within(dialog).getByText('4 операції')).toBeInTheDocument();
  expect(within(dialog).getByText('1 вже імпортована')).toBeInTheDocument();
  expect(within(dialog).getByText('1 інструмент створюється вручну')).toBeInTheDocument();
  expect(within(dialog).getByText('Немає у провайдера')).toBeInTheDocument();
  expect(within(dialog).getByText('EUR → USD')).toBeInTheDocument();
  expect(within(dialog).getByText('Службовий рядок')).toBeInTheDocument();
  expect(within(dialog).getByText('Вже імпортовано')).toBeInTheDocument();
  expect(plain(within(dialog).getByText(/Після імпорту на рахунку/).textContent)).toContain(
    'SCHD.US — 6 шт.',
  );

  // Leaving the sale out keeps 10 units
  await userEvent.click(within(dialog).getByLabelText('Імпортувати: SCHD.US, 10.02.2030'));
  expect(plain(within(dialog).getByText(/Після імпорту на рахунку/).textContent)).toContain(
    'SCHD.US — 10 шт.',
  );
  await userEvent.click(within(dialog).getByRole('button', { name: 'Імпортувати 3 операції' }));

  expect(await within(dialog).findByText('операцій імпортовано')).toBeInTheDocument();
  expect(within(dialog).getByRole('link', { name: 'Перейти до інвестицій' })).toHaveAttribute(
    'href',
    '/investments?accountId=12',
  );
  expect(await bodyOf(requests, 'POST', `/api/v1/imports/freedom/previews/${preview.id}/confirm`)).toEqual({
    instruments: [],
    excluded: ['trade:105'],
  });
  const upload = requests.find((request) => request.url.includes('/imports/freedom/preview'))!;
  const body = await upload.text();
  expect(body.match(/name="files"/g)).toHaveLength(2);
});
