import { screen, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { setAccessToken } from '../api/session';
import i18n from '../i18n';
import { json, mockApi, renderApp, signedInApi } from '../test/render';

const month = dayjs().format('YYYY-MM');

beforeEach(async () => {
  setAccessToken(null);
  localStorage.clear();
  await i18n.changeLanguage('uk');
});

afterEach(() => vi.unstubAllGlobals());

const plain = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

it('shows the month figures, envelopes, recent transactions and bank differences', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts/summary': () =>
      json({
        currency: 'UAH',
        netWorth: 181493.12,
        available: 0,
        availableWithCredit: 0,
        readyToAssign: 4250,
      }),
    'GET /api/v1/reports/income-expense': () =>
      json({
        currency: 'UAH',
        months: [{ month, income: 52000, expense: 18960.31, net: 33039.69, savingsRate: 0.64 }],
      }),
    [`GET /api/v1/budget/${month}`]: () =>
      json({
        currency: 'UAH',
        readyToAssign: 4250,
        categories: [
          { categoryId: 3, name: 'Кафе', assigned: 2000, activity: -2340, available: -340, children: [] },
        ],
      }),
    'GET /api/v1/transactions': () =>
      json({
        items: [
          {
            id: 1,
            type: 'EXPENSE',
            date: dayjs().format('YYYY-MM-DD'),
            accountId: 1,
            amount: 95,
            currency: 'UAH',
            payee: { id: 1, name: 'Aroma Kava' },
            splits: [{ amount: 95 }],
          },
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
  expect(plain(within(main).getByText(/52\s000,00/).textContent)).toBe('52 000,00 ₴');
  expect(within(main).getByText('Заощаджено 64% доходу')).toBeInTheDocument();
  expect(within(main).getByText('Кафе')).toBeInTheDocument();
  expect(await within(main).findByText(/Розбіжність із банком: Чорна картка/)).toBeInTheDocument();
});
