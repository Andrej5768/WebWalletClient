import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';

export type Portfolio = Schemas['PortfolioResponse'];
export type Position = Schemas['PositionResponse'];
export type PositionDetail = Schemas['PositionDetailResponse'];
export type Instrument = Schemas['InstrumentResponse'];
export type InstrumentRequest = Schemas['OwnInstrumentRequest'];
export type SearchResult = Schemas['SearchResult'];
export type Operation = Schemas['OperationResponse'];
export type OperationRequest = Schemas['OperationRequest'];
export type OperationType = OperationRequest['type'];
export type History = Schemas['HistoryResponse'];
export type Benchmark = NonNullable<Schemas['BenchmarkInfo']>['key'];
export type DividendCalendar = Schemas['CalendarResponse'];
export type DividendEvent = Schemas['CalendarEvent'];

/** Keys under the `investments` prefix, refreshed together after a change. */
export const investmentKeys = {
  all: queryKeys.investments,
  portfolio: (accountId?: number, currency?: string) =>
    [...queryKeys.investments, 'portfolio', accountId ?? null, currency ?? null] as const,
  history: (params: HistoryParams) => [...queryKeys.investments, 'history', params] as const,
  dividends: (params: DividendParams) => [...queryKeys.investments, 'dividends', params] as const,
  position: (accountId: number, instrumentId: number) =>
    [...queryKeys.investments, 'position', accountId, instrumentId] as const,
  instruments: [...queryKeys.investments, 'instruments'] as const,
  instrument: (id: number) => [...queryKeys.investments, 'instruments', id] as const,
  prices: (id: number, from?: string, to?: string) =>
    [...queryKeys.investments, 'prices', id, from ?? null, to ?? null] as const,
  search: (query: string) => [...queryKeys.investments, 'search', query] as const,
  operations: (params: OperationsParams) => [...queryKeys.investments, 'operations', params] as const,
};

/** The portfolio in the currency, by default the base one. */
export function usePortfolio(accountId?: number, currency?: string) {
  return useQuery({
    queryKey: investmentKeys.portfolio(accountId, currency),
    queryFn: () =>
      unwrap(api.GET('/api/v1/investments/portfolio', { params: { query: { accountId, currency } } })),
    placeholderData: keepPreviousData,
  });
}

export interface HistoryParams {
  accountId?: number;
  from?: string;
  currency?: string;
  benchmark?: Benchmark;
}

export function useHistory(params: HistoryParams) {
  return useQuery({
    queryKey: investmentKeys.history(params),
    queryFn: () => unwrap(api.GET('/api/v1/investments/history', { params: { query: params } })),
    placeholderData: keepPreviousData,
  });
}

export interface DividendParams {
  accountId?: number;
  from?: string;
  to?: string;
  currency?: string;
}

export function useDividends(params: DividendParams) {
  return useQuery({
    queryKey: investmentKeys.dividends(params),
    queryFn: () => unwrap(api.GET('/api/v1/investments/dividends', { params: { query: params } })),
    placeholderData: keepPreviousData,
  });
}

export function usePosition(accountId: number | undefined, instrumentId: number | undefined) {
  return useQuery({
    queryKey: investmentKeys.position(accountId ?? 0, instrumentId ?? 0),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/investments/positions', {
          params: { query: { accountId: accountId!, instrumentId: instrumentId! } },
        }),
      ),
    enabled: accountId !== undefined && instrumentId !== undefined,
  });
}

export interface OperationsParams {
  accountId?: number;
  /** All types when empty. */
  types?: OperationType[];
  page: number;
  size: number;
}

/** Operations of the brokerage accounts, newest first. */
export function useOperations(params: OperationsParams) {
  return useQuery({
    queryKey: investmentKeys.operations(params),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/investments/operations', {
          params: {
            query: {
              accountId: params.accountId,
              types: params.types?.length ? params.types : undefined,
              page: params.page,
              size: params.size,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useInstrument(id: number | undefined) {
  return useQuery({
    queryKey: investmentKeys.instrument(id ?? 0),
    queryFn: () => unwrap(api.GET('/api/v1/investments/instruments/{id}', { params: { path: { id: id! } } })),
    enabled: id !== undefined,
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: investmentKeys.instruments,
    queryFn: () => unwrap(api.GET('/api/v1/investments/instruments')),
  });
}

export function usePrices(id: number | undefined, from?: string, to?: string) {
  return useQuery({
    queryKey: investmentKeys.prices(id ?? 0, from, to),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/investments/instruments/{id}/prices', {
          params: { path: { id: id! }, query: { from, to } },
        }),
      ),
    enabled: id !== undefined,
  });
}

export function useInstrumentSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: investmentKeys.search(trimmed),
    queryFn: () =>
      unwrap(api.GET('/api/v1/investments/instruments/search', { params: { query: { q: trimmed } } })),
    enabled: trimmed.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

/** Brokerage accounts: those of type INVESTMENT. */
export function isBrokerage(account: Schemas['AccountResponse']): boolean {
  return account.type === 'INVESTMENT';
}
