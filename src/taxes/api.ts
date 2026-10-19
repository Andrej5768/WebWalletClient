import { useQuery, type QueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { check, unwrap } from '../api/http';
import { queryKeys } from '../api/queries';

export type TaxSettings = Schemas['TaxSettingsResponse'];
export type TaxRates = Schemas['TaxRates'];
export type TaxSettingsRequest = Schemas['TaxSettingsRequest'];
export type FopReport = Schemas['FopReport'];
export type FopQuarter = Schemas['FopQuarter'];
export type FopIncome = Schemas['FopIncome'];
export type InvestmentTaxReport = Schemas['InvestmentTaxReport'];
export type DividendTax = Schemas['DividendTax'];
export type SaleTax = Schemas['SaleTax'];
export type TransactionTax = Schemas['TransactionTaxResponse'];
export type IncomeReason = FopIncome['reason'];

/** Keys under the `taxes` prefix, refreshed together after a change of money or of the settings. */
export const taxKeys = {
  all: queryKeys.taxes,
  settings: (year: number) => [...queryKeys.taxes, 'settings', year] as const,
  fop: (year: number) => [...queryKeys.taxes, 'fop', year] as const,
  investments: (year: number) => [...queryKeys.taxes, 'investments', year] as const,
  transaction: (id: number) => [...queryKeys.taxes, 'transaction', id] as const,
};

export const invalidateTaxes = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: taxKeys.all });

export function useTaxSettings(year: number) {
  return useQuery({
    queryKey: taxKeys.settings(year),
    queryFn: () => unwrap(api.GET('/api/v1/taxes/settings/{year}', { params: { path: { year } } })),
  });
}

export function useFopReport(year: number) {
  return useQuery({
    queryKey: taxKeys.fop(year),
    queryFn: () => unwrap(api.GET('/api/v1/taxes/fop/{year}', { params: { path: { year } } })),
  });
}

export function useInvestmentTax(year: number) {
  return useQuery({
    queryKey: taxKeys.investments(year),
    queryFn: () => unwrap(api.GET('/api/v1/taxes/investments/{year}', { params: { path: { year } } })),
  });
}

/** Whether a saved transaction is income of the sole proprietor; not asked for a new one. */
export function useTransactionTax(id: number | undefined) {
  return useQuery({
    queryKey: taxKeys.transaction(id ?? 0),
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/taxes/transactions/{transactionId}', { params: { path: { transactionId: id! } } }),
      ),
    enabled: id !== undefined,
  });
}

export const saveTaxSettings = (year: number, body: TaxSettingsRequest) =>
  unwrap(api.PUT('/api/v1/taxes/settings/{year}', { params: { path: { year } }, body }));

export const saveIncomeCategories = (categoryIds: number[]) =>
  unwrap(api.PUT('/api/v1/taxes/income-categories', { body: { categoryIds } }));

/** true adds the transaction to the income of the sole proprietor, false takes it out, null forgets the mark. */
export const markTransaction = (transactionId: number, included: boolean | null) =>
  check(
    api.PUT('/api/v1/taxes/transactions/{transactionId}', {
      params: { path: { transactionId } },
      body: { included: included ?? undefined },
    }),
  );

export const markQuarterPaid = (year: number, quarter: number, paid: boolean) =>
  check(
    api.PUT('/api/v1/taxes/fop/{year}/quarters/{quarter}', {
      params: { path: { year, quarter } },
      body: { paid },
    }),
  );

export const markDividendDocument = (operationId: number, document: boolean) =>
  check(
    api.PUT('/api/v1/taxes/investments/dividends/{operationId}', {
      params: { path: { operationId } },
      body: { document },
    }),
  );
