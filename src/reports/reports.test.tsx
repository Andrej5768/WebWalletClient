import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setAccessToken } from '../api/session';
import i18n from '../i18n';
import { json, mockApi, renderApp, signedInApi } from '../test/render';

const categories = [{ id: 1, name: 'Їжа', kind: 'EXPENSE', icon: 'utensils', color: 'orange' }];

function api() {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/categories': () => json(categories),
    'GET /api/v1/reports/spending': () =>
      json({
        currency: 'UAH',
        total: 10000,
        uncategorized: 500,
        unconvertedCurrencies: ['PLN'],
        categories: [
          {
            categoryId: 1,
            name: 'Їжа',
            amount: 9500,
            share: 0.95,
            children: [{ categoryId: 2, name: 'Продукти', amount: 9500, share: 0.95 }],
          },
        ],
      }),
    'GET /api/v1/reports/income-expense': () =>
      json({
        currency: 'UAH',
        income: 52000,
        expense: 40560,
        net: 11440,
        savingsRate: 0.22,
        months: [{ month: '2026-10', income: 52000, expense: 40560, net: 11440, savingsRate: 0.22 }],
      }),
    'GET /api/v1/reports/net-worth': () =>
      json({
        currency: 'UAH',
        months: [
          { month: '2026-09', assets: 170000, liabilities: -2000, netWorth: 168000 },
          { month: '2026-10', assets: 184913, liabilities: -3420, netWorth: 181493 },
        ],
      }),
    'GET /api/v1/reports/payees': () =>
      json({ currency: 'UAH', payees: [{ payeeId: 5, name: 'Сільпо', amount: 6300, transactions: 9 }] }),
  });
}

beforeEach(async () => {
  setAccessToken(null);
  localStorage.clear();
  await i18n.changeLanguage('uk');
});

afterEach(() => vi.unstubAllGlobals());

it('shows spending by category with subcategories and the missing rates', async () => {
  const requests = api();
  renderApp('/reports');

  expect(await screen.findByText('Без курсу: PLN — ці суми не враховано.')).toBeInTheDocument();
  expect(screen.getByText('95%')).toBeInTheDocument();
  expect(screen.getByText('Без категорії')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Показати підкатегорії Їжа' }));
  expect(screen.getByText('Продукти')).toBeInTheDocument();

  const spending = new URL(requests.find((request) => request.url.includes('/reports/spending'))!.url);
  expect(spending.searchParams.get('from')).toMatch(/-01$/);
});

it('switches to income and expenses for the last 12 months', async () => {
  const requests = api();
  renderApp('/reports?tab=income');

  expect(await screen.findAllByText('22%')).toHaveLength(2);
  const report = new URL(requests.find((request) => request.url.includes('/reports/income-expense'))!.url);
  expect(report.searchParams.get('from')).toBeTruthy();
});

it('shows net worth with debts and the payee ranking', async () => {
  api();
  renderApp('/reports?tab=networth');
  expect(await screen.findByText('Борги')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('tab', { name: 'Отримувачі' }));
  await waitFor(() => expect(screen.getByText('Сільпо')).toBeInTheDocument());
  expect(screen.getByText('9')).toBeInTheDocument();
});
