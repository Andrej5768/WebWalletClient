import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { kyivToday } from '../../lib/periods';
import { monthSavingsOf, planRowOf } from '../../test/fixtures';
import { currentMonth, json, mockApi, plain, renderApp, signedInApi } from '../../test/render';

const base = { currency: 'UAH', unconvertedCurrencies: [] };

function api(handlers: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({ ...signedInApi, ...handlers });
}

const texts = () => plain(document.body.textContent);

it('compares the plan with the actual spending and warns about the forecast', async () => {
  api({
    [`GET /api/v1/analytics/plan/${currentMonth}`]: () =>
      json({
        ...base,
        month: currentMonth,
        daysElapsed: 10,
        daysInMonth: 31,
        planned: 4000,
        actual: 2500,
        difference: 1500,
        forecast: 7750,
        categories: [
          planRowOf({
            categoryId: 1,
            name: 'Їжа',
            planned: 3000,
            actual: 2000,
            difference: 1000,
            completion: 0.6667,
            plannedRemaining: 300,
            forecast: 6500,
            children: [planRowOf({ categoryId: 2, name: 'Продукти', planned: 3000, actual: 2000 })],
          }),
          planRowOf({ categoryId: 3, name: 'Розваги', planned: 1000, actual: 500, difference: 500 }),
        ],
      }),
  });
  renderApp('/reports?tab=analytics');

  expect(await screen.findByText('Розваги')).toBeInTheDocument();
  expect(texts()).toContain('7 750,00 ₴');
  expect(texts()).toContain('перевищення на 3 750,00 ₴');
  expect(texts()).toContain('ще заплановано 300,00 ₴');
  expect(texts()).toContain('62,5% плану');
  expect(texts()).toContain('прогноз 6 500,00 ₴');
  expect(texts()).toContain('(10 з 31)');

  expect(screen.queryByText('Продукти')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Показати підкатегорії Їжа' }));
  expect(screen.getByText('Продукти')).toBeInTheDocument();
});

it('shows the cash flow of the last 12 months', async () => {
  const requests = api({
    'GET /api/v1/reports/income-expense': () =>
      json({
        ...base,
        income: 104000,
        expense: 80000,
        net: 24000,
        savingsRate: 0.23,
        months: [
          { month: '2026-09', income: 52000, expense: 40000, net: 12000, savingsRate: 0.2308 },
          { month: '2026-10', income: 52000, expense: 40000, net: 12000, savingsRate: 0.2308 },
        ],
      }),
  });
  renderApp('/reports?tab=analytics&view=cashflow');

  expect(await screen.findByText('Грошовий потік за місяцями')).toBeInTheDocument();
  expect(texts()).toContain('У середньому лишається 12 000,00 ₴ на місяць');
  expect(texts()).toContain('+12 000,00 ₴');
  const report = new URL(requests.find((request) => request.url.includes('/reports/income-expense'))!.url);
  expect(report.searchParams.get('from')).toMatch(/-01$/);
});

it('compares two periods up to the same day', async () => {
  const today = kyivToday();
  const requests = api({
    'GET /api/v1/analytics/compare': () =>
      json({
        ...base,
        fromA: '2026-10-01',
        toA: '2026-10-15',
        fromB: '2026-09-01',
        toB: '2026-09-15',
        totalA: 12000,
        totalB: 10000,
        change: 2000,
        changeShare: 0.2,
        days: [
          { day: 1, a: 500, b: 300 },
          { day: 2, a: 900, b: null },
        ],
        categories: [
          { categoryId: 1, name: 'Їжа', a: 8000, b: 5000, change: 3000, changeShare: 0.6 },
          { categoryId: null, name: null, a: 4000, b: 5000, change: -1000, changeShare: -0.2 },
        ],
      }),
  });
  renderApp('/reports?tab=analytics&view=compare');

  expect(await screen.findByText('Без категорії')).toBeInTheDocument();
  expect(texts()).toContain('Їжа +3 000,00 ₴ · Без категорії -1 000,00 ₴');
  expect(texts()).toContain('+2 000,00 ₴');

  const query = new URL(requests.find((request) => request.url.includes('/analytics/compare'))!.url)
    .searchParams;
  expect(query.get('fromA')).toBe(today.startOf('month').format('YYYY-MM-DD'));
  expect(query.get('toA')).toBe(today.format('YYYY-MM-DD'));
  expect(query.get('fromB')).toBe(today.subtract(1, 'month').startOf('month').format('YYYY-MM-DD'));

  await userEvent.click(screen.getByRole('radio', { name: 'Рік до року' }));
  await userEvent.click(screen.getByRole('checkbox', { name: 'Порівнювати на однакову дату' }));
  await waitFor(() => {
    const last = new URL(
      requests.filter((request) => request.url.includes('/analytics/compare')).at(-1)!.url,
    );
    expect(last.searchParams.get('fromB')).toBe(
      today.subtract(1, 'year').startOf('month').format('YYYY-MM-DD'),
    );
    expect(last.searchParams.get('toA')).toBe(today.endOf('month').format('YYYY-MM-DD'));
  });
});

it('shows spending trends with anomalies and toggles the lines', async () => {
  api({
    'GET /api/v1/analytics/trends': () =>
      json({
        ...base,
        from: '2026-08',
        to: '2026-09',
        average: 9000,
        months: [
          { month: '2026-08', total: 6000 },
          { month: '2026-09', total: 12000 },
        ],
        categories: [
          {
            categoryId: 1,
            name: 'Їжа',
            amounts: [5000, 5500],
            total: 10500,
            average: 5250,
            anomalies: [],
          },
          {
            categoryId: 2,
            name: 'Розваги',
            amounts: [1000, 6500],
            total: 7500,
            average: 3750,
            anomalies: [{ month: '2026-09', amount: 6500, average: 1000, ratio: 6.5 }],
          },
        ],
      }),
  });
  renderApp('/reports?tab=analytics&view=trends');

  expect(await screen.findByText('Аномалії')).toBeInTheDocument();
  expect(texts()).toMatch(/Розваги, .+: 6 500,00 ₴ — у 6,5 раза більше за середнє 1 000,00 ₴/);
  // The last month is shown on the side: the visible total and the change against the average
  expect(texts()).toContain('Разом (видимі): 12 000,00 ₴');
  expect(texts()).toContain('+2 750,00 ₴');

  const toggle = screen.getByRole('button', { name: 'Показати або сховати Розваги' });
  await userEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(texts()).toContain('Разом (видимі): 5 500,00 ₴');
});

it('shows savings, 50/30/20 of the last complete month and where the money went', async () => {
  const requests = api({
    'GET /api/v1/analytics/savings': () =>
      json({
        ...base,
        from: '2026-09',
        to: '2026-10',
        target: 0.2,
        averageRate: 0.25,
        totalSaved: 20000,
        bestMonth: '2026-09',
        months: [
          monthSavingsOf({
            month: '2026-09',
            income: 52000,
            expense: 39000,
            net: 13000,
            savingsRate: 0.25,
            cumulative: 13000,
            destinations: [{ accountId: 7, name: 'Депозит', amount: 10000 }],
          }),
          monthSavingsOf({ month: '2026-10', net: 7000, cumulative: 20000, complete: false }),
        ],
      }),
    'GET /api/v1/analytics/needs-wants': () =>
      json({
        ...base,
        from: '2026-09-01',
        to: '2026-09-30',
        income: 52000,
        needs: { amount: 26000, share: 0.5, target: 0.5 },
        wants: { amount: 13000, share: 0.25, target: 0.3 },
        savings: { amount: 13000, share: 0.25, target: 0.2 },
        unclassified: { amount: 0, share: 0, target: null },
      }),
  });
  renderApp('/reports?tab=analytics&view=savings');

  expect(await screen.findByText('Депозит')).toBeInTheDocument();
  expect(texts()).toContain('+20 000,00 ₴');
  expect(texts()).toContain('Лишилося на картках і готівкою');
  expect(texts()).toContain('3 000,00 ₴');
  expect(await screen.findByText('Обов’язкові')).toBeInTheDocument();
  expect(screen.queryByText('Без позначки')).not.toBeInTheDocument();

  const needs = new URL(requests.find((request) => request.url.includes('/needs-wants'))!.url).searchParams;
  expect(needs.get('from')).toBe('2026-09-01');
  expect(needs.get('to')).toBe('2026-09-30');
});
