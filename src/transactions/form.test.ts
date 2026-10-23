import {
  debtDirection,
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

describe('debts', () => {
  const debtAccounts = new Set([9]);

  it('saves a debt given as a transfer to the debt account with the person as the payee', () => {
    const values = {
      ...initialTransactionValues(null, new Map(), 1),
      type: 'DEBT' as const,
      debtDirection: 'GAVE' as const,
      amount: 500,
      payee: ' Олег ',
    };
    expect(toTransactionBody(values, [], 9)).toMatchObject({
      type: 'TRANSFER',
      accountId: 1,
      toAccountId: 9,
      amount: 500,
      toAmount: 500,
      payeeName: 'Олег',
    });
  });

  it('saves a debt received as a transfer from the debt account, with the amount in its currency', () => {
    const values = {
      ...initialTransactionValues(null, new Map(), 2),
      type: 'DEBT' as const,
      debtDirection: 'RECEIVED' as const,
      amount: 10,
      toAmount: 415,
      payee: 'Олег',
    };
    expect(toTransactionBody(values, [], 9)).toMatchObject({
      type: 'TRANSFER',
      accountId: 9,
      amount: 415,
      toAccountId: 2,
      toAmount: 10,
      payeeName: 'Олег',
    });
  });

  it('opens a transfer with the debt account as a debt, with the own account and amount', () => {
    const received = transactionOf({ ...transfer, accountId: 9, toAccountId: 2, amount: 415, toAmount: 10 });
    expect(debtDirection(received, debtAccounts)).toBe('RECEIVED');
    expect(initialTransactionValues(received, new Map(), undefined, debtAccounts)).toMatchObject({
      type: 'DEBT',
      debtDirection: 'RECEIVED',
      accountId: '2',
      toAccountId: null,
      amount: 10,
      toAmount: 415,
    });
    expect(debtDirection(transfer, debtAccounts)).toBeUndefined();
    expect(initialTransactionValues(transfer, new Map(), undefined, debtAccounts).type).toBe('TRANSFER');
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
