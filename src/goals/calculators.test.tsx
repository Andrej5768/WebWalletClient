import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { kyivToday } from '../lib/periods';
import { accountOf, accountsSummaryOf } from '../test/fixtures';
import { json, mockApi, plain, renderApp, renderWithProviders, signedInApi } from '../test/render';
import { YearTooltip } from './CalculatorTab';

/** Twelve months with 10 000 of expenses and 5 000 saved each. */
const incomeExpense = {
  from: '2025-11-01',
  to: '2026-10-31',
  currency: 'UAH',
  income: 180000,
  expense: 120000,
  net: 60000,
  savingsRate: 0.3333,
  months: Array.from({ length: 12 }, (_, index) => ({
    month: `2026-${String(index + 1).padStart(2, '0')}`,
    income: 15000,
    expense: 10000,
    net: 5000,
    savingsRate: 0.3333,
  })),
  unconvertedCurrencies: [],
};

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/reports/income-expense': () => json(incomeExpense),
    'GET /api/v1/accounts/summary': () => json(accountsSummaryOf({ netWorth: 1_000_000 })),
    ...extra,
  });
}

/** The value of the figure with the label. */
async function figure(label: string) {
  const caption = await screen.findByText(label, { selector: 'p' });
  return plain(caption.parentElement?.textContent);
}

it('counts FIRE from the expenses, savings and net worth, and keeps changed inputs', async () => {
  api();
  renderApp('/goals?tab=fire');

  // 10 000 a month, 120 000 a year at 4 %; 1 000 000 growing 5 % a year with 60 000 saved reaches it in 14 years
  expect(await figure('Число FIRE')).toContain('3 000 000 ₴');
  expect(await figure('Років до FIRE')).toContain('14');
  expect(screen.getByText(/Капітал зараз 1 000 000 ₴/)).toBeInTheDocument();
  expect(plain(screen.getByLabelText('Витрати на місяць').getAttribute('value'))).toBe('10 000');
  expect(screen.getByText(/норма заощаджень 33,3%/)).toBeInTheDocument();
  expect(screen.getByText('Barista FIRE')).toBeInTheDocument();

  const rate = screen.getByLabelText(/Ставка безпечного вилучення/);
  await userEvent.clear(rate);
  await userEvent.type(rate, '5');
  await waitFor(async () => expect(await figure('Років до FIRE')).toContain('11'));
  expect(JSON.parse(localStorage.getItem('ww-fire') ?? '{}')).toMatchObject({ withdrawalRate: 5 });

  await userEvent.click(screen.getByRole('button', { name: 'Повернути до даних' }));
  await waitFor(async () => expect(await figure('Років до FIRE')).toContain('14'));

  // The expenses are typed per month and taken per year
  const spent = screen.getByLabelText('Витрати на місяць');
  await userEvent.clear(spent);
  await userEvent.type(spent, '20000');
  await waitFor(async () => expect(await figure('Число FIRE')).toContain('6 000 000 ₴'));
  expect(JSON.parse(localStorage.getItem('ww-fire') ?? '{}')).toMatchObject({ monthlyExpenses: 20000 });
});

it('counts the months of freedom money from the chosen accounts', async () => {
  api({
    'GET /api/v1/accounts': () =>
      json([
        accountOf({ id: 1, name: 'Картка', type: 'CARD', balance: 20000, balanceInBase: 20000 }),
        accountOf({ id: 2, name: 'Депозит', type: 'DEPOSIT', balance: 50000, balanceInBase: 50000 }),
        accountOf({ id: 3, name: 'Банка', type: 'SAVINGS', balance: 10000, balanceInBase: 10000 }),
      ]),
  });
  renderApp('/goals?tab=fym');

  expect(plain((await screen.findByTestId('fym-months')).textContent)).toBe('3,0');
  expect(screen.getByLabelText('Депозит')).not.toBeChecked();
  // 12 months need 120 000; 90 000 more at 5 000 a month
  expect(screen.getByText(/Ще потрібно 90 000 ₴/)).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Депозит'));
  expect(plain(screen.getByTestId('fym-months').textContent)).toBe('8,0');
  expect(JSON.parse(localStorage.getItem('ww-fym') ?? '{}')).toMatchObject({ accounts: { '2': true } });

  // The expenses can be changed and brought back to the average
  const expenses = screen.getByLabelText('Витрати на місяць');
  expect(plain(expenses.getAttribute('value'))).toBe('10 000');
  await userEvent.clear(expenses);
  await userEvent.type(expenses, '20000');
  await waitFor(() => expect(plain(screen.getByTestId('fym-months').textContent)).toBe('4,0'));
  await userEvent.click(screen.getByRole('button', { name: 'Повернути середнє' }));
  await waitFor(() => expect(plain(screen.getByTestId('fym-months').textContent)).toBe('8,0'));

  await userEvent.click(screen.getByRole('radio', { name: '6 місяців' }));
  expect(screen.getByText('Мету досягнуто')).toBeInTheDocument();
});

