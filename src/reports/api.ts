import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';
import type { Period } from '../lib/periods';

const options = { placeholderData: keepPreviousData };

export function useSpending(period: Period) {
  return useQuery({
    queryKey: queryKeys.report('spending', period),
    queryFn: () => unwrap(api.GET('/api/v1/reports/spending', { params: { query: period } })),
    ...options,
  });
}

export function useIncomeExpense(period: Period) {
  return useQuery({
    queryKey: queryKeys.report('income-expense', period),
    queryFn: () => unwrap(api.GET('/api/v1/reports/income-expense', { params: { query: period } })),
    ...options,
  });
}

export function useNetWorth(period: Period) {
  return useQuery({
    queryKey: queryKeys.report('net-worth', period),
    queryFn: () => unwrap(api.GET('/api/v1/reports/net-worth', { params: { query: period } })),
    ...options,
  });
}

export function usePayeeReport(period: Period) {
  return useQuery({
    queryKey: queryKeys.report('payees', period),
    queryFn: () => unwrap(api.GET('/api/v1/reports/payees', { params: { query: { ...period, limit: 30 } } })),
    ...options,
  });
}
