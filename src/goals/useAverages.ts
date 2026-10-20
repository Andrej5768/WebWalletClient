import { useMemo } from 'react';
import type { Schemas } from '../api/client';
import { kyivToday, periodOf } from '../lib/periods';
import { useIncomeExpense } from '../reports/api';

/** Fewer complete months than this make the averages a rough guess; the screens say so. */
export const FEW_MONTHS = 3;

export interface Averages {
  /** Complete months the averages are taken over. */
  months: number;
  monthlyExpenses: number | null;
  monthlySavings: number | null;
  /** Savings over income of those months, null without income. */
  savingsRate: number | null;
}

/**
 * Averages over the complete months with data of the report: from the first month with any income or expense up to
 * the month before the current one, which is not over yet. Empty months before the history starts would make the
 * expenses look smaller and the savings rate higher than they are.
 */
export function averagesOf(
  months: Schemas['MonthIncomeExpense'][],
  currentMonth: string = kyivToday().format('YYYY-MM'),
): Averages {
  const complete = months.filter((month) => month.month < currentMonth);
  const first = complete.findIndex((month) => month.income !== 0 || month.expense !== 0);
  const counted = first < 0 ? [] : complete.slice(first);
  if (counted.length === 0) {
    return { months: 0, monthlyExpenses: null, monthlySavings: null, savingsRate: null };
  }
  const income = counted.reduce((sum, month) => sum + month.income, 0);
  const expense = counted.reduce((sum, month) => sum + month.expense, 0);
  return {
    months: counted.length,
    monthlyExpenses: expense / counted.length,
    monthlySavings: (income - expense) / counted.length,
    savingsRate: income > 0 ? (income - expense) / income : null,
  };
}

/** Average monthly expenses and savings over the complete months of the last year, null without data. */
export function useAverages() {
  const year = useMemo(() => periodOf('twelveMonths'), []);
  const report = useIncomeExpense(year);
  const averages = useMemo(() => averagesOf(report.data?.months ?? []), [report.data]);
  return { query: report, currency: report.data?.currency ?? 'UAH', ...averages };
}
