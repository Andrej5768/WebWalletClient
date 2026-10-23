import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { brokerOf, investmentOperationOf, portfolioOf } from '../../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../../test/render';

const broker = brokerOf({ name: 'Freedom Finance' });

const page = (items: ReturnType<typeof investmentOperationOf>[]) =>
  json({ items, page: 0, size: 50, totalItems: items.length, totalPages: 1 });

const exchange = investmentOperationOf({
  id: 21,
  type: 'EXCHANGE',
  instrumentId: null,
  symbol: null,
  date: '2026-05-15',
  quantity: null,
  price: null,
  amount: 98.47,
  currency: 'EUR',
  cash: -98.47,
  toAmount: 106.99,
  toCurrency: 'USD',
});
const deposit = investmentOperationOf({
  id: 22,
  type: 'DEPOSIT',
  instrumentId: null,
  symbol: null,
  date: '2026-05-14',
  quantity: null,
  price: null,
  amount: 100,
  currency: 'EUR',
  cash: 100,
  comment: 'Deposit with a bank card',
});
const buy = investmentOperationOf({ id: 23, date: '2026-05-16' });

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json([broker]),
    'GET /api/v1/investments/portfolio': () => json(portfolioOf()),
    'GET /api/v1/investments/operations': (request: Request) =>
      new URL(request.url).searchParams.getAll('types').length
        ? page([exchange, deposit])
        : page([buy, exchange, deposit]),
    ...extra,
  });
}

it('lists the operations of the account and filters them by kind', async () => {
  const requests = api();
  renderApp('/investments?tab=operations&accountId=3');

  const row = (await screen.findByText('EUR → USD')).closest('tr')!;
  expect(plain(row.textContent)).toContain('-98,47 €');
  expect(plain(row.textContent)).toContain('+106,99 $');
  expect(screen.getByText('Deposit with a bank card')).toBeInTheDocument();
  expect(screen.getByText('AAPL')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('radio', { name: 'Поповнення й обміни' }));
  await waitFor(() => expect(screen.queryByText('AAPL')).not.toBeInTheDocument());
  const filtered = requests.filter((request) => request.url.includes('/investments/operations')).at(-1)!;
  const params = new URL(filtered.url).searchParams;
  expect(params.get('accountId')).toBe('3');
  expect(params.getAll('types')).toEqual(['DEPOSIT', 'WITHDRAWAL', 'EXCHANGE']);
});

it('opens an operation from the list and records an exchange by hand', async () => {
  const requests = api({
    'GET /api/v1/investments/operations/21': () => json(exchange),
    'POST /api/v1/investments/operations': () => json({}, 201),
  });
  renderApp('/investments?tab=operations&accountId=3');

  await userEvent.click(await screen.findByRole('button', { name: 'Відкрити: EUR → USD, 15.05.2026' }));
  const opened = within(await screen.findByRole('dialog'));
  await waitFor(() => expect(opened.getByTestId('exchange-rate')).toBeInTheDocument());
  expect(plain(opened.getByTestId('exchange-rate').textContent)).toContain('1 EUR = 1,086524 USD');
  await userEvent.click(opened.getByRole('button', { name: 'Скасувати' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: 'Додати операцію' }));
  const panel = within(await screen.findByRole('dialog'));
  await userEvent.click(panel.getByLabelText('Тип операції'));
  await userEvent.click(await screen.findByRole('option', { name: 'Обмін валют', hidden: true }));
  expect(panel.queryByLabelText('Інструмент')).not.toBeInTheDocument();
  await userEvent.type(panel.getByRole('textbox', { name: 'Продано' }), '100');
  await userEvent.type(panel.getByRole('textbox', { name: 'Отримано' }), '4100');
  await userEvent.type(panel.getByLabelText('Валюта отримання'), 'UAH');
  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(plain(panel.getByTestId('operation-total').textContent)).toContain('4 100,00');
  await userEvent.click(panel.getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'POST', '/api/v1/investments/operations')).toMatchObject({
      type: 'EXCHANGE',
      accountId: 3,
      amount: 100,
      toAmount: 4100,
      toCurrency: 'UAH',
    }),
  );
  expect(await bodyOf(requests, 'POST', '/api/v1/investments/operations')).not.toHaveProperty('instrumentId');
});