it('says the freedom money is incomplete when an account has no exchange rate', async () => {
  api({
    'GET /api/v1/accounts': () =>
      json([
        accountOf({ id: 1, name: 'Картка', type: 'CARD', balance: 20000, balanceInBase: 20000 }),
        accountOf({ id: 2, name: 'Злоті', type: 'CASH', currency: 'PLN', balance: 500, balanceInBase: null }),
      ]),
  });
  renderApp('/goals?tab=fym');

  expect(plain((await screen.findByTestId('fym-months')).textContent)).toBe('2,0');
  expect(screen.getByText('Для частини валют немає курсу, тому сума неповна.')).toBeInTheDocument();
});

it('calculates compound interest by year', async () => {
  api();
  renderApp('/goals?tab=calc');

  const initial = await screen.findByLabelText('Початкова сума');
  await userEvent.clear(initial);
  await userEvent.type(initial, '1000');
  const monthly = screen.getByLabelText('Щомісячний внесок');
  await userEvent.clear(monthly);
  await userEvent.type(monthly, '0');
  const years = screen.getByLabelText('Строк, років');
  await userEvent.clear(years);
  await userEvent.type(years, '1');
  await userEvent.click(screen.getByRole('radio', { name: 'Щороку' }));

  await waitFor(async () => expect(await figure('Підсумкова сума')).toContain('1 120 ₴'));
  expect(await figure('Нараховано відсотків')).toContain('120 ₴');
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row')).toHaveLength(2);
  expect(JSON.parse(localStorage.getItem('ww-compound') ?? '{}')).toMatchObject({
    initial: 1000,
    years: 1,
    capitalization: 'YEARLY',
  });
});

it('switches the tabs of the goals page in the URL', async () => {
  api({
    'GET /api/v1/goals': () =>
      json({ currency: 'UAH', saved: 0, target: 0, monthlyNeeded: 0, goals: [], unconvertedCurrencies: [] }),
  });
  const router = renderApp('/goals');

  expect(await screen.findByRole('button', { name: 'Нова ціль' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('tab', { name: 'FIRE' }));
  expect(router.state.location.search).toBe('?tab=fire');
  expect(screen.queryByRole('button', { name: 'Нова ціль' })).not.toBeInTheDocument();
});

it('averages over the complete months with data and warns when there are few', async () => {
  const current = kyivToday();
  const month = (offset: number, expense: number) => ({
    month: current.subtract(offset, 'month').format('YYYY-MM'),
    income: expense ? 40000 : 0,
    expense,
    net: expense ? 40000 - expense : 0,
    savingsRate: null,
  });
  // Ten empty months before the history starts, two complete ones and the current one
  const months = [
    ...Array.from({ length: 9 }, (_, index) => month(11 - index, 0)),
    month(2, 25000),
    month(1, 27000),
    month(0, 3000),
  ];
  api({ 'GET /api/v1/reports/income-expense': () => json({ ...incomeExpense, months }) });
  renderApp('/goals?tab=fire');

  expect(await screen.findByText(/лише за 2 повні місяці/)).toBeInTheDocument();
  // 26 000 a month over the two complete months, not 55 000 / 12
  expect(plain(screen.getByLabelText('Витрати на місяць').getAttribute('value'))).toBe('26 000');
});

it('says in words when the expenses exceed the income', async () => {
  const months = incomeExpense.months.map((month) => ({
    ...month,
    income: 6000,
    net: -4000,
    savingsRate: null,
  }));
  api({ 'GET /api/v1/reports/income-expense': () => json({ ...incomeExpense, months }) });
  renderApp('/goals?tab=fire');

  expect(await screen.findByText(/витрати більші за доходи на 66,7%, заощаджень немає/)).toBeInTheDocument();
  expect(plain(screen.getByLabelText('Щомісячні заощадження').getAttribute('value'))).toBe('0');
});

it('sums the contributions and the interest of a year in the chart tooltip', () => {
  renderWithProviders(
    <YearTooltip
      label="2030"
      payload={[
        { name: 'Внесено', value: 220000, color: 'blue' },
        { name: 'Відсотки', value: 35000, color: 'teal' },
      ]}
      money={(amount) => `${amount} ₴`}
      totalLabel="Підсумок"
    />,
  );

  expect(screen.getByText('2030')).toBeInTheDocument();
  expect(screen.getByText('220000 ₴')).toBeInTheDocument();
  expect(screen.getByText('35000 ₴')).toBeInTheDocument();
  expect(screen.getByText('255000 ₴')).toBeInTheDocument();
});

it('explains each kind of FIRE', async () => {
  api();
  renderApp('/goals?tab=fire');

  await userEvent.click(await screen.findByRole('button', { name: 'Що таке Coast FIRE' }));

  expect(await screen.findByRole('dialog')).toHaveTextContent('навіть без нових внесків');
});
