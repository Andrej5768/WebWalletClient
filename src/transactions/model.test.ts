import { groupByDay, isUncategorized, toRequest, type Transaction } from './model';

const expense: Transaction = {
  id: 1,
  type: 'EXPENSE',
  date: '2026-10-15',
  accountId: 7,
  amount: 1284.5,
  currency: 'UAH',
  payee: { id: 3, name: 'Сільпо' },
  splits: [{ id: 11, categoryId: 20, amount: 1284.5 }],
  tagIds: [5],
};

describe('toRequest', () => {
  it('keeps the transaction and applies changes', () => {
    expect(toRequest(expense, { categoryId: 21 })).toMatchObject({
      type: 'EXPENSE',
      date: '2026-10-15',
      accountId: 7,
      amount: 1284.5,
      payeeId: 3,
      categoryId: 21,
      tagIds: [5],
      splits: undefined,
    });
  });

  it('keeps splits of a split transaction', () => {
    const split: Transaction = {
      ...expense,
      splits: [
        { categoryId: 20, amount: 1000 },
        { categoryId: 22, amount: 284.5, comment: 'хімія' },
      ],
    };
    expect(toRequest(split)).toMatchObject({
      categoryId: undefined,
      splits: [
        { categoryId: 20, amount: 1000 },
        { categoryId: 22, amount: 284.5, comment: 'хімія' },
      ],
    });
  });
});

describe('isUncategorized', () => {
  it('is true without a category and never for transfers', () => {
    expect(isUncategorized({ ...expense, splits: [{ amount: 10 }] })).toBe(true);
    expect(isUncategorized({ ...expense, splits: [] })).toBe(true);
    expect(isUncategorized(expense)).toBe(false);
    expect(isUncategorized({ ...expense, type: 'TRANSFER', splits: [] })).toBe(false);
  });
});

describe('groupByDay', () => {
  it('groups by date with net totals per currency, without transfers', () => {
    const days = groupByDay([
      expense,
      { ...expense, id: 2, type: 'INCOME', amount: 500 },
      { ...expense, id: 3, type: 'TRANSFER', amount: 9999 },
      { ...expense, id: 4, date: '2026-10-14', currency: 'USD', amount: 9.99 },
    ]);
    expect(days.map((day) => day.date)).toEqual(['2026-10-15', '2026-10-14']);
    expect(days[0]?.totals).toEqual([{ currency: 'UAH', amount: -784.5 }]);
    expect(days[1]?.totals).toEqual([{ currency: 'USD', amount: -9.99 }]);
  });
});
