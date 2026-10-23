import type { QueryClient } from '@tanstack/react-query';
import { api, type Schemas } from '../api/client';
import { unwrap } from '../api/http';
import { invalidateLedger } from '../api/queries';

type Account = Schemas['AccountResponse'];

/** The ids of the debt accounts: a transfer with one of them is a debt operation. */
export function debtAccountIds(accounts: Account[]): Set<number> {
  return new Set(accounts.filter((account) => account.type === 'DEBT').map((account) => account.id));
}

/**
 * The account debt operations go to: the first debt account that is not archived, created on first use. As in
 * Zen Money there is one debt account, and the person is the payee of the operation.
 */
export async function ensureDebtAccount(
  accounts: Account[],
  name: string,
  currency: string,
  queryClient: QueryClient,
): Promise<number> {
  const existing = accounts.find((account) => account.type === 'DEBT' && !account.archived);
  if (existing) return existing.id;
  const created = await unwrap(
    api.POST('/api/v1/accounts', { body: { name, type: 'DEBT', currency, inBudget: false } }),
  );
  await invalidateLedger(queryClient);
  return created.id;
}
