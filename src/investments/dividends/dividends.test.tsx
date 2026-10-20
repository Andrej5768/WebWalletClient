import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { kyivToday } from '../../lib/periods';
import { accountOf, dividendCalendarOf, dividendEventOf, instrumentOf } from '../../test/fixtures';
import { json, mockApi, plain, renderApp, renderWithProviders, signedInApi } from '../../test/render';
import { monthWeeks, openingMonth, shortName, statusKey, upcoming } from './model';
import { UpcomingPayments } from './UpcomingPayments';

const today = kyivToday();
const day = (offset: number) => today.add(offset, 'day').format('YYYY-MM-DD');
const month = today.format('YYYY-MM');
const nextMonth = today.add(1, 'month').format('YYYY-MM');

const accounts = [
  accountOf({ id: 1, name: 'Interactive Brokers', type: 'INVESTMENT', currency: 'USD', balance: 1000 }),
];

const events = [
  dividendEventOf({
    date: day(-40),
    status: 'RECEIVED',
    symbol: 'VOO',
    instrumentId: 2,
    perShare: null,
    gross: 10,
    tax: 1.5,
    net: 8.5,
    grossInTarget: 10,
    netInTarget: 8.5,
    taxEstimated: false,
  }),
  dividendEventOf({
    date: `${month}-01`,
    exDate: today.subtract(1, 'month').format('YYYY-MM-DD'),
    status: 'EXPECTED',
    symbol: 'KSPI',
    instrumentId: 3,
  }),
  dividendEventOf({ date: `${nextMonth}-12`, status: 'DECLARED', symbol: 'AAPL', instrumentId: 1 }),
  dividendEventOf({
    date: `${nextMonth}-20`,
    status: 'FORECAST',
    symbol: 'MSFT',
    instrumentId: 4,
    gross: 8.3,
    grossInTarget: 8.3,
    netInTarget: 7.06,
  }),
  dividendEventOf({
    date: `${nextMonth}-22`,
    status: 'DECLARED',
    symbol: 'UA4000227045',
    instrumentId: 5,
    type: 'GOVERNMENT_BOND',
    perShare: 76,
    quantity: 100,
    gross: 7600,
    tax: 0,
    net: 7600,
    currency: 'UAH',
    taxEstimated: false,
    grossInTarget: 184,
    netInTarget: 184,
  }),
];

const calendar = dividendCalendarOf({
  next12Months: 588.4,
  next12MonthsNet: 512.1,
  monthly: 49.03,
  yield: 0.023,
  yieldOnCost: 0.029,
  received12Months: 8.5,
  months: [{ month: nextMonth, received: 0, expected: 0, declared: 186.6, forecast: 8.3 }],
  receivedByInstrument: [{ instrumentId: 2, symbol: 'VOO', amount: 8.5 }],
  events,
});

function api(data = calendar) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/accounts/summary': () =>
      json({ currency: 'USD', netWorth: 0, available: 0, availableWithCredit: 0, readyToAssign: 0 }),
    'GET /api/v1/investments/dividends': () => json(data),
    // The operation drawer the warning opens
    'GET /api/v1/investments/instruments/3': () => json(instrumentOf({ id: 3 })),
  });
}

