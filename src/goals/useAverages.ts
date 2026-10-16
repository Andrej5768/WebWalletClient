import { useMemo } from 'react';
import { periodOf } from '../lib/periods';
import { useIncomeExpense } from '../reports/api';

/** Average monthly expenses and savings over the last 12 months, null while loading or without data. */
export function useAverages() {
  const year = useMemo(() => periodOf('twelveMonths'), []);
  const report = useIncomeExpense(year);
  const months = report.data?.months.length ?? 0;
  const data = report.data;
  return {
    query: report,
    currency: data?.currency ?? 'UAH',
    monthlyExpenses: data && months > 0 ? data.expense / months : null,
    monthlySavings: data && months > 0 ? data.net / months : null,
    savingsRate: data?.savingsRate ?? null,
  };
}
