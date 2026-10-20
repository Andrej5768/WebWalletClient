import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { kyivToday } from '../../lib/periods';
import {
  accountOf,
  historyOf,
  instrumentOf,
  portfolioOf,
  positionDetailOf,
  positionOf,
} from '../../test/fixtures';
import { json, mockApi, plain, renderApp, signedInApi } from '../../test/render';
import { rangeFrom, result } from './model';

const accounts = [
  accountOf({ id: 1, name: 'Interactive Brokers', type: 'INVESTMENT', currency: 'USD' }),
  accountOf({ id: 2, name: 'Freedom Finance', type: 'INVESTMENT', currency: 'USD' }),
];

const portfolio = portfolioOf({
  value: 270000,
  deposited: 240000,
  invested: 220000,
  unrealized: 40000,
  unrealizedShare: 0.1818,
  realizedThisYear: 15880,
  dividendsLast12Months: 20656,
  dayChange: -1200,
  pricesAsOf: '2026-10-15',
  byType: [
    { key: 'ETF', value: 180000, share: 0.6667 },
    { key: 'CASH', value: 90000, share: 0.3333 },
  ],
  byCurrency: [{ key: 'USD', value: 270000, share: 1 }],
  bySector: [
    { key: 'INFORMATION_TECHNOLOGY', value: 120000, share: 0.6667 },
    { key: 'UNKNOWN', value: 60000, share: 0.3333 },
  ],
});

const points = [
  { date: '2026-08-01', value: 100, deposited: 100, benchmark: 100 },
  { date: '2026-09-01', value: 120, deposited: 110, benchmark: 112 },
  { date: '2026-10-15', value: 150, deposited: 120, benchmark: 130 },
];

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/investments/portfolio': () => json(portfolio),
    'GET /api/v1/investments/history': (request) => {
      const benchmark = new URL(request.url).searchParams.get('benchmark');
      return json(
        historyOf({
          points: points.map((point) => ({ ...point, benchmark: benchmark ? point.benchmark : null })),
          benchmark: benchmark
            ? { key: 'SP500', symbol: 'SPY', name: 'SPDR S&P 500', pricesFrom: '2025-01-02' }
            : null,
          returns: {
            twr: 0.2134,
            twrAnnualized: null,
            xirr: 0.1876,
            benchmarkTwr: benchmark ? 0.15 : null,
            benchmarkXirr: null,
          },
        }),
      );
    },
    ...extra,
  });
}

const historyParams = (requests: Request[]) =>
  requests
    .filter((request) => request.url.includes('/investments/history'))
    .map((request) => new URL(request.url).searchParams);

it('shows the key figures, the allocation and the result of the period', async () => {
  api();
  renderApp('/investments');

  expect(await screen.findByText('Вартість портфеля', { selector: 'p' })).toBeInTheDocument();
  const unrealized = plain(screen.getByText('Нереалізований прибуток').parentElement?.textContent);
  expect(unrealized).toContain('+40 000,00 ₴');
  expect(unrealized).toContain('від собівартості 220 000,00 ₴');
  // Net deposits, with the value above them as the whole result
  const invested = plain(screen.getByText('Вкладено').parentElement?.textContent);
  expect(invested).toContain('240 000,00 ₴');
  expect(invested).toContain('результат +30 000,00 ₴');
  expect(plain(screen.getByText('Дивіденди за 12 місяців').parentElement?.textContent)).toContain(
    '20 656,00 ₴',
  );
  expect(screen.getByText(/Ціни на закриття/)).toBeInTheDocument();
  expect(screen.getByText('Класи активів')).toBeInTheDocument();
  expect(screen.getByText('Вільні кошти')).toBeInTheDocument();

  const summary = await screen.findByTestId('history-summary');
  // 150 − 100 − 20 deposited since the start: 30 on 120 at stake
  expect(plain(summary.textContent)).toContain('+30,00 ₴ · +25%');
  const returns = plain(screen.getByTestId('history-returns').textContent);
  expect(returns).toContain('Дохідність інвестицій (TWR)+21,3%');
  expect(returns).toContain('Ваша дохідність (XIRR), річних+18,8%');
  expect(screen.getByLabelText('Що таке TWR і XIRR')).toBeInTheDocument();

  expect(screen.getByText('За секторами')).toBeInTheDocument();
  expect(screen.getByText('Інформаційні технології')).toBeInTheDocument();
  expect(screen.getByText('Ще невідомо')).toBeInTheDocument();
  expect(screen.getByText(/Сектори інструментів завантажуються/)).toBeInTheDocument();
});

