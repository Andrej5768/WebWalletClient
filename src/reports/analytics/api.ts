import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { unwrap } from '../../api/http';
import { queryKeys } from '../../api/queries';
import type { Period } from '../../lib/periods';
import type { ComparePeriods } from './model';

const options = { placeholderData: keepPreviousData };

/** Analytics live under the `reports` prefix, so a change of money refreshes them too. */
const analyticsKey = (name: string, params: object) =>
  [...queryKeys.reports, 'analytics', name, params] as const;

export function useCompare(periods: ComparePeriods) {
  return useQuery({
    queryKey: analyticsKey('compare', periods),
    queryFn: () => unwrap(api.GET('/api/v1/analytics/compare', { params: { query: periods } })),
    ...options,
  });
}

/** Months as "2026-10"; without them the last 12 complete months. */
export function useTrends(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: analyticsKey('trends', range),
    queryFn: () => unwrap(api.GET('/api/v1/analytics/trends', { params: { query: range } })),
    ...options,
  });
}

export function useSavings(range: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: analyticsKey('savings', range),
    queryFn: () => unwrap(api.GET('/api/v1/analytics/savings', { params: { query: range } })),
    ...options,
  });
}

export function useNeedsWants(period: Period, enabled = true) {
  return useQuery({
    queryKey: analyticsKey('needs-wants', period),
    queryFn: () => unwrap(api.GET('/api/v1/analytics/needs-wants', { params: { query: period } })),
    enabled,
    ...options,
  });
}
