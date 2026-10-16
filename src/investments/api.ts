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
  portfolio: (accountId?: number) => [...queryKeys.investments, 'portfolio', accountId ?? null] as const,
  history: (params: HistoryParams) => [...queryKeys.investments, 'history', params] as const,
  dividends: (params: DividendParams) => [...queryKeys.investments, 'dividends', params] as const,
  position: (accountId: number, instrumentId: number) =>
    [...queryKeys.investments, 'position', accountId, instrumentId] as const,
  instruments: [...queryKeys.investments, 'instruments'] as const,
  instrument: (id: number) => [...queryKeys.investments, 'instruments', id] as const,
  prices: (id: number, from?: string, to?: string) =>
    [...queryKeys.investments, 'prices', id, from ?? null, to ?? null] as const,
  search: (query: string) => [...queryKeys.investments, 'search', query] as const,
  operations: (accountId?: number, instrumentId?: number, page = 0) =>
    [...queryKeys.investments, 'operations', accountId ?? null, instrumentId ?? null, page] as const,
};

export function usePortfolio(accountId?: number) {
  return useQuery({
    queryKey: investmentKeys.portfolio(accountId),
    queryFn: () => unwrap(api.GET('/api/v1/investments/portfolio', { params: { query: { accountId } } })),
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
