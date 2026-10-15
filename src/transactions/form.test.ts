import { formErrors, initialTransactionValues, splitRemainder, toTransactionBody } from './form';
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

describe('formErrors', () => {
  it('maps indexed backend fields to form paths', () => {
    expect(formErrors({ errors: [{ field: 'splits[1].amount', message: 'має бути більше 0' }] })).toEqual({
      'splits.1.amount': 'має бути більше 0',
    });
  });
});
