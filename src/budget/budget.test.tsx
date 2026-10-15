import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { setAccessToken } from '../api/session';
import i18n from '../i18n';
import { json, mockApi, renderApp, signedInApi } from '../test/render';

const month = dayjs().format('YYYY-MM');
const previousMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

const budget = {
  month,
  currency: 'UAH',
  readyToAssign: 4250,
  assigned: 11000,
  activity: -7290,
  available: 3710,
  unconvertedCurrencies: [],
  categories: [
    {
      categoryId: 1,
      name: 'Їжа',
      assigned: 0,
      activity: 0,
      available: 0,
      children: [
        { categoryId: 2, name: 'Продукти', parentId: 1, assigned: 9000, activity: -4950, available: 4050 },
        { categoryId: 3, name: 'Кафе', parentId: 1, assigned: 2000, activity: -2340, available: -340 },
      ],
    },
  ],
};

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/categories': () => json([]),
    [`GET /api/v1/budget/${month}`]: () => json(budget),
    [`GET /api/v1/budget/${previousMonth}`]: () => json({ ...budget, month: previousMonth }),
    ...extra,
  });
}

beforeEach(async () => {
  setAccessToken(null);
  localStorage.clear();
  await i18n.changeLanguage('uk');
});

afterEach(() => vi.unstubAllGlobals());

const plain = (text: string | null) => (text ?? '').replace(/\s/g, ' ');

it('shows ready to assign, envelopes and overspending', async () => {
  api();
  renderApp('/budget');

  expect(plain((await screen.findByText(/4\s250,00/)).textContent)).toBe('4 250,00 ₴');
  expect(screen.getByText('Продукти')).toBeInTheDocument();
  expect(screen.getByText(/Перевитрата: Кафе/)).toBeInTheDocument();
});

it('saves a new assignment when the field loses focus', async () => {
  const requests = api({ [`PUT /api/v1/budget/${month}/categories/2`]: () => json({}) });
  renderApp('/budget');

  const input = await screen.findByLabelText('Призначено: Продукти');
  await userEvent.clear(input);
  await userEvent.type(input, '9500');
  fireEvent.blur(input);

  await waitFor(() => expect(requests.some((request) => request.method === 'PUT')).toBe(true));
  expect(await requests.find((request) => request.method === 'PUT')!.json()).toEqual({ assigned: 9500 });
});

it('covers overspending by moving money between envelopes', async () => {
  const requests = api({
    [`PUT /api/v1/budget/${month}/categories/2`]: () => json({}),
    [`PUT /api/v1/budget/${month}/categories/3`]: () => json({}),
  });
  renderApp('/budget');

  await userEvent.click(await screen.findByRole('button', { name: 'Покрити' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByLabelText('Сума')).toHaveValue('340');
  await userEvent.click(within(dialog).getByLabelText('Звідки'));
  await userEvent.keyboard('Продукти{ArrowDown}{Enter}');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Перемістити' }));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const puts = requests.filter((request) => request.method === 'PUT');
  expect(await puts[0]!.json()).toEqual({ assigned: 8660 });
  expect(await puts[1]!.json()).toEqual({ assigned: 2340 });
});
