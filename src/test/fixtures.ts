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
