import { useQuery } from '@tanstack/react-query';
import { api } from './client';

async function unwrap<T>(call: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const { data, error } = await call;
  if (error !== undefined || data === undefined) throw error ?? new Error('Empty response');
  return data;
}

export const queryKeys = {
  accounts: ['accounts'] as const,
  accountsSummary: ['accounts', 'summary'] as const,
  monobank: ['banks', 'monobank'] as const,
};

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