it('changes the period, the currency and the benchmark of the chart', async () => {
  const requests = api();
  renderApp('/investments?accountId=2');

  await screen.findByTestId('history-summary');
  const first = historyParams(requests)[0]!;
  expect(first.get('accountId')).toBe('2');
  expect(first.get('from')).toBe(rangeFrom('1y', kyivToday()));
  expect(first.get('benchmark')).toBeNull();

  await userEvent.click(screen.getByRole('radio', { name: 'Усе' }));
  await userEvent.click(screen.getByRole('radio', { name: '$' }));
  await userEvent.click(screen.getByRole('radio', { name: 'S&P 500' }));

  await waitFor(() => expect(historyParams(requests).at(-1)?.get('benchmark')).toBe('SP500'));
  const last = historyParams(requests).at(-1)!;
  expect(last.get('from')).toBeNull();
  expect(last.get('currency')).toBe('USD');
  // The key figures follow the currency too
  const portfolios = requests.filter((request) => request.url.includes('/investments/portfolio'));
  expect(new URL(portfolios.at(-1)!.url).searchParams.get('currency')).toBe('USD');
  const summary = await screen.findByTestId('history-summary');
  await waitFor(() => expect(plain(summary.textContent)).toContain('Ті самі внески в S&P 500'));
  // 30 against 10 in the index
  expect(plain(summary.textContent)).toContain('Різниця+20,00');
  expect(screen.getByText(/без реінвестування дивідендів/)).toBeInTheDocument();
});

it('says when the prices of the index are still loading', async () => {
  api({
    'GET /api/v1/investments/history': () =>
      json(
        historyOf({
          points: points.map((point) => ({ ...point, benchmark: null })),
          benchmark: { key: 'SP500', symbol: 'SPY', name: 'SPDR S&P 500', pricesFrom: null },
        }),
      ),
  });
  renderApp('/investments');

  await userEvent.click(await screen.findByRole('radio', { name: 'S&P 500' }));
  expect(await screen.findByText(/Ціни індексу завантажуються/)).toBeInTheDocument();
});

it('lists the positions with their cash and links to an instrument', async () => {
  api({
    // The instrument page the link opens
    'GET /api/v1/investments/instruments/7': () => json(instrumentOf({ id: 7 })),
    'GET /api/v1/investments/positions': () =>
      json(positionDetailOf({ instrument: instrumentOf({ id: 7 }) })),
    'GET /api/v1/investments/portfolio': () =>
      json(
        portfolioOf({
          value: 270000,
          positions: [
            positionOf({
              accountId: 1,
              instrument: instrumentOf({ id: 7, symbol: 'AAPL', name: 'Apple Inc' }),
              quantity: 25,
              averagePrice: 216.96,
              price: 247.1,
              dayChange: 1.2,
              value: 6177.5,
              cost: 5424,
              unrealized: 753.5,
              unrealizedShare: 0.1389,
              valueInBase: 255130,
              share: 0.9449,
            }),
            positionOf({
              accountId: 2,
              instrument: instrumentOf({
                id: 9,
                symbol: 'UA4000227045',
                name: 'ОВДП 22.07.2027',
                type: 'GOVERNMENT_BOND',
                currency: 'UAH',
                valuation: 'NOMINAL',
              }),
              quantity: 10,
              averagePrice: 1000,
              price: 1018.4,
              value: 10184,
              cost: 10000,
              unrealized: 184,
              valueInBase: 10184,
              share: 0.0377,
            }),
          ],
          cash: [{ accountId: 1, currency: 'USD', amount: 120.5, amountInBase: 4976.65 }],
        }),
      ),
  });
  const router = renderApp('/investments?tab=positions');

  const table = await screen.findByRole('table');
  expect(within(table).getByText('Interactive Brokers')).toBeInTheDocument();
  expect(within(table).getByText('Freedom Finance')).toBeInTheDocument();
  expect(within(table).getByText('номінал + НКД')).toBeInTheDocument();
  expect(within(table).getByText('Вільні кошти USD')).toBeInTheDocument();
  expect(plain(within(table).getByText('AAPL').closest('tr')?.textContent)).toContain('+753,50 $');

  await userEvent.click(screen.getByRole('radio', { name: 'За класами' }));
  expect(within(table).getByText('ОВДП')).toBeInTheDocument();

  await userEvent.click(within(table).getByRole('link', { name: /AAPL/ }));
  await waitFor(() => expect(router.state.location.pathname).toBe('/investments/instruments/7'));
  expect(router.state.location.search).toBe('?accountId=1');
});

it('shows an empty state without positions', async () => {
  api({ 'GET /api/v1/investments/portfolio': () => json(portfolioOf()) });
  renderApp('/investments?tab=positions');

  expect(await screen.findByText(/Позицій ще немає/)).toBeInTheDocument();
});

it('computes the result of a period without the deposits', () => {
  expect(result(points, (point) => point.value)).toEqual({ profit: 30, share: 0.25 });
  expect(result(points.slice(0, 1), (point) => point.value)).toEqual({ profit: 0, share: 0 });
  expect(result([], (point) => point.value)).toBeNull();
  expect(rangeFrom('all', kyivToday())).toBeUndefined();
});
