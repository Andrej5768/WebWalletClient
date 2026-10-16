import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';

/** Balance of cash and cards to the end of the month: actual, then forecast. */
export function useForecast() {
  return useQuery({
    queryKey: queryKeys.forecast,
    queryFn: () => unwrap(api.GET('/api/v1/forecast')),
  });
}

export function useRecurringPayments() {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: () => unwrap(api.GET('/api/v1/recurring')),
  });
}
