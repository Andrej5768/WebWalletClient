import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { budgetRowOf } from '../test/fixtures';
import { bodyOf, currentMonth as month, json, mockApi, plain, renderApp, signedInApi } from '../test/render';
import { planRange, type PlanRow } from './plan';

const food = budgetRowOf({
  categoryId: 1,
  name: 'Їжа',
  children: [
    budgetRowOf({
      categoryId: 2,
      name: 'Продукти',
      parentId: 1,
      ownAssigned: 9000,
      ownActivity: -4950,
      ownAvailable: 4050,
    }),
    budgetRowOf({
      categoryId: 3,
      name: 'Кафе',
      parentId: 1,
      ownAssigned: 2000,
      ownActivity: -2340,
      ownAvailable: -340,
    }),
  ],
});

const budget = {
  month,
  currency: 'UAH',
  readyToAssign: 4250,
  inflow: 15250,
  assigned: 11000,
  activity: -7290,
  available: 3710,
  plannedIncome: 20000,
  income: 15250,
  uncategorizedIncome: 0,
  incomeCategories: [],
  unconvertedCurrencies: [],
  categories: [food],
};

const range = planRange();
const months: string[] = [];
for (let m = dayjs(`${range.from}-01`); m.format('YYYY-MM') <= range.to; m = m.add(1, 'month')) {
  months.push(m.format('YYYY-MM'));
}
const before = (m: string) => m < month;

function planRowOf(
  categoryId: number,
  name: string,
  values: (month: string) => { plan: number; actual: number },
  extra: Partial<PlanRow> = {},
): PlanRow {
  return {
    categoryId,
    name,
    parentId: null,
    archived: false,
    carryOver: false,
    average: 0,
    ownAverage: 0,
    months: months.map((m) => {
      const { plan, actual } = values(m);
      return { month: m, plan, actual, ownPlan: plan, ownActual: actual };
    }),
    children: [],
    ...extra,
  };
}

const plan = {
  currency: 'UAH',
  months,
  averageMonths: months.slice(9, 12),
  income: [
    planRowOf(10, 'Зарплата', (m) => ({
      plan: 20000,
      actual: before(m) ? 20000 : m === month ? 15250 : 0,
    })),
  ],
  expenses: [
    planRowOf(
      2,
      'Продукти',
      (m) => ({ plan: m === month ? 9000 : 8000, actual: before(m) ? 8500 : m === month ? 4950 : 0 }),
      { average: 8500, ownAverage: 8500 },
    ),
    planRowOf(5, 'Таксі', () => ({ plan: 0, actual: 0 }), { average: 640, ownAverage: 640 }),
  ],
  totals: months.map((m) => ({
    month: m,
    plannedIncome: 20000,
    income: before(m) ? 20000 : m === month ? 15250 : 0,
    plannedExpenses: m === month ? 9000 : 8000,
    expenses: before(m) ? 8500 : m === month ? 4950 : 0,
    uncategorizedIncome: 0,
    uncategorizedExpenses: 0,
  })),
  unconvertedCurrencies: [],
};

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/categories': () => json([]),
    [`GET /api/v1/budget/${month}`]: () => json(budget),
    'GET /api/v1/budget': () => json(plan),
    ...extra,
  });
}

const monthTitle = (value: string) =>
  new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(dayjs(`${value}-01`).toDate());

async function monthMenu(value: string, item: string) {
  await userEvent.click(screen.getByRole('button', { name: `Дії з місяцем ${monthTitle(value)}` }));
  await userEvent.click(await screen.findByRole('menuitem', { name: item }));
}

it('shows the free money, the planned income and overspending of the selected month', async () => {
  api();
  renderApp('/budget');

  expect(plain((await screen.findByText(/4\s250,00/)).textContent)).toBe('4 250,00 ₴');
  expect(screen.getByText(/план 20\s000,00/)).toBeInTheDocument();
  expect(screen.getByText(/Перевитрата: Кафе/)).toBeInTheDocument();
});

