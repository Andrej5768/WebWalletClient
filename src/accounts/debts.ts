import { useQuery } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { unwrap } from '../api/http';
import { queryKeys } from '../api/queries';

export type Debts = Schemas['DebtsResponse'];
export type DebtPerson = Schemas['Person'];

/** Who owes whom: every person with a debt operation and their balance in the base currency. */
export function useDebts() {
  return useQuery({
    queryKey: queryKeys.debts,
    queryFn: () => unwrap(api.GET('/api/v1/debts')),
  });
}
