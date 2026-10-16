import { cashChange, fifoPreview, initialOperationValues, toOperationBody } from './form';

const position = {
  averagePrice: 166.7,
  lots: [
    { operationId: 5, date: '2025-12-01', quantity: 5, remaining: 0, unitCost: 90, unrealized: null },
    { operationId: 2, date: '2026-06-10', quantity: 10, remaining: 10, unitCost: 200, unrealized: 200 },
    { operationId: 1, date: '2026-01-10', quantity: 10, remaining: 5, unitCost: 100.1, unrealized: 599.5 },
  ],
};

it('takes the oldest open lots first and compares with the average price', () => {
  const preview = fifoPreview(position, 8, 250, 2);

  expect(preview.parts).toEqual([
    { operationId: 1, date: '2026-01-10', quantity: 5, unitCost: 100.1 },
    { operationId: 2, date: '2026-06-10', quantity: 3, unitCost: 200 },
  ]);
  expect(preview.cost).toBe(1100.5);
  expect(preview.proceeds).toBe(1998);
  expect(preview.realized).toBe(897.5);
  expect(preview.realizedByAverage).toBe(664.4);
  expect(preview.missing).toBe(0);
  expect(fifoPreview(position, 20, 250, 0).missing).toBe(5);
});

it('builds the request of each type and the change of cash', () => {
  const buy = {
    ...initialOperationValues(null, { accountId: 3, instrumentId: 7 }),
    quantity: 3,
    price: 10.5,
    fee: 1,
  };
  expect(toOperationBody(buy)).toMatchObject({
    type: 'BUY',
    accountId: 3,
    instrumentId: 7,
    quantity: 3,
    price: 10.5,
    fee: 1,
    amount: 31.5,
  });
  expect(cashChange(buy)).toBe(-32.5);

  const dividend = { ...buy, type: 'DIVIDEND' as const, amount: 10, tax: 1.5 };
  const body = toOperationBody(dividend);
  expect(body).toMatchObject({ type: 'DIVIDEND', amount: 10, tax: 1.5 });
  expect(body.quantity).toBeUndefined();
  expect(cashChange(dividend)).toBe(8.5);

  const split = { ...buy, type: 'SPLIT' as const, splitFrom: 1, splitTo: 4 };
  expect(toOperationBody(split)).toMatchObject({
    type: 'SPLIT',
    splitFrom: 1,
    splitTo: 4,
    amount: undefined,
  });
  expect(cashChange(split)).toBe(0);
});
