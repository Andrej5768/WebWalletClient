import { useQuery } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';

export type Goal = Schemas['GoalResponse'];
export type GoalRequest = Schemas['GoalRequest'];

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals, queryFn: () => unwrap(api.GET('/api/v1/goals')) });
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
