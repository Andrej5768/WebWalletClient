import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { accountOf, tradedInstrumentOf, portfolioOf, positionDetailOf } from '../../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../../test/render';

const broker = accountOf({
  id: 3,
  name: 'Interactive Brokers',
  type: 'INVESTMENT',
  currency: 'USD',
  inBudget: false,
});

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json([broker]),
    'GET /api/v1/investments/portfolio': () =>
      json(portfolioOf({ cash: [{ accountId: 3, currency: 'USD', amount: 1200, amountInBase: 49560 }] })),
    'GET /api/v1/investments/instruments/7': () => json(tradedInstrumentOf()),
    ...extra,
  });
}

async function drawer() {
  return within(await screen.findByRole('dialog'));
}

it('buys a market instrument found by a search, adding it first', async () => {
  const requests = api({
    'GET /api/v1/investments/instruments/search': () =>
      json({
        providerEnabled: true,
        results: [
          {
            id: null,
            symbol: 'AAPL',
            name: 'Apple Inc',
            type: 'STOCK',
            currency: 'USD',
            exchange: 'NASDAQ',
            micCode: 'XNGS',
            country: 'United States',
          },
        ],
      }),
    'POST /api/v1/investments/instruments/market': () => json(tradedInstrumentOf()),
    'POST /api/v1/investments/operations': () => json({}, 201),
  });
  renderApp('/investments?operation=new&accountId=3');

  const panel = await drawer();
  await waitFor(() =>
    expect(plain((panel.getByLabelText('Брокерський рахунок') as HTMLInputElement).value)).toContain(
      '1 200,00',
    ),
  );
  await userEvent.type(panel.getByLabelText('Інструмент'), 'AAPL');
  await userEvent.click(await panel.findByText('Apple Inc'));
  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', '/api/v1/investments/instruments/market')).toEqual({
      symbol: 'AAPL',
      micCode: 'XNGS',
    }),
  );
  await userEvent.type(panel.getByLabelText('Кількість'), '3');
  await userEvent.type(panel.getByLabelText('Ціна за штуку'), '220');
  await userEvent.type(panel.getByRole('textbox', { name: 'Комісія' }), '1');
  expect(plain(panel.getByTestId('operation-total').textContent)).toContain('660,00');
  await userEvent.click(panel.getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', '/api/v1/investments/operations')).toMatchObject({
      type: 'BUY',
      accountId: 3,
      instrumentId: 7,
      quantity: 3,
      price: 220,
      fee: 1,
      amount: 660,
    }),
  );
});

it('previews the lots a sale closes and shows a shortfall on the field', async () => {
  api({
    'GET /api/v1/investments/positions': () =>
      json(
        positionDetailOf({
          quantity: 15,
          averagePrice: 166.7,
          lots: [
            {
              operationId: 1,
              date: '2026-01-10',
              quantity: 10,
              remaining: 5,
              unitCost: 100.1,
              unrealized: 599.5,
            },
            {
              operationId: 2,
              date: '2026-06-10',
              quantity: 10,
              remaining: 10,
              unitCost: 200,
              unrealized: 200,
            },
          ],
        }),
      ),
    'POST /api/v1/investments/operations': () =>
      json(
        {
          status: 400,
          code: 'VALIDATION_FAILED',
          errors: [{ field: 'quantity', message: 'На цю дату продається більше, ніж є в наявності' }],
        },
        400,
      ),
  });
  renderApp('/investments?operation=new&accountId=3&instrumentId=7&type=SELL');

  const panel = await drawer();
  await userEvent.type(await panel.findByLabelText('Кількість'), '8');
  await userEvent.type(panel.getByLabelText('Ціна за штуку'), '250');
  await userEvent.type(panel.getByRole('textbox', { name: 'Комісія' }), '2');

  expect(await panel.findByText('Які лоти закриє продаж (FIFO)')).toBeInTheDocument();
  expect(plain(panel.getByText('Реалізований прибуток').parentElement?.textContent)).toContain('+897,50');
  expect(plain(panel.getByText('За середньою ціною було б').parentElement?.textContent)).toContain('+664,40');

  await userEvent.click(panel.getByRole('button', { name: 'Зберегти' }));
  expect(await panel.findByText('На цю дату продається більше, ніж є в наявності')).toBeInTheDocument();
});

it('records a dividend with the withheld tax', async () => {
  const requests = api({ 'POST /api/v1/investments/operations': () => json({}, 201) });
  renderApp('/investments?operation=new&accountId=3&instrumentId=7&type=DIVIDEND');

  const panel = await drawer();
  await userEvent.type(await panel.findByLabelText('Нараховано'), '10');
  await userEvent.type(panel.getByLabelText(/Утримано податок/), '1,5');
  expect(panel.getByText('15 % у США за W-8BEN')).toBeInTheDocument();
  expect(plain(panel.getByTestId('operation-total').textContent)).toContain('8,50');
  await userEvent.click(panel.getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', '/api/v1/investments/operations')).toMatchObject({
      type: 'DIVIDEND',
      instrumentId: 7,
      amount: 10,
      tax: 1.5,
    }),
  );
});

it('adds an instrument by hand from the drawer', async () => {
  const requests = api({
    'GET /api/v1/investments/instruments/9': () =>
      json(
        tradedInstrumentOf({ id: 9, symbol: 'UA4000227045', name: 'ОВДП 22.07.2027', currency: 'UAH', own: true }),
      ),
    'POST /api/v1/investments/instruments': () =>
      json(
        tradedInstrumentOf({ id: 9, symbol: 'UA4000227045', name: 'ОВДП 22.07.2027', currency: 'UAH', own: true }),
        201,
      ),
  });
  renderApp('/investments?operation=new&accountId=3');

  const panel = await drawer();
  await userEvent.click(await panel.findByRole('button', { name: /Додати вручну/ }));
  const editor = within((await screen.findAllByRole('dialog')).at(-1)!);
  await userEvent.type(editor.getByLabelText('Назва'), 'ОВДП 22.07.2027');
  await userEvent.type(editor.getByLabelText('Позначення'), 'UA4000227045');
  await userEvent.type(editor.getByLabelText('ISIN'), 'UA4000227045');
  await userEvent.type(editor.getByLabelText(/Купон, річних/), '15,2');
  await userEvent.click(editor.getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', '/api/v1/investments/instruments')).toMatchObject({
      name: 'ОВДП 22.07.2027',
      symbol: 'UA4000227045',
      isin: 'UA4000227045',
      type: 'GOVERNMENT_BOND',
      currency: 'UAH',
      valuation: 'NOMINAL',
      nominal: 1000,
      couponRate: 15.2,
      couponFrequency: 2,
    }),
  );
  expect(await panel.findByText('ОВДП 22.07.2027')).toBeInTheDocument();
});
