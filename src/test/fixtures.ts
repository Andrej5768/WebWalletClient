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

/** An investment account at a broker, in dollars and outside the budget. */
export function brokerOf(overrides: Partial<Schemas['AccountResponse']> = {}): Schemas['AccountResponse'] {
  return accountOf({
    id: 3,
    name: 'Interactive Brokers',
    type: 'INVESTMENT',
    currency: 'USD',
    inBudget: false,
    ...overrides,
  });
}

export function accountsSummaryOf(
  overrides: Partial<Schemas['AccountSummaryResponse']> = {},
): Schemas['AccountSummaryResponse'] {
  return {
    currency: 'UAH',
    netWorth: 0,
    available: 0,
    availableWithCredit: 0,
    readyToAssign: 0,
    unconvertedCurrencies: [],
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
    carryOver: false,
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
    recurring: null,
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

export function occurrenceOf(
  overrides: Partial<Schemas['OccurrenceResponse']> = {},
): Schemas['OccurrenceResponse'] {
  return {
    recurringId: 1,
    name: 'Оренда',
    date: '2026-10-24',
    status: 'PENDING',
    overdue: false,
    type: 'EXPENSE',
    accountId: 1,
    amount: 14000,
    currency: 'UAH',
    toAccountId: null,
    toAmount: null,
    categoryId: null,
    payee: null,
    autoCreate: false,
    variableAmount: false,
    transactionId: null,
    ...overrides,
  };
}

export function recurringOf(
  overrides: Partial<Schemas['RecurringResponse']> = {},
): Schemas['RecurringResponse'] {
  return {
    id: 1,
    name: 'Оренда',
    type: 'EXPENSE',
    accountId: 1,
    amount: 14000,
    currency: 'UAH',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
    categoryId: null,
    payee: null,
    comment: null,
    frequency: 'MONTHLY',
    interval: 1,
    startDate: '2026-09-24',
    endDate: null,
    autoCreate: false,
    variableAmount: false,
    tolerance: 10,
    nextDate: '2026-10-24',
    ...overrides,
  };
}

export function instrumentOf(
  overrides: Partial<Schemas['InstrumentResponse']> = {},
): Schemas['InstrumentResponse'] {
  return {
    id: 1,
    symbol: 'AAPL',
    name: 'Apple Inc',
    type: 'STOCK',
    currency: 'USD',
    exchange: 'NASDAQ',
    micCode: 'XNGS',
    isin: null,
    valuation: 'MARKET',
    own: false,
    nominal: null,
    couponRate: null,
    couponFrequency: null,
    maturityDate: null,
    price: null,
    priceDate: null,
    ...overrides,
  };
}

/** AAPL with a price, as the operations and the instrument page see it. */
export function tradedOf(
  overrides: Partial<Schemas['InstrumentResponse']> = {},
): Schemas['InstrumentResponse'] {
  return instrumentOf({ id: 7, price: 220, priceDate: '2026-10-15', ...overrides });
}

export function positionOf(
  overrides: Partial<Schemas['PositionResponse']> = {},
): Schemas['PositionResponse'] {
  return {
    accountId: 1,
    instrument: instrumentOf(),
    quantity: 0,
    averagePrice: 0,
    price: null,
    priceDate: null,
    dayChange: null,
    value: 0,
    cost: 0,
    unrealized: 0,
    unrealizedShare: null,
    valueInBase: null,
    share: null,
    ...overrides,
  };
}

export function portfolioOf(
  overrides: Partial<Schemas['PortfolioResponse']> = {},
): Schemas['PortfolioResponse'] {
  return {
    currency: 'UAH',
    value: 0,
    deposited: 0,
    invested: 0,
    unrealized: 0,
    unrealizedShare: null,
    realizedThisYear: 0,
    dividendsLast12Months: 0,
    dayChange: 0,
    pricesAsOf: null,
    positions: [],
    cash: [],
    byType: [],
    byCurrency: [],
    bySector: [],
    unconvertedCurrencies: [],
    ...overrides,
  };
}

export function historyOf(overrides: Partial<Schemas['HistoryResponse']> = {}): Schemas['HistoryResponse'] {
  return {
    currency: 'UAH',
    from: '2026-01-01',
    to: '2026-10-15',
    benchmark: null,
    points: [],
    returns: { twr: null, twrAnnualized: null, xirr: null, benchmarkTwr: null, benchmarkXirr: null },
    unconvertedCurrencies: [],
    ...overrides,
  };
}

export function dividendEventOf(overrides: Partial<Schemas['CalendarEvent']> = {}): Schemas['CalendarEvent'] {
  return {
    date: '2026-11-15',
    exDate: null,
    status: 'FORECAST',
    accountId: 1,
    instrumentId: 1,
    symbol: 'AAPL',
    name: 'Apple Inc',
    type: 'STOCK',
    quantity: 10,
    perShare: 0.26,
    gross: 2.6,
    tax: 0.39,
    net: 2.21,
    currency: 'USD',
    grossInTarget: 2.6,
    netInTarget: 2.21,
    taxEstimated: true,
    ...overrides,
  };
}

export function dividendCalendarOf(
  overrides: Partial<Schemas['CalendarResponse']> = {},
): Schemas['CalendarResponse'] {
  return {
    currency: 'USD',
    from: '2025-10-01',
    to: '2027-10-31',
    next12Months: 0,
    next12MonthsNet: 0,
    monthly: 0,
    yield: null,
    yieldOnCost: null,
    received12Months: 0,
    months: [],
    receivedByInstrument: [],
    events: [],
    unconvertedCurrencies: [],
    ...overrides,
  };
}

export function investmentOperationOf(
  overrides: Partial<Schemas['OperationResponse']> = {},
): Schemas['OperationResponse'] {
  return {
    id: 1,
    type: 'BUY',
    accountId: 3,
    instrumentId: 7,
    symbol: 'AAPL',
    date: '2026-01-10',
    quantity: 10,
    price: 100,
    amount: 1000,
    fee: 0,
    tax: 0,
    currency: 'USD',
    cash: -1000,
    toAmount: null,
    toCurrency: null,
    splitFrom: null,
    splitTo: null,
    comment: null,
    ...overrides,
  };
}

export function positionDetailOf(
  overrides: Partial<Schemas['PositionDetailResponse']> = {},
): Schemas['PositionDetailResponse'] {
  return {
    instrument: instrumentOf({ id: 7, price: 220, priceDate: '2026-10-15' }),
    accountId: 3,
    quantity: 0,
    averagePrice: null,
    price: 220,
    value: 0,
    cost: 0,
    unrealized: 0,
    realized: 0,
    dividends: 0,
    lots: [],
    sales: [],
    operations: [],
    ...overrides,
  };
}
