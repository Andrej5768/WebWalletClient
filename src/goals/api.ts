import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { check, unwrap } from '../api/http';
import { queryKeys } from '../api/queries';

export type Goal = Schemas['GoalResponse'];
export type GoalRequest = Schemas['GoalRequest'];

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals, queryFn: () => unwrap(api.GET('/api/v1/goals')) });
}

/** Deletes a goal by id and refreshes the goals; `errorShown` when the caller shows the problem itself. */
export function useDeleteGoal({ onDeleted, errorShown }: { onDeleted?(): void; errorShown?: boolean } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => check(api.DELETE('/api/v1/goals/{id}', { params: { path: { id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      onDeleted?.();
    },
    meta: { errorShown },
  });
}

/** The request that saves the goal as it is, with the given changes; PUT replaces every field. */
export function requestOf(goal: Goal, changes: Partial<GoalRequest> = {}): GoalRequest {
  return {
    name: goal.name,
    targetAmount: goal.targetAmount,
    currency: goal.currency,
    targetDate: goal.targetDate ?? undefined,
    accountId: goal.accountId ?? undefined,
    saved: goal.accountId == null ? goal.saved : undefined,
    icon: goal.icon ?? undefined,
    color: goal.color ?? undefined,
    sortOrder: goal.sortOrder,
    ...changes,
  };
}
