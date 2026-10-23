import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  brokerOf,
  investmentOperationOf,
  portfolioOf,
  positionDetailOf,
  tradedOf as traded,
} from '../../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../../test/render';

const broker = brokerOf();

const detail = positionDetailOf({
  quantity: 15,
  averagePrice: 166.7,
  price: 220,
  value: 3300,
  cost: 2500.5,
  unrealized: 799.5,
  realized: 749.5,
  dividends: 8.5,
  lots: [
    { operationId: 5, date: '2025-12-01', quantity: 5, remaining: 0, unitCost: 90, unrealized: null },
    { operationId: 1, date: '2026-01-10', quantity: 10, remaining: 5, unitCost: 100.1, unrealized: 599.5 },
    { operationId: 2, date: '2026-06-10', quantity: 10, remaining: 10, unitCost: 200, unrealized: 200 },
  ],
  operations: [
    investmentOperationOf({
      id: 9,
      type: 'DIVIDEND',
      date: '2026-08-14',
      quantity: null,
      price: null,
      amount: 10,
      tax: 1.5,
      cash: 8.5,
    }),
    investmentOperationOf({ id: 2, date: '2026-06-10', quantity: 10, price: 200, amount: 2000, cash: -2000 }),
    investmentOperationOf({ id: 1, date: '2026-01-10', fee: 1, cash: -1001 }),
  ],
});

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json([broker]),
    'GET /api/v1/investments/instruments/7': () => json(traded()),
    'GET /api/v1/investments/portfolio': () =>
      json(
        portfolioOf({
          positions: [
            {
              accountId: 3,
              instrument: traded(),
              quantity: 15,
              averagePrice: 166.7,
              price: 220,
              priceDate: '2026-10-15',
              dayChange: 2.5,
              value: 3300,
              cost: 2500.5,
              unrealized: 799.5,
              unrealizedShare: 0.32,
              valueInBase: 136290,
              share: 1,
            },
          ],
          cash: [{ accountId: 3, currency: 'USD', amount: 1200, amountInBase: 49560 }],
        }),
      ),
    'GET /api/v1/investments/positions': () => json(detail),
    'GET /api/v1/investments/instruments/7/prices': () =>
      json([
        { date: '2026-10-14', close: 217.5 },
        { date: '2026-10-15', close: 220 },
      ]),
    ...extra,
  });
}

it('shows the position, its lots, operations and dividends', async () => {
  api();
  renderApp('/investments/instruments/7');

  expect(await screen.findByRole('heading', { name: 'Apple Inc' })).toBeInTheDocument();
  expect(await screen.findByText('Середня ціна')).toBeInTheDocument();
  expect(plain(screen.getByText('Середня ціна').parentElement?.textContent)).toContain('166,70');
  expect(plain(screen.getByText('Реалізований').parentElement?.textContent)).toContain('+749,50');
  expect(screen.getByText(/рахуються за FIFO по лотах/)).toBeInTheDocument();

  // The first lot is sold off, the second half sold
  expect(within(screen.getByTestId('lot-5')).getByText('реалізовано')).toBeInTheDocument();
  expect(within(screen.getByTestId('lot-1')).getByText('5 з 10')).toBeInTheDocument();
  expect(plain(screen.getByTestId('lot-1').textContent)).toContain('+599,50');

  await userEvent.click(screen.getByRole('tab', { name: 'Дивіденди' }));
  expect(await screen.findByText('За 12 місяців отримано')).toBeInTheDocument();
  expect(plain(screen.getByText('За 12 місяців отримано').parentElement?.textContent)).toContain('8,50');

  await userEvent.click(screen.getByRole('tab', { name: 'Операції' }));
  expect(await screen.findAllByText('Купівля', { selector: 'td' })).toHaveLength(2);
});

it('opens the operation drawer for a sale and edits a manual instrument', async () => {
  const requests = api({
    'GET /api/v1/investments/instruments/7': () =>
      json(
        traded({
          symbol: 'UA4000227045',
          name: 'ОВДП 22.07.2027',
          type: 'GOVERNMENT_BOND',
          currency: 'UAH',
          valuation: 'MANUAL',
          own: true,
          price: 990,
          priceDate: '2026-10-01',
        }),
      ),
    'PUT /api/v1/investments/instruments/7': () =>
      json(traded({ own: true, valuation: 'MANUAL', price: 995 })),
  });
  const router = renderApp('/investments/instruments/7?accountId=3');

  await userEvent.click(await screen.findByRole('button', { name: 'Змінити ціну' }));
  const dialog = await screen.findByRole('dialog');
  const price = within(dialog).getByLabelText(/Ціна за штуку/);
  await userEvent.clear(price);
  await userEvent.type(price, '995');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/investments/instruments/7')).toMatchObject({
      valuation: 'MANUAL',
      manualPrice: 995,
      currency: 'UAH',
    }),
  );

  // The drawer opens on the instrument page itself, so the instrument stays in view
  await userEvent.click(screen.getByRole('button', { name: 'Продати' }));
  await waitFor(() =>
    expect(router.state.location.search).toBe(
      '?accountId=3&operation=new&operationType=SELL&operationInstrumentId=7&operationAccountId=3',
    ),
  );
  expect(router.state.location.pathname).toBe('/investments/instruments/7');
});
