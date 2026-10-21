import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { kyivToday } from '../lib/periods';
import { accountOf, categoryOf, splitOf, transactionOf } from '../test/fixtures';
import { bodyOf, json, mockApi, plain, renderApp, signedInApi } from '../test/render';
import type { FopReport, InvestmentTaxReport, TaxRates } from './api';
import { initialQuarter, markFor, quarterState, toCsv } from './model';

// A past year: every quarter is over
const year = kyivToday().year() - 1;

const rates: TaxRates = {
  fopGroup: 3,
  fopVat: false,
  singleTaxRate: 5,
  fopMilitaryRate: 1,
  singleTaxMonthly: 1729.4,
  fopMilitaryMonthly: 864.7,
  esvEnabled: true,
  esvRate: 22,
  minWage: 8647,
  pdfoRate: 18,
  investmentMilitaryRate: 5,
  foreignDocumentDefault: false,
};

const quarter = (number: number, income: number, paid = false) => ({
  quarter: number,
  income,
  singleTax: income * 0.05,
  military: income * 0.01,
  esv: 5707.02,
  total: income * 0.06 + 5707.02,
  declarationDue: `${year}-0${Math.min(9, number * 3)}-10`,
  taxDue: `${year}-0${Math.min(9, number * 3)}-20`,
  esvDue: `${year}-0${Math.min(9, number * 3)}-20`,
  paid,
});

const fop: FopReport = {
  year,
  rates,
  fopAccountIds: [5],
  quarters: [quarter(1, 400000, true), quarter(2, 420000), quarter(3, 145075), quarter(4, 0)],
  totals: { income: 965075, singleTax: 48253.75, military: 9650.75, esv: 22828.08, total: 80732.58 },
  incomeLimit: 10091049,
  incomes: [
    {
      transactionId: 12,
      date: `${year}-08-22`,
      quarter: 3,
      accountId: 5,
      accountName: 'ФОП · Monobank',
      payee: 'Повернення платежу',
      comment: null,
      amount: 1200,
      currency: 'UAH',
      rate: null,
      amountUah: 1200,
      included: false,
      reason: 'ACCOUNT',
    },
    {
      transactionId: 11,
      date: `${year}-08-01`,
      quarter: 3,
      accountId: 5,
      accountName: 'ФОП · Monobank',
      payee: 'Acme Corp',
      comment: null,
      amount: 3500,
      currency: 'USD',
      rate: 41.45,
      amountUah: 145075,
      included: true,
      reason: 'ACCOUNT',
    },
  ],
  unconvertedCurrencies: [],
};

const investments: InvestmentTaxReport = {
  year,
  rates,
  dividends: [
    {
      operationId: 21,
      date: `${year}-06-01`,
      accountId: 3,
      symbol: 'SCHD',
      type: 'DIVIDEND',
      amount: 10,
      withheld: 1.5,
      currency: 'USD',
      rate: 40,
      amountUah: 400,
      withheldUah: 60,
      document: false,
      documentSet: false,
      credit: 0,
      pdfo: 72,
      military: 20,
    },
  ],
  sales: [
    {
      operationId: 22,
      date: `${year}-03-01`,
      accountId: 3,
      symbol: 'SPYD',
      quantity: 6,
      currency: 'USD',
      proceeds: 660,
      cost: 600,
      incomeUah: 26400,
      costUah: 18000,
      resultUah: 8400,
      resultInCurrency: 60,
    },
  ],
  dividendsUah: 400,
  creditUah: 0,
  profit: 8400,
  carriedIn: 1200,
  taxableProfit: 7200,
  carriedOut: 0,
  pdfo: 1368,
  military: 380,
  total: 1748,
  declarationDue: `${year + 1}-05-01`,
  paymentDue: `${year + 1}-07-31`,
  unconvertedCurrencies: [],
};

const settings = {
  year,
  values: rates,
  defaults: rates,
  sources: { taxCode: 'https://zakon.rada.gov.ua/laws/show/2755-17', taxService: 'https://tax.gov.ua/' },
  incomeCategoryIds: [],
};

function api(extra = {}) {
  return mockApi({
    ...signedInApi,
    'GET /api/v1/accounts': () => json([accountOf({ id: 5, name: 'ФОП · Monobank', type: 'FOP' })]),
    'GET /api/v1/categories': () => json([categoryOf({ id: 7, name: 'Фриланс', kind: 'INCOME' })]),
    [`GET /api/v1/taxes/fop/${year}`]: () => json(fop),
    [`GET /api/v1/taxes/investments/${year}`]: () => json(investments),
    [`GET /api/v1/taxes/settings/${year}`]: () => json(settings),
    'GET /api/v1/taxes/profile': () => json({ code: 'NOT_FOUND' }, 404),
    ...extra,
  });
}

