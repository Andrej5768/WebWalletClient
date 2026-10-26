import { screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { categoryOf, forecastOf, recurringOf } from '../test/fixtures';
import { json, mockApi, plain, renderApp, signedInApi } from '../test/render';
import { expectedDate, forecastChart, loadMinimum } from './forecast';

const days = [
  { date: '2026-10-01', balance: 121400, actual: true, operations: [] },
  { date: '2026-10-02', balance: 104300, actual: true, operations: [] },
  { date: '2026-10-03', balance: 102913.4, actual: true, operations: [] },
  { date: '2026-10-04', balance: 88913.4, actual: false, operations: [] },
  { date: '2026-10-05', balance: 74913.4, actual: false, operations: [] },
  { date: '2026-10-06', balance: 126913.4, actual: false, operations: [] },
];

const forecast = forecastOf({
  today: '2026-10-03',
  balance: 102913.4,
  dailySpending: 900,
  days,
  events: [
    { date: '2026-10-01', recurringId: 1, name: 'Комунальні', amount: -2300, overdue: true, categoryId: 7 },
    { date: '2026-10-05', recurringId: 2, name: 'Оренда', amount: -14000, overdue: false, categoryId: null },
    { date: '2026-10-06', recurringId: 3, name: 'Зарплата', amount: 52000, overdue: false, categoryId: null },
  ],
  lowest: { date: '2026-10-05', balance: 74913.4, actual: false, operations: [] },
});

beforeEach(() => localStorage.clear());

function renderDashboard(handlers: Parameters<typeof mockApi>[0] = {}) {
  mockApi({
    ...signedInApi,
    'GET /api/v1/categories': () => json([categoryOf({ id: 7, name: 'Комуналка', icon: 'house' })]),
    'GET /api/v1/recurring': () => json([recurringOf({ id: 1 })]),
    'GET /api/v1/forecast': () => json(forecast),
    ...handlers,
  });
  renderApp('/');
}

it('shows the balance now, at the end and the planned payments', async () => {
  renderDashboard();

  const card = (await screen.findByText('Гроші до кінця місяця')).closest(
    '.mantine-Card-root',
  ) as HTMLElement;
  expect(plain((await within(card).findByText(/102\s913,40/)).textContent)).toBe('102 913,40 ₴');
  expect(within(card).getByText('Очікується 6 жовт.')).toBeInTheDocument();
  expect(plain(within(card).getByText(/126\s913,40/).textContent)).toBe('126 913,40 ₴');
  expect(
    within(card).getByRole('img', {
      name: (name) => plain(name).includes('зараз 102 913,40 ₴, прогноз на 6 жовт.'),
    }),
  ).toBeInTheDocument();

  expect(within(card).getByText('Оренда')).toBeInTheDocument();
  expect(plain(within(card).getByText(/52\s000,00/).textContent)).toBe('+52 000,00 ₴');
  expect(within(card).getByText('Прострочено')).toBeInTheDocument();
  // No minimum is set, so there is no warning
  expect(within(card).queryByText(/нижче мінімуму/)).not.toBeInTheDocument();
});

it('warns when the forecast drops below the minimum the viewer set', async () => {
  renderDashboard();
  const user = userEvent.setup();

  await user.click(await screen.findByRole('button', { name: 'Задати мінімальний залишок' }));
  await user.type(await screen.findByLabelText('Мінімальний залишок'), '80000');
  await user.click(await screen.findByRole('button', { name: 'Зберегти' }));

  expect(plain((await screen.findByText(/залишок опуститься до/)).textContent)).toBe(
    '5 жовт. залишок опуститься до 74 913,40 ₴ — нижче мінімуму 80 000,00 ₴',
  );
  expect(loadMinimum()).toBe(80000);
  expect(
    screen.getByRole('button', { name: (name) => plain(name) === 'Мінімум 80 000,00 ₴' }),
  ).toBeInTheDocument();
});

it('says the balance stays above a lower minimum', async () => {
  localStorage.setItem('ww-forecast-minimum', '50000');
  renderDashboard();

  expect(await screen.findByText('Залишок не опускається нижче мінімуму')).toBeInTheDocument();
});

it('points to recurring payments when there are none', async () => {
  renderDashboard({
    'GET /api/v1/recurring': () => json([]),
    'GET /api/v1/forecast': () => json(forecastOf({ today: '2026-10-03' })),
  });

  expect(await screen.findByText(/Тут з’являться регулярні платежі/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'До операцій' })).toHaveAttribute('href', '/transactions');
});

it('expects overdue payments tomorrow and scales the minimum into the chart', () => {
  expect(expectedDate(forecast.events[0]!, '2026-10-03')).toBe('2026-10-04');
  expect(expectedDate(forecast.events[2]!, '2026-10-03')).toBe('2026-10-06');

  const chart = forecastChart(forecast, 60000);
  expect(chart.lo).toBe(50000);
  expect(chart.hi).toBe(140000);
  expect(chart.todayIndex).toBe(2);
  expect(chart.actual.split(' ')).toHaveLength(3);
  expect(chart.forecast.split(' ')).toHaveLength(4);
  expect(chart.markers.map((marker) => marker.income)).toEqual([false, false, true]);
  // The lowest balance is lower on the chart than the start
  expect(chart.y(74913.4)).toBeGreaterThan(chart.y(121400));
});
