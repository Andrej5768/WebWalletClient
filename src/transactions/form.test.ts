import {
  formErrors,
  initialTransactionValues,
  splitRemainder,
  swapAccounts,
  switchType,
  toTransactionBody,
} from './form';
import { transactionOf } from '../test/fixtures';

const transfer = transactionOf({
  id: 1,
  type: 'TRANSFER',
  date: '2026-10-14',
  accountId: 1,
  toAccountId: 2,
  amount: 1000,
  toAmount: 990,
  currency: 'UAH',
  toCurrency: 'UAH',
  splits: [],
  tagIds: [7],
  source: 'MONOBANK',
});

describe('toTransactionBody', () => {
  it('keeps the fee of a same-currency transfer', () => {
    const values = initialTransactionValues(transfer, new Map([[7, 'дім']]));
    expect(toTransactionBody(values, [7])).toMatchObject({
      type: 'TRANSFER',
      amount: 1000,
      toAmount: 990,
      tagIds: [7],
    });
  });

  it('sends the amount as received when the transfer has no received amount yet', () => {
    const values = {
      ...initialTransactionValues(null, new Map()),
      type: 'TRANSFER' as const,
      amount: 500,
      accountId: '1',
      toAccountId: '2',
    };
    expect(toTransactionBody(values, []).toAmount).toBe(500);
  });

  it('sends splits instead of a category', () => {
    const values = {
      ...initialTransactionValues(null, new Map(), 1),
      amount: 300,
      categoryId: '5',
      split: true,
      splits: [
        { categoryId: '5', amount: 200, comment: '' },
        { categoryId: null, amount: 100, comment: ' хімія ' },
      ],
    };
    expect(toTransactionBody(values, [])).toMatchObject({
      categoryId: undefined,
      splits: [
        { categoryId: 5, amount: 200, comment: undefined },
        { categoryId: undefined, amount: 100, comment: 'хімія' },
      ],
    });
    expect(splitRemainder(values)).toBe(0);
  });
});

describe('switchType', () => {
  const income = {
    ...initialTransactionValues(null, new Map(), 1),
    type: 'INCOME' as const,
    categoryId: '20',
  };

  it('moves the account of an income to the receiving side of a transfer and back', () => {
    const transfer = { ...income, ...switchType(income, 'TRANSFER') };
    expect(transfer).toMatchObject({ type: 'TRANSFER', accountId: null, toAccountId: '1' });
    expect({ ...transfer, ...switchType(transfer, 'INCOME') }).toMatchObject({
      type: 'INCOME',
      accountId: '1',
      toAccountId: null,
    });
  });

  it('keeps the account of an expense as the sending side of a transfer', () => {
    const expense = { ...income, type: 'EXPENSE' as const };
    expect(switchType(expense, 'TRANSFER')).toEqual({ type: 'TRANSFER' });
  });

  it('drops the categories when the kind changes', () => {
    expect(switchType(income, 'EXPENSE')).toMatchObject({ type: 'EXPENSE', categoryId: null });
    expect(switchType({ ...income, type: 'EXPENSE' }, 'TRANSFER')).not.toHaveProperty('categoryId');
  });
});

describe('swapAccounts', () => {
  it('swaps the accounts and, when asked and a received amount is set, the amounts too', () => {
    const values = initialTransactionValues(transfer, new Map());
    expect(swapAccounts(values)).toEqual({ accountId: '2', toAccountId: '1', amount: 990, toAmount: 1000 });
    expect(swapAccounts(values, false)).toEqual({ accountId: '2', toAccountId: '1' });
    expect(swapAccounts({ ...values, toAmount: '' })).toEqual({ accountId: '2', toAccountId: '1' });
  });
});

describe('formErrors', () => {
  it('maps indexed backend fields to form paths', () => {
    expect(formErrors({ errors: [{ field: 'splits[1].amount', message: 'має бути більше 0' }] })).toEqual({
      'splits.1.amount': 'має бути більше 0',
    });
  });
});
