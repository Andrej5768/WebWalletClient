import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { json, mockApi, plain, renderApp, signedInApi } from '../test/render';

const accounts = [
  { id: 1, name: 'Чорна картка', type: 'CARD', currency: 'UAH', balance: 18452.37, balanceInBase: 18452.37 },
  { id: 2, name: 'Біла картка', type: 'CARD', currency: 'USD', balance: 1240, balanceInBase: 51212 },
  {
    id: 3,
    name: 'Кредитка',
    type: 'CREDIT_CARD',
    currency: 'UAH',
    balance: -3420.15,
    balanceInBase: -3420.15,
    creditLimit: 20000,
  },
  {
    id: 4,
    name: 'Старий кредит',
    type: 'LOAN',
    currency: 'UAH',
    balance: 0,
    balanceInBase: 0,
    archived: true,
  },
];

const monobank = {
  clientName: 'Олена',
  accounts: [{ id: 10, accountId: 1, title: 'Чорна', currency: 'UAH', difference: 1240 }],
};

it('lists accounts by group with base amounts and the Monobank difference', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/banks/monobank': () => json(monobank),
  });
  renderApp('/accounts');

  const main = await screen.findByRole('main');
  expect(await within(main).findByText('Картки та рахунки')).toBeInTheDocument();
  expect(within(main).getByText('Чорна картка')).toBeInTheDocument();
  expect(screen.getByText('Кредитні картки')).toBeInTheDocument();
  expect(screen.queryByText('Старий кредит')).not.toBeInTheDocument();
  expect(plain(screen.getByText(/51\s212,00/).textContent)).toBe('51 212,00 ₴');
  expect(await screen.findByText('Банк показує більше: бракує доходів?')).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Показати архівні'));
  expect(screen.getByText('Старий кредит')).toBeInTheDocument();
});

it('opens the edit dialog on double click with the currency locked', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
  });
  renderApp('/accounts');

  fireEvent.doubleClick(await within(await screen.findByRole('main')).findByText('Кредитка'));

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Редагувати рахунок')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Назва')).toHaveValue('Кредитка');
  expect(within(dialog).getByText('Валюту рахунку змінити не можна')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Кредитний ліміт')).toBeInTheDocument();
});

it('creates an account', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json([]),
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
    'POST /api/v1/accounts': () => json({ id: 5 }, 201),
  });
  renderApp('/accounts');

  expect(await screen.findByText('Рахунків ще немає')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Додати рахунок' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Назва'), 'Гаманець');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const create = requests.find((request) => request.method === 'POST' && request.url.endsWith('/accounts'))!;
  expect(await create.json()).toMatchObject({
    name: 'Гаманець',
    type: 'CARD',
    currency: 'UAH',
    inBudget: true,
  });
});

it('keeps savings out of the budget by default unless the switch was set', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json([]),
    'GET /api/v1/banks/monobank': () => json({ code: 'NOT_FOUND' }, 404),
  });
  renderApp('/accounts');

  await userEvent.click(await screen.findByRole('button', { name: 'Додати рахунок' }));
  const dialog = await screen.findByRole('dialog');
  const inBudget = within(dialog).getByRole('switch', { name: /Враховувати в бюджеті/ });
  const type = within(dialog)
    .getAllByLabelText('Тип')
    .find((element) => element.tagName === 'INPUT')!;
  expect(inBudget).toBeChecked();

  await userEvent.click(type);
  await userEvent.click(await screen.findByRole('option', { name: 'Заощадження', hidden: true }));
  expect(inBudget).not.toBeChecked();

  await userEvent.click(inBudget);
  await userEvent.click(type);
  await userEvent.click(await screen.findByRole('option', { name: 'Депозит', hidden: true }));
  expect(inBudget).toBeChecked();
});

it('opens the positions of a brokerage account from its menu', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () =>
      json([
        {
          id: 9,
          name: 'Interactive Brokers',
          type: 'INVESTMENT',
          currency: 'USD',
          balance: 6555,
          balanceInBase: 262200,
          inBudget: false,
          archived: false,
        },
      ]),
  });
  const router = renderApp('/accounts');

  await userEvent.click(await screen.findByRole('button', { name: 'Дії з рахунком' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Позиції' }));

  await waitFor(() => expect(router.state.location.pathname).toBe('/investments'));
  expect(router.state.location.search).toBe('?tab=positions&accountId=9');
});
