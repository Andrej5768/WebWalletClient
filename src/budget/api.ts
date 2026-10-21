import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';
import type { MonthBudget } from './model';

export function useBudget(month: string) {
  return useQuery({
    queryKey: queryKeys.budgetMonth(month),
    queryFn: () => unwrap(api.GET('/api/v1/budget/{month}', { params: { path: { month } } })),
  });
}

export const assign = (month: string, categoryId: number, assigned: number) =>
  unwrap(
    api.PUT('/api/v1/budget/{month}/categories/{categoryId}', {
      params: { path: { month, categoryId } },
      body: { assigned },
    }),
  );

/** Moves money between the own envelopes of two categories; both change or neither. */
export const moveMoney = (month: string, fromCategoryId: number, toCategoryId: number, amount: number) =>
  unwrap(
    api.POST('/api/v1/budget/{month}/move', {
      params: { path: { month } },
      body: { fromCategoryId, toCategoryId, amount },
    }),
  );

/** Gives the envelopes without an assignment the one of the previous month. */
export const copyPreviousMonth = (month: string) =>
  unwrap(api.POST('/api/v1/budget/{month}/copy-previous', { params: { path: { month } } }));

/**
 * Stores the month the server returned after a change and refreshes what else depends on it: the
 * following months (rollover), the money ready to assign in the accounts summary and the reports (the plan of the
 * analytics compares spending with the budget).
 */
export async function budgetChanged(queryClient: QueryClient, month: MonthBudget): Promise<void> {
  queryClient.setQueryData(queryKeys.budgetMonth(month.month), month);
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.budget,
      predicate: (query) => query.queryKey[1] !== month.month,
    }),
    queryClient.invalidateQueries({ queryKey: queryKeys.accountsSummary }),
    queryClient.invalidateQueries({ queryKey: queryKeys.reports }),
  ]);
}
