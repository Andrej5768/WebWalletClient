import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { check, unwrap } from '../api/http';
import { invalidateLedger, queryKeys } from '../api/queries';

export type TransferPair = Schemas['TransferPairResponse'];

/** Expenses and incomes of the dates that look like one transfer between own accounts. */
export function useTransferPairs(from: string | null, to: string | null) {
  return useQuery({
    // Under the transactions key: any change of the ledger asks again.
    queryKey: [...queryKeys.transactions, 'transfer-pairs', from, to],
    queryFn: () =>
      unwrap(api.GET('/api/v1/transactions/transfer-pairs', { params: { query: { from: from!, to: to! } } })),
    enabled: from !== null && to !== null,
  });
}

export function useMergePair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pair: TransferPair) =>
      unwrap(
        api.POST('/api/v1/transactions/transfer-pairs/merge', {
          body: { expenseId: pair.expenseId, incomeId: pair.incomeId },
        }),
      ),
    onSettled: () => invalidateLedger(queryClient),
  });
}

export function useDismissPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pair: TransferPair) =>
      check(
        api.POST('/api/v1/transactions/transfer-pairs/dismiss', {
          body: { expenseId: pair.expenseId, incomeId: pair.incomeId },
        }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
  });
}

/** Splits a transfer back into an expense and an income. */
export function useSplitTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrap(api.POST('/api/v1/transactions/{id}/split-transfer', { params: { path: { id } } })),
    onSuccess: () => invalidateLedger(queryClient),
    meta: { errorShown: true },
  });
}
