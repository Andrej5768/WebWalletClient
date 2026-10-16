import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { flattenCategories } from '../lib/categories';
import type { Period } from '../lib/periods';
import { api } from './client';
import { unwrap, unwrapOrNull } from './http';
import type { paths } from './schema';

/** Every query key of the app; prefixes are invalidated together. */
export const queryKeys = {
  accounts: ['accounts'] as const,
  accountsSummary: ['accounts', 'summary'] as const,
  monobank: ['banks', 'monobank'] as const,
  categories: ['categories'] as const,
  payees: ['payees'] as const,
  tags: ['tags'] as const,
  rules: ['categorization-rules'] as const,
  transactions: ['transactions'] as const,
  transaction: (id: number) => ['transactions', 'one', id] as const,
  budget: ['budget'] as const,
  budgetMonth: (month: string) => ['budget', month] as const,
  reports: ['reports'] as const,
  goals: ['goals'] as const,
  report: (name: string, period: Period) => ['reports', name, period] as const,
  preview: (id: string, page: number) => ['imports', 'preview', id, page] as const,
  forecast: ['forecast'] as const,
  recurring: ['recurring'] as const,
};

/**
 * Refreshes everything a change of money can affect: transactions, balances, the budget, reports,
 * payees, tags, goals (their progress follows account balances), the forecast and recurring payments
 * (a new transaction may pay one). Used after adding, editing, importing or categorizing
 * transactions and accounts.
 */
export function invalidateLedger(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(
    [
      queryKeys.transactions,
      queryKeys.accounts,
      queryKeys.budget,
      queryKeys.reports,
      queryKeys.goals,
      queryKeys.payees,
      queryKeys.tags,
      queryKeys.monobank,
      queryKeys.forecast,
      queryKeys.recurring,
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

/** Refreshes what depends on categories: the tree, rules, the budget and reports. */
export function invalidateCategories(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(
    [queryKeys.categories, queryKeys.rules, queryKeys.budget, queryKeys.reports, queryKeys.transactions].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

export type TransactionQuery = NonNullable<paths['/api/v1/transactions']['get']['parameters']['query']>;

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => unwrap(api.GET('/api/v1/categories')),
    select: flattenCategories,
    staleTime: 5 * 60_000,
  });
}

/** Categories by id, memoized for lookups in lists. */
export function useCategoriesById() {
  const categories = useCategories();
  return useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
}

export function usePayees() {
  return useQuery({ queryKey: queryKeys.payees, queryFn: () => unwrap(api.GET('/api/v1/payees')) });
}

export function useTags() {
  return useQuery({ queryKey: queryKeys.tags, queryFn: () => unwrap(api.GET('/api/v1/tags')) });
}

export function useRules() {
  return useQuery({
    queryKey: queryKeys.rules,
    queryFn: () => unwrap(api.GET('/api/v1/categorization-rules')),
  });
}

export function useTransactions(query: TransactionQuery) {
  return useQuery({
    queryKey: [...queryKeys.transactions, query],
    queryFn: () => unwrap(api.GET('/api/v1/transactions', { params: { query } })),
    placeholderData: keepPreviousData,
  });
}

/** One transaction by id, for opening it outside the current page of the feed. */
export function useTransaction(id: number | null) {
  return useQuery({
    queryKey: queryKeys.transaction(id ?? 0),
    queryFn: () => unwrapOrNull(api.GET('/api/v1/transactions/{id}', { params: { path: { id: id! } } })),
    enabled: id !== null,
  });
}

export function useAccounts() {
  return useQuery({ queryKey: queryKeys.accounts, queryFn: () => unwrap(api.GET('/api/v1/accounts')) });
}

/** Monobank connection, or null when Monobank is not connected. */
export function useMonobankStatus() {
  return useQuery({
    queryKey: queryKeys.monobank,
    queryFn: () => unwrapOrNull(api.GET('/api/v1/banks/monobank')),
  });
}

export function useAccountsSummary() {
  return useQuery({
    queryKey: queryKeys.accountsSummary,
    queryFn: () => unwrap(api.GET('/api/v1/accounts/summary')),
  });
}

/** Base currency of the user's figures, from the accounts summary. */
export function useBaseCurrency(): string {
  return useAccountsSummary().data?.currency ?? 'UAH';
}
