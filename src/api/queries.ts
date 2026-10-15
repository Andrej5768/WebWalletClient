import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { flattenCategories } from '../lib/categories';
import { api } from './client';
import type { paths } from './schema';

async function unwrap<T>(call: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error !== undefined || data === undefined) throw error ?? new Error('Empty response');
  return data;
}

export const queryKeys = {
  accounts: ['accounts'] as const,
  accountsSummary: ['accounts', 'summary'] as const,
  monobank: ['banks', 'monobank'] as const,
  categories: ['categories'] as const,
  payees: ['payees'] as const,
  tags: ['tags'] as const,
  transactions: ['transactions'] as const,
};

export type TransactionQuery = NonNullable<paths['/api/v1/transactions']['get']['parameters']['query']>;

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => unwrap(api.GET('/api/v1/categories')),
    select: flattenCategories,
    staleTime: 5 * 60_000,
  });
}

export function usePayees() {
  return useQuery({ queryKey: queryKeys.payees, queryFn: () => unwrap(api.GET('/api/v1/payees')) });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: () => unwrap(api.GET('/api/v1/tags')) });
}

export function useTransactions(query: TransactionQuery) {
  return useQuery({
    queryKey: [...queryKeys.transactions, query],
    queryFn: () => unwrap(api.GET('/api/v1/transactions', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => unwrap(api.GET('/api/v1/accounts')),
  });
}

/** Monobank connection, or null when Monobank is not connected. */
export function useMonobankStatus() {
  return useQuery({
    queryKey: queryKeys.monobank,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/api/v1/banks/monobank');
      if (response.status === 404) return null;
      if (error !== undefined || data === undefined) throw error ?? new Error('Empty response');
      return data;
    },
  });
}

export function useAccountsSummary() {
  return useQuery({
    queryKey: queryKeys.accountsSummary,
    queryFn: () => unwrap(api.GET('/api/v1/accounts/summary')),
  });
}
