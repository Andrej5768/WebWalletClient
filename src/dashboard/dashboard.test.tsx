import { screen, within } from '@testing-library/react';
import { accountsSummaryOf, budgetRowOf, splitOf, transactionOf } from '../test/fixtures';
import { currentMonth as month, json, mockApi, plain, renderApp, signedInApi } from '../test/render';

it('shows the month figures, envelopes, recent transactions and bank differences', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts/summary': () =>
      json(accountsSummaryOf({ netWorth: 181493.12, readyToAssign: 4250 })),
    'GET /api/v1/reports/income-expense': () =>
      json({
        currency: 'UAH',
        months: [{ month, income: 52000, expense: 18960.31, net: 33039.69, savingsRate: 0.64 }],
      }),
    [`GET /api/v1/budget/${month}`]: () =>
      json({
        month,
        currency: 'UAH',
        readyToAssign: 4250,
        assigned: 2000,
        activity: -2340,
        available: -340,
        unconvertedCurrencies: [],
        categories: [
          budgetRowOf({
            categoryId: 3,
            name: 'Кафе',
            ownAssigned: 2000,
            ownActivity: -2340,
            ownAvailable: -340,
          }),
        ],
      }),
    'GET /api/v1/transactions': () =>
      json({
        items: [
          transactionOf({
            id: 1,
            amount: 95,
            payee: { id: 1, name: 'Aroma Kava' },
            splits: [splitOf({ amount: 95 })],
          }),
        ],
        totalItems: 1,
        totalPages: 1,
      }),
    'GET /api/v1/banks/monobank': () =>
      json({
        accounts: [{ id: 1, accountId: 1, accountName: 'Чорна картка', currency: 'UAH', difference: 1240 }],
      }),
  });
  renderApp('/');

  const main = await screen.findByRole('main');
  expect(await within(main).findByText('Aroma Kava')).toBeInTheDocument();
  // A recent transaction opens for editing on the transactions page.
  expect(within(main).getByText('Aroma Kava').closest('a')).toHaveAttribute('href', '/transactions?edit=1');
  expect(plain(within(main).getByText(/52\s000,00/).textContent)).toBe('52 000,00 ₴');
  expect(within(main).getByText('Заощаджено 64% доходу')).toBeInTheDocument();
  expect(within(main).getByText('Кафе')).toBeInTheDocument();
  expect(await within(main).findByText(/Розбіжність із банком: Чорна картка/)).toBeInTheDocument();
});
