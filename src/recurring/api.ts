import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { unwrap } from '../api/http';
import { invalidateLedger, queryKeys } from '../api/queries';

export type Recurring = Schemas['RecurringResponse'];
export type RecurringRequest = Schemas['RecurringRequest'];
export type Occurrence = Schemas['OccurrenceResponse'];
export type Frequency = Recurring['frequency'];

export function useRecurringPayments() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: () => unwrap(api.GET('/api/v1/recurring')),
  });
}

/** Occurrences from a month ago to a month ahead, the default range of the backend. */
export function useOccurrences(enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.recurring, 'occurrences'],
    queryFn: () => unwrap(api.GET('/api/v1/recurring/occurrences')),
    enabled,
  });
}

export function useCandidates(occurrence: Occurrence | null) {
  return useQuery({
    queryKey: [...queryKeys.recurring, 'candidates', occurrence?.recurringId, occurrence?.date],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/recurring/{id}/occurrences/{date}/candidates', {
          params: { path: { id: occurrence!.recurringId, date: occurrence!.date } },
        }),
      ),
    enabled: occurrence !== null,
  });
}

/** The request that saves the payment as it is, with the given changes; PUT replaces every field. */
export function requestOf(recurring: Recurring, changes: Partial<RecurringRequest> = {}): RecurringRequest {
  return {
    name: recurring.name,
    type: recurring.type,
    accountId: recurring.accountId,
    amount: recurring.amount,
    toAccountId: recurring.toAccountId ?? undefined,
    toAmount: recurring.toAccountId != null ? (recurring.toAmount ?? undefined) : undefined,
    categoryId: recurring.categoryId ?? undefined,
    payeeId: recurring.payee?.id,
    comment: recurring.comment ?? undefined,
    frequency: recurring.frequency,
    interval: recurring.interval,
    startDate: recurring.startDate,
    endDate: recurring.endDate ?? undefined,
    autoCreate: recurring.autoCreate,
    variableAmount: recurring.variableAmount,
    tolerance: recurring.tolerance,
    ...changes,
  };
}

/**
 * Saves an occurrence as an operation; the body sets the actual amount and date, if any. A form that
 * renders the error passes `errorShown`, otherwise it comes as a notification.
 */
export function useConfirmOccurrence(errorShown = false) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ occurrence, amount, date }: { occurrence: Occurrence; amount?: number; date?: string }) =>
      unwrap(
        api.POST('/api/v1/recurring/{id}/occurrences/{date}/confirm', {
          params: { path: { id: occurrence.recurringId, date: occurrence.date } },
          body: { amount, date },
        }),
      ),
    onSettled: () => invalidateLedger(queryClient),
    meta: { errorShown },
  });
}
