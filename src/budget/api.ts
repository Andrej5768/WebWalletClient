import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export const budgetKey = (month: string) => ['budget', month] as const;

export function useBudget(month: string) {
  return useQuery({
    queryKey: budgetKey(month),
    queryFn: async () => {
      const { data, error } = await api.GET('/api/v1/budget/{month}', { params: { path: { month } } });
      if (error || !data) throw error ?? new Error('Empty response');
      return data;
    },
  });
}

export async function assign(month: string, categoryId: number, assigned: number) {
  const { error } = await api.PUT('/api/v1/budget/{month}/categories/{categoryId}', {
    params: { path: { month, categoryId } },
    body: { assigned },
  });
  if (error) throw error;
}
