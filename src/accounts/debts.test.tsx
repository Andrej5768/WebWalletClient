import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, plain, renderApp, signedInApi } from '../test/render';

const accounts = [
  { id: 1, name: 'Чорна картка', type: 'CARD', currency: 'UAH', balance: 18000, balanceInBase: 18000 },
  {
    id: 2,
    name: 'Кредитка',
    type: 'CREDIT_CARD',
    currency: 'UAH',
    balance: -3420.15,
    balanceInBase: -3420.15,
  },
  { id: 3, name: 'Іпотека', type: 'LOAN', currency: 'UAH', balance: -50000, balanceInBase: -50000 },
  { id: 4, name: 'Борг Олегу', type: 'DEBT', currency: 'UAH', balance: -1000, balanceInBase: -1000 },
  { id: 5, name: 'Позика Ірі', type: 'DEBT', currency: 'UAH', balance: 700, balanceInBase: 700 },
  {
    id: 6,
    name: 'Стара кредитка',
    type: 'CREDIT_CARD',
    currency: 'UAH',
    balance: -999,
    balanceInBase: -999,
    archived: true,
  },
];

it('shows loans with credit cards and debts to people apart', async () => {
  mockApi({ ...signedInApi, 'GET /api/v1/accounts': () => json(accounts) });
  renderApp('/accounts');

  const credits = (await screen.findByText('Кредити й кредитки')).parentElement!;
  expect(plain(credits.textContent)).toContain('53 420,15');
  const debts = screen.getByText('Борги', { selector: '*' }).parentElement!;
  expect(plain(debts.textContent)).toContain('1 000');
  expect(plain(debts.textContent)).toContain('Вам винні 700');
});

it('lists the people with debts and opens their operations', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/debts': () =>
      json({
        currency: 'UAH',
        accountId: 4,
        unconvertedCurrencies: [],
        people: [
          { payeeId: 7, name: 'Олег', balance: 700, lastDate: '2026-10-05', operations: 2 },
          { payeeId: 8, name: 'Іра', balance: -500, lastDate: '2026-10-07', operations: 1 },
        ],
      }),
  });
  renderApp('/accounts');

  const card = (await screen.findByText('Борги з людьми')).closest<HTMLElement>('.mantine-Card-root')!;
  expect(within(card).getByText('Олег')).toBeInTheDocument();
  expect(within(card).getByText('Вам винні')).toBeInTheDocument();
  expect(within(card).getByText('Ви винні')).toBeInTheDocument();
  expect(plain(within(card).getByText(/500,00/).textContent)).toBe('500,00 ₴');

  await userEvent.click(within(card).getByText('Олег'));
  expect((await screen.findAllByText('Операції')).length).toBeGreaterThan(0);
});

it('edits an account from its menu', async () => {
  mockApi({ ...signedInApi, 'GET /api/v1/accounts': () => json(accounts.slice(0, 1)) });
  renderApp('/accounts');

  await userEvent.click(await screen.findByRole('button', { name: 'Дії з рахунком' }));
  const menu = await screen.findByRole('menu');
  expect(within(menu).getAllByRole('menuitem')[0]).toHaveTextContent('Редагувати');
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Редагувати' }));

  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
