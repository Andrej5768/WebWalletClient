import { averagesOf } from './useAverages';

const month = (key: string, income: number, expense: number) => ({
  month: key,
  income,
  expense,
  net: income - expense,
  savingsRate: income > 0 ? (income - expense) / income : null,
});

it('averages over the complete months with data, not the empty ones before or the current one', () => {
  const months = [
    month('2025-11', 0, 0),
    month('2025-12', 0, 0),
    month('2026-08', 40000, 25000),
    month('2026-09', 40000, 27000),
    month('2026-10', 0, 5000),
  ];

  const averages = averagesOf(months, '2026-10');

  expect(averages.months).toBe(2);
  expect(averages.monthlyExpenses).toBe(26000);
  expect(averages.monthlySavings).toBe(14000);
  expect(averages.savingsRate).toBeCloseTo(0.35);
});

it('has no averages without a complete month of data', () => {
  expect(averagesOf([month('2026-10', 1000, 500)], '2026-10')).toEqual({
    months: 0,
    monthlyExpenses: null,
    monthlySavings: null,
    savingsRate: null,
  });
});
