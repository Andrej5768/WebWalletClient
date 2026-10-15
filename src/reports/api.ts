import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { Period } from '../transactions/periods';

async function unwrap<T>(call: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error !== undefined || data === undefined) throw error ?? new Error('Empty response');
  return data;
}

const options = { placeholderData: keepPreviousData };

export function useSpending(period: Period) {
  return useQuery({
    queryKey: ['reports', 'spending', period],
    queryFn: () => unwrap(api.GET('/api/v1/reports/spending', { params: { query: period } })),
    ...options,
  });
}

export function useIncomeExpense(period: Period) {
  return useQuery({
    queryKey: ['reports', 'income-expense', period],
    queryFn: () => unwrap(api.GET('/api/v1/reports/income-expense', { params: { query: period } })),
    ...options,
  });
}

export function useNetWorth(period: Period) {
  return useQuery({
    queryKey: ['reports', 'net-worth', period],
    queryFn: () => unwrap(api.GET('/api/v1/reports/net-worth', { params: { query: period } })),
    ...options,
  });
}

export function usePayeeReport(period: Period) {
  return useQuery({
    queryKey: ['reports', 'payees', period],
    queryFn: () => unwrap(api.GET('/api/v1/reports/payees', { params: { query: { ...period, limit: 30 } } })),
    ...options,
  });
}
