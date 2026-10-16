import type { Schemas } from '../api/client';

// Complete API objects for tests: every field the server always sends, with overrides on top.

export function accountOf(overrides: Partial<Schemas['AccountResponse']> = {}): Schemas['AccountResponse'] {
  return {
    id: 1,
    name: 'Картка',
    type: 'CARD',
    currency: 'UAH',
    balance: 0,
    balanceInBase: 0,
    openingBalance: 0,
    creditLimit: null,
    availableCredit: null,
    interestRate: null,
    inBudget: true,
    archived: false,
    sortOrder: 0,
    ...overrides,
  };
}

export function categoryOf(
  overrides: Partial<Schemas['CategoryResponse']> = {},
): Schemas['CategoryResponse'] {
  return {
    id: 1,
    name: 'Категорія',
    kind: 'EXPENSE',
    parentId: null,
    icon: null,
    color: null,
    necessity: null,
    archived: false,
    sortOrder: 0,
    children: [],
    ...overrides,
  };
}

export function splitOf(overrides: Partial<Schemas['SplitResponse']> = {}): Schemas['SplitResponse'] {
  return { id: 1, categoryId: null, amount: 0, comment: null, ...overrides };
}

export function transactionOf(
  overrides: Partial<Schemas['TransactionResponse']> = {},
): Schemas['TransactionResponse'] {
  return {
    id: 1,
    type: 'EXPENSE',
    date: '2026-10-15',
    accountId: 1,
    amount: 0,
    currency: 'UAH',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    originalAmount: null,
    originalCurrency: null,
    payee: null,
    comment: null,
    splits: [],
    tagIds: [],
    source: 'MANUAL',
    createdAt: '2026-10-15T10:00:00Z',
    ...overrides,
  } as Schemas['TransactionResponse'];
}

export function budgetRowOf(overrides: Partial<Schemas['CategoryRow']> = {}): Schemas['CategoryRow'] {
  const row = {
    categoryId: 1,
    name: 'Категорія',
    parentId: null,
    archived: false,
    children: [],
    ownAssigned: 0,
    ownActivity: 0,
    ownAvailable: 0,
    ...overrides,
  };
  // Like the server: a group's totals are its own envelope plus its subcategories.
  const total = (own: number, pick: (child: Schemas['CategoryRow']) => number) =>
    own + row.children.reduce((sum, child) => sum + pick(child), 0);
  return {
    assigned: total(row.ownAssigned, (child) => child.assigned),
    activity: total(row.ownActivity, (child) => child.activity),
    available: total(row.ownAvailable, (child) => child.available),
    ...row,
  };
}

/** A forecast of today only, without planned payments, unless overridden. */
export function forecastOf(
  overrides: Partial<Schemas['ForecastResponse']> = {},
): Schemas['ForecastResponse'] {
  const today = overrides.today ?? '2026-10-15';
  return {
    currency: 'UAH',
    today,
    balance: 0,
    dailySpending: 0,
    days: [{ date: today, balance: 0, actual: true }],
    events: [],
    lowest: null,
    unconvertedCurrencies: [],
    ...overrides,
  };
}

export function planRowOf(overrides: Partial<Schemas['PlanRow']> = {}): Schemas['PlanRow'] {
  return {
    categoryId: 1,
    name: 'Їжа',
    planned: 0,
    actual: 0,
    difference: 0,
    completion: null,
    plannedRemaining: 0,
    forecast: 0,
    children: [],
    ...overrides,
  };
}

export function goalOf(overrides: Partial<Schemas['GoalResponse']> = {}): Schemas['GoalResponse'] {
  return {
    id: 1,
    name: 'Ціль',
    targetAmount: 10000,
    currency: 'UAH',
    targetDate: null,
    accountId: null,
    saved: 0,
    remaining: 10000,
    progress: 0,
    startDate: '2026-10-01',
    startAmount: 0,
    expected: null,
    monthsLeft: null,
    monthlyNeeded: null,
    status: 'NO_DATE',
    achievedOn: null,
    icon: null,
    color: null,
    sortOrder: 0,
    ...overrides,
  };
}

export function goalsOf(
  goals: Schemas['GoalResponse'][],
  overrides: Partial<Schemas['GoalsResponse']> = {},
): Schemas['GoalsResponse'] {
  return {
    currency: 'UAH',
    saved: goals.reduce((sum, goal) => sum + goal.saved, 0),
    target: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
    monthlyNeeded: goals.reduce((sum, goal) => sum + (goal.monthlyNeeded ?? 0), 0),
    goals,
    unconvertedCurrencies: [],
    ...overrides,
  };
}

export function monthSavingsOf(overrides: Partial<Schemas['MonthSavings']> = {}): Schemas['MonthSavings'] {
  return {
    month: '2026-09',
    income: 0,
    expense: 0,
    net: 0,
    savingsRate: null,
    cumulative: 0,
    complete: true,
    destinations: [],
    ...overrides,
  };
}