it('asks for twelve months back and twelve ahead and shows income and expenses together', async () => {
  const requests = api();
  renderApp('/budget');

  expect(await screen.findByText('Зарплата')).toBeInTheDocument();
  const request = requests.find((r) => new URL(r.url).pathname === '/api/v1/budget')!;
  expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({ from: range.from, to: range.to });
  expect(screen.getByText('Доходи разом')).toBeInTheDocument();
  expect(screen.getByText('Витрати разом')).toBeInTheDocument();
  expect(screen.getByText('Доходи мінус витрати')).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Середнє за 3 місяці' })).toBeInTheDocument();
});

it('saves a plan typed into the current month, with arithmetic', async () => {
  const requests = api({ [`PUT /api/v1/budget/${month}/categories/2`]: () => json(budget) });
  renderApp('/budget');

  const input = await screen.findByLabelText(`План: Продукти, ${monthTitle(month)}`);
  await userEvent.clear(input);
  await userEvent.type(input, '9000+500');
  fireEvent.blur(input);

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  expect(await bodyOf(requests, 'PUT', `/api/v1/budget/${month}/categories/2`)).toEqual({ assigned: 9500 });
});

it('keeps the plan of a past month read-only until the month is opened for editing', async () => {
  api();
  renderApp('/budget');

  await screen.findByText('Зарплата');
  const previous = months[months.indexOf(month) - 1]!;
  expect(screen.queryByLabelText(`План: Таксі, ${monthTitle(previous)}`)).not.toBeInTheDocument();
  expect(screen.getByLabelText(`План: Таксі, ${monthTitle(month)}`)).toBeInTheDocument();

  await monthMenu(previous, 'Змінити план минулого місяця');

  expect(await screen.findByLabelText(`План: Таксі, ${monthTitle(previous)}`)).toBeInTheDocument();
});

it('puts the average into the plan of the selected month', async () => {
  const requests = api({ [`PUT /api/v1/budget/${month}/categories/5`]: () => json(budget) });
  renderApp('/budget');

  const row = (await screen.findByText('Таксі')).closest('tr')!;
  await userEvent.click(within(row).getByRole('button', { name: /у план/ }));

  expect(await bodyOf(requests, 'PUT', `/api/v1/budget/${month}/categories/5`)).toEqual({ assigned: 640 });
});

it('fills the empty plans of a month with the average in one request', async () => {
  const next = months[months.indexOf(month) + 1]!;
  const requests = api({ [`PUT /api/v1/budget/${next}/categories`]: () => json(budget) });
  renderApp('/budget');

  await screen.findByText('Таксі');
  await monthMenu(next, 'Заповнити порожні середнім');

  // Groceries already have a plan there, so only the taxi gets its average
  expect(await bodyOf(requests, 'PUT', `/api/v1/budget/${next}/categories`)).toEqual({
    plans: [{ categoryId: 5, assigned: 640 }],
  });
});

it('covers overspending by moving money in one request', async () => {
  const requests = api({ [`POST /api/v1/budget/${month}/move`]: () => json(budget) });
  renderApp('/budget');

  await userEvent.click(await screen.findByRole('button', { name: 'Покрити' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByLabelText('Сума')).toHaveValue('340');
  await userEvent.click(within(dialog).getByLabelText('Звідки'));
  await userEvent.keyboard('Продукти{ArrowDown}{Enter}');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Перемістити' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', `/api/v1/budget/${month}/move`)).toEqual({
    fromCategoryId: 2,
    toCategoryId: 3,
    amount: 340,
  });
});

it('copies the previous month with one request', async () => {
  const requests = api({ [`POST /api/v1/budget/${month}/copy-previous`]: () => json(budget) });
  renderApp('/budget');

  await userEvent.click(await screen.findByRole('button', { name: 'Як минулого місяця' }));

  await waitFor(() =>
    expect(requests.some((request) => new URL(request.url).pathname.endsWith('/copy-previous'))).toBe(true),
  );
});