it('tells the state of a quarter and which mark an income switch sets', () => {
  expect(quarterState(quarter(1, 1, true), year, `${year}-10-01`)).toBe('paid');
  expect(quarterState(quarter(3, 1), year, `${year}-10-01`)).toBe('due');
  expect(quarterState(quarter(4, 1), year, `${year}-10-01`)).toBe('running');
  expect(initialQuarter(fop.quarters, year, `${year}-08-15`)).toBe(3);
  expect(initialQuarter(fop.quarters, year, `${year + 1}-01-15`)).toBe(3);
  // Counted by the rules: off takes it out, on forgets the mark
  expect(markFor(false, 'ACCOUNT')).toBe(false);
  expect(markFor(true, 'CATEGORY')).toBeNull();
  // Not counted by the rules: on adds it, off forgets
  expect(markFor(true, null)).toBe(true);
  expect(markFor(false, undefined)).toBeNull();
  expect(toCsv([['a;b', 1, null], ['"x"']])).toBe('﻿"a;b";1;\n"""x"""');
  // Decimal commas without grouping, and text that looks like a formula stays text
  expect(toCsv([[12.05, -1234.5, '=SUM(A1)', '+1', '-x', '@a', 'ok']])).toBe(
    "﻿12,05;-1234,5;'=SUM(A1);'+1;'-x;'@a;ok",
  );
});

it('shows the quarters of the sole proprietor, marks one paid and takes an income out', async () => {
  const requests = api({
    [`PUT /api/v1/taxes/fop/${year}/quarters/2`]: () => new Response(null, { status: 204 }),
    'PUT /api/v1/taxes/transactions/11': () => new Response(null, { status: 204 }),
    'PUT /api/v1/taxes/transactions/12': () => new Response(null, { status: 204 }),
  });
  renderApp(`/taxes?year=${year}`);

  expect(await screen.findByText(/ФОП 3 групи: єдиний податок 5/)).toBeInTheDocument();
  expect(screen.getByText(/ФОП · Monobank\./)).toBeInTheDocument();
  expect(plain(screen.getByText(`Дохід за ${year}`).parentElement?.textContent)).toContain('965 075,00');
  expect(screen.getByText('Сплачено', { selector: '.mantine-Badge-label' })).toBeInTheDocument();
  expect(screen.getAllByText(/До сплати/)).toHaveLength(3);
  expect(screen.getByText(`Надходження за 3 квартал ${year}`)).toBeInTheDocument();
  expect(screen.getByText('не дохід')).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText('Податки за 2 квартал сплачено'));
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', `/api/v1/taxes/fop/${year}/quarters/2`)).toEqual({ paid: true }),
  );

  await userEvent.click(screen.getByLabelText(`Враховувати Acme Corp, 01.08.${year}`));
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/taxes/transactions/11')).toEqual({ included: false }),
  );
  // Counted by its account: turning it on again forgets the mark
  await userEvent.click(screen.getByLabelText(`Враховувати Повернення платежу, 22.08.${year}`));
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/taxes/transactions/12')).toEqual({}),
  );
});

it('shows the investment taxes and marks the document of a foreign tax', async () => {
  const requests = api({
    'PUT /api/v1/taxes/investments/dividends/21': () => new Response(null, { status: 204 }),
  });
  renderApp(`/taxes?year=${year}&tab=investments`);

  expect(await screen.findByText('Дивіденди й купони')).toBeInTheDocument();
  const summary = plain(screen.getByText('Разом до сплати').parentElement?.textContent);
  expect(summary).toContain('1 748,00');
  expect(plain(screen.getByText('Збиток минулих років, перенесений').parentElement?.textContent)).toContain(
    '-1 200,00',
  );
  expect(screen.getAllByText('+8 400,00 ₴').length).toBeGreaterThan(0);

  await userEvent.click(screen.getByLabelText(`Документ про податок за кордоном для SCHD, 01.06.${year}`));
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/taxes/investments/dividends/21')).toEqual({
      document: true,
    }),
  );
});

