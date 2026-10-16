import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { accountOf, goalOf, goalsOf } from '../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../test/render';

const trip = goalOf({
  id: 1,
  name: 'Відпустка',
  targetAmount: 60000,
  targetDate: '2027-06-01',
  accountId: 7,
  saved: 32000,
  remaining: 28000,
  progress: 0.5333,
  expected: 30000,
  monthsLeft: 8,
  monthlyNeeded: 3500,
  status: 'ON_TRACK',
  icon: 'plane',
  color: 'cyan',
});
const laptop = goalOf({
  id: 2,
  name: 'Ноутбук',
  targetAmount: 45000,
  targetDate: '2027-03-01',
  saved: 18000,
  remaining: 27000,
  progress: 0.4,
  expected: 22500,
  monthsLeft: 5,
  monthlyNeeded: 5400,
  status: 'BEHIND',
});
const cushion = goalOf({
  id: 3,
  name: 'Подушка безпеки',
  targetAmount: 84000,
  saved: 52000,
  remaining: 32000,
  progress: 0.619,
  status: 'NO_DATE',
});

const accounts = [accountOf({ id: 7, name: 'Банка «Відпустка»', type: 'SAVINGS', balance: 32000 })];

it('lists goals with their progress, pace and totals', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/goals': () => json(goalsOf([trip, laptop, cushion])),
  });
  renderApp('/goals');

  const tripCard = (await screen.findByText('Відпустка')).closest('.mantine-Card-root') as HTMLElement;
  expect(within(tripCard).getByText('За планом')).toBeInTheDocument();
  expect(plain(within(tripCard).getByText(/Банка «Відпустка»/).textContent)).toMatch(/до 1 черв\. 2027/);
  expect(plain(within(tripCard).getByText(/Попереду графіка/).textContent)).toBe(
    'Попереду графіка на 2 000,00 ₴',
  );
  expect(within(tripCard).getByText('Відкладати щомісяця, 8 міс.')).toBeInTheDocument();

  const laptopCard = screen.getByText('Ноутбук').closest('.mantine-Card-root') as HTMLElement;
  expect(within(laptopCard).getByText('Відстає')).toBeInTheDocument();
  expect(plain(within(laptopCard).getByText(/На сьогодні/).textContent)).toBe(
    'На сьогодні варто мати 22 500,00 ₴, бракує 4 500,00 ₴',
  );

  const cushionCard = screen.getByText('Подушка безпеки').closest('.mantine-Card-root') as HTMLElement;
  expect(within(cushionCard).getByText('Без терміну')).toBeInTheDocument();
  expect(within(cushionCard).getByText('Відмічається вручну')).toBeInTheDocument();

  expect(plain(screen.getByText('Зібрано на цілі').parentElement?.textContent)).toContain('102 000,00 ₴');
  expect(plain(screen.getByText('Потрібно відкладати').parentElement?.textContent)).toContain('8 900,00 ₴');
});

it('creates a goal on an account', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/goals': () => json(goalsOf([])),
    'POST /api/v1/goals': () => json(trip, 201),
  });
  renderApp('/goals');

  expect(await screen.findByText(/Ще немає цілей/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Нова ціль' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/Назва/), 'Відпустка');
  await userEvent.type(within(dialog).getByLabelText(/Сума цілі/), '60000');
  await userEvent.click(within(dialog).getByLabelText('Рахунок для накопичення'));
  await userEvent.click(await screen.findByRole('option', { name: /Банка «Відпустка»/, hidden: true }));
  await userEvent.click(within(dialog).getByRole('radio', { name: 'plane' }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/goals')).toEqual({
    name: 'Відпустка',
    targetAmount: 60000,
    currency: 'UAH',
    accountId: 7,
    icon: 'plane',
    color: 'blue',
  });
});

it('adds money to a goal kept by hand', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/goals': () => json(goalsOf([cushion])),
    'POST /api/v1/goals/3/contributions': () => json({ ...cushion, saved: 56000 }),
  });
  renderApp('/goals');

  await userEvent.click(await screen.findByRole('button', { name: 'Дії з ціллю' }));
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Поповнити' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Сума'), '4000');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Зберегти' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await bodyOf(requests, 'POST', '/api/v1/goals/3/contributions')).toEqual({ amount: 4000 });
});

it('marks a goal as achieved, keeping its other fields', async () => {
  const requests = mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json(accounts),
    'GET /api/v1/goals': () => json(goalsOf([trip])),
    'PUT /api/v1/goals/1': () => json({ ...trip, status: 'ACHIEVED', achievedOn: '2026-10-16' }),
  });
  renderApp('/goals');

  // Goals on an account grow with transfers to it, so they offer no manual top-up.
  await userEvent.click(await screen.findByRole('button', { name: 'Дії з ціллю' }));
  const achieve = await screen.findByRole('menuitem', { name: 'Позначити досягнутою' });
  expect(screen.queryByRole('menuitem', { name: 'Поповнити' })).not.toBeInTheDocument();
  await userEvent.click(achieve);

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  expect(await bodyOf(requests, 'PUT', '/api/v1/goals/1')).toEqual({
    name: 'Відпустка',
    targetAmount: 60000,
    currency: 'UAH',
    targetDate: '2027-06-01',
    accountId: 7,
    icon: 'plane',
    color: 'cyan',
    sortOrder: 0,
    achieved: true,
  });
});

it('shows an achieved goal without the monthly amount', async () => {
  mockApi({
    ...signedInApi,
    'GET /api/v1/goals': () =>
      json(goalsOf([{ ...cushion, status: 'ACHIEVED', achievedOn: '2026-09-30', monthlyNeeded: null }])),
  });
  renderApp('/goals');

  expect(await screen.findByText('Досягнуто')).toBeInTheDocument();
  expect(screen.getByText(/Ціль досягнута 30 вер\. 2026/)).toBeInTheDocument();
  expect(screen.queryByText(/Відкладати щомісяця/)).not.toBeInTheDocument();
});