it('lays out a month from Monday', () => {
  // 1 October 2026 is a Thursday
  const weeks = monthWeeks('2026-10');
  expect(weeks[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  expect(upcoming(events, day(0), 2).map((event) => event.symbol)).toEqual(['AAPL', 'MSFT']);
});

it('shows the income, the calendar of the month and warns about an expected payment', async () => {
  const requests = api();
  const router = renderApp('/investments?tab=dividends');

  expect(await screen.findByText('Дохід на 12 місяців')).toBeInTheDocument();
  expect(plain(screen.getByText('Дохід на 12 місяців').parentElement?.textContent)).toContain('588,40 $');
  expect(screen.getByText(/≈ 512,10 \$ на руки/)).toBeInTheDocument();
  expect(screen.getByText('2,3%')).toBeInTheDocument();
  expect(screen.getByText('2,9%')).toBeInTheDocument();
  const query = new URL(requests.find((request) => request.url.includes('/dividends'))!.url).searchParams;
  expect(query.get('from')).toBe(today.startOf('month').subtract(12, 'month').format('YYYY-MM-DD'));

  // The current month: the expected payment of KSPI
  const cell = screen.getByTestId(`day-${month}-01`);
  expect(within(cell).getByText('KSPI').closest('[data-status]')).toHaveAttribute('data-status', 'EXPECTED');
  expect(screen.getByText(/KSPI: виплата .* ще не записана/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Додати дивіденд' }));
  await waitFor(() => expect(router.state.location.search).toContain('operation=new'));
  expect(router.state.location.search).toContain('operationInstrumentId=3');
  expect(router.state.location.search).toContain('operationType=DIVIDEND');

  // The next month has the declared and forecast ones
  await userEvent.click(screen.getByRole('button', { name: 'Наступний місяць' }));
  const aapl = within(screen.getByTestId(`day-${nextMonth}-12`)).getByText('AAPL');
  expect(aapl.closest('[data-status]')).toHaveAttribute('data-status', 'DECLARED');
  const msft = within(screen.getByTestId(`day-${nextMonth}-20`)).getByText('MSFT');
  expect(msft.closest('[data-status]')).toHaveAttribute('data-status', 'FORECAST');

  // Who paid over the last 12 months
  expect(within(screen.getByTestId('payer')).getByText('VOO')).toBeInTheDocument();
});

it('lists the payments of the month with their tax', async () => {
  api();
  renderApp('/investments?tab=dividends');

  await userEvent.click(await screen.findByRole('button', { name: 'Наступний місяць' }));
  await userEvent.click(screen.getByText('Список'));

  const rows = await screen.findAllByTestId('dividend-row');
  expect(rows).toHaveLength(3);
  expect(within(rows[0]!).getByText('AAPL')).toBeInTheDocument();
  expect(within(rows[0]!).getByText('Оголошено')).toBeInTheDocument();
  expect(within(rows[0]!).getByText('оцінка 15%')).toBeInTheDocument();
  expect(plain(rows[0]!.textContent)).toContain('10 × 0,26 $');
  expect(within(rows[1]!).getByText('Прогноз')).toBeInTheDocument();
  expect(within(rows[2]!).getByText('не оподатковується')).toBeInTheDocument();
  expect(plain(rows[2]!.textContent)).toContain('7 600,00 ₴');
});

it('says when there are no dividends yet', async () => {
  api(dividendCalendarOf());
  renderApp('/investments?tab=dividends');

  expect(await screen.findByText(/Ще немає дивідендів чи купонів/)).toBeInTheDocument();
});

it('shows the nearest payments with a link to the calendar', async () => {
  api();
  renderWithProviders(<UpcomingPayments accountId={1} />);

  expect(screen.getByText('Найближчі виплати')).toBeInTheDocument();
  expect(await screen.findByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('MSFT')).toBeInTheDocument();
  expect(screen.queryByText('VOO')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Календар дивідендів →' })).toHaveAttribute(
    'href',
    '/investments?tab=dividends&accountId=1',
  );
});

it('opens the calendar on the nearest month with payments and names bonds by name', () => {
  const coupon = dividendEventOf({
    date: '2027-01-22',
    status: 'DECLARED',
    type: 'GOVERNMENT_BOND',
    symbol: 'UA4000227045',
    name: 'ОВДП 22.07.2027',
  });
  const stock = dividendEventOf({ date: '2026-12-15', status: 'DECLARED' });

  expect(openingMonth([coupon, stock], '2026-10')).toBe('2026-12');
  expect(openingMonth([dividendEventOf({ date: '2026-10-03' }), stock], '2026-10')).toBe('2026-10');
  expect(openingMonth([], '2026-10')).toBe('2026-10');
  expect(shortName(coupon)).toBe('ОВДП 22.07.2027');
  expect(shortName(stock)).toBe('AAPL');
  expect(statusKey(coupon)).toBe('SCHEDULED');
  expect(statusKey(stock)).toBe('DECLARED');
});