it('saves own rates and the income categories, leaving the defaults as defaults', async () => {
  const requests = api({
    [`PUT /api/v1/taxes/settings/${year}`]: () => json(settings),
    'PUT /api/v1/taxes/income-categories': () => json([7]),
  });
  renderApp(`/taxes?year=${year}`);

  await userEvent.click(await screen.findByRole('button', { name: `Ставки ${year}` }));
  const drawer = within(await screen.findByRole('dialog'));
  const military = drawer.getAllByRole('textbox', { name: 'Військовий збір' })[0]!;
  await userEvent.clear(military);
  await userEvent.type(military, '0');
  expect(drawer.getAllByRole('button', { name: 'Повернути' })).toHaveLength(1);
  await userEvent.click(drawer.getByLabelText('Сплачую мінімальний ЄСВ'));
  await userEvent.click(drawer.getByLabelText('Категорії доходу ФОП'));
  await userEvent.click(await screen.findByRole('option', { name: 'Фриланс', hidden: true }));
  await userEvent.click(drawer.getByRole('button', { name: 'Зберегти' }));

  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', `/api/v1/taxes/settings/${year}`)).toEqual({
      fopMilitaryRate: 0,
      esvEnabled: false,
    }),
  );
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/taxes/income-categories')).toEqual({ categoryIds: [7] }),
  );
});

it('adds an income on another account to the income of the sole proprietor from its panel', async () => {
  const income = transactionOf({ id: 31, type: 'INCOME', amount: 700, splits: [splitOf({ amount: 700 })] });
  const requests = api({
    'GET /api/v1/accounts': () => json([accountOf({ id: 1, name: 'Картка' })]),
    'GET /api/v1/transactions/31': () => json(income),
    'GET /api/v1/taxes/transactions/31': () =>
      json({ mark: null, counted: false, reason: null, ruleReason: null }),
    'PUT /api/v1/taxes/transactions/31': () => new Response(null, { status: 204 }),
  });
  renderApp('/transactions?edit=31');

  const panel = within(await screen.findByRole('dialog'));
  const toggle = await panel.findByRole('switch', { name: /Дохід ФОП для податків/ });
  expect(toggle).not.toBeChecked();
  expect(panel.getByText('Не рахується доходом ФОП')).toBeInTheDocument();
  await userEvent.click(toggle);
  await waitFor(async () =>
    expect(await bodyOf(requests, 'PUT', '/api/v1/taxes/transactions/31')).toEqual({ included: true }),
  );
});

it('asks for the taxpayer details before writing a declaration, then downloads it', async () => {
  const profile = {
    tin: '1234567890',
    name: 'Коваль Олена Петрівна',
    regionCode: 26,
    districtCode: 50,
    taxOffice: 'ГУ ДПС у м. Києві',
    city: 'м. Київ',
    street: 'вул. Хрещатик',
    kvedCode: '62.01',
    kvedName: 'Комп’ютерне програмування',
  };
  let saved = false;
  const requests = api({
    'GET /api/v1/taxes/profile': () => (saved ? json(profile) : json({ code: 'NOT_FOUND' }, 404)),
    'PUT /api/v1/taxes/profile': () => {
      saved = true;
      return json(profile);
    },
    [`GET /api/v1/taxes/declarations/fop/${year}/2`]: () =>
      new Response('<DECLAR/>', {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': 'attachment; filename="26501234567890F0103309100000000130620252650.xml"',
        },
      }),
  });
  const createObjectURL = vi.fn(() => 'blob:declaration');
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  renderApp(`/taxes?year=${year}`);

  // Without the details the button opens their form
  await userEvent.click(await screen.findByRole('button', { name: 'XML декларації за 2 квартал' }));
  const drawer = within(await screen.findByRole('dialog'));
  await userEvent.type(await drawer.findByLabelText(/РНОКПП/), '1234567890');
  await userEvent.type(drawer.getByLabelText(/Прізвище, ім’я, по батькові/), 'Коваль Олена Петрівна');
  await userEvent.type(drawer.getByLabelText(/Код ДПС/), '2650');
  await userEvent.type(drawer.getByLabelText(/Назва податкової/), 'ГУ ДПС у м. Києві');
  await userEvent.type(drawer.getByLabelText(/Населений пункт/), 'м. Київ');
  await userEvent.type(drawer.getByLabelText(/Вулиця/), 'вул. Хрещатик');
  await userEvent.type(drawer.getByLabelText('Назва КВЕД'), 'Комп’ютерне програмування');
  await userEvent.type(drawer.getByLabelText('КВЕД'), '62.01');
  await userEvent.click(drawer.getByRole('button', { name: 'Зберегти' }));
  await waitFor(async () => expect(await bodyOf(requests, 'PUT', '/api/v1/taxes/profile')).toEqual(profile));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: 'XML декларації за 2 квартал' }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(requests.some((request) => request.url.endsWith(`/declarations/fop/${year}/2`))).toBe(true);
});
