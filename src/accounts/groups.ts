import type { Schemas } from '../api/client';
import type { AccountType } from '../lib/accounts';

export type Account = Schemas['AccountResponse'];

export const accountTypes: AccountType[] = [
  'CARD',
  'CREDIT_CARD',
  'CASH',
  'SAVINGS',
  'DEPOSIT',
  'LOAN',
  'DEBT',
  'INVESTMENT',
];

/** Table groups, in display order; the translation key is `accounts.groups.<key>`. */
const accountGroups: { key: string; types: AccountType[] }[] = [
  { key: 'cards', types: ['CARD'] },
  { key: 'cash', types: ['CASH'] },
  { key: 'credit', types: ['CREDIT_CARD'] },
  { key: 'savings', types: ['SAVINGS', 'DEPOSIT'] },
  { key: 'debts', types: ['LOAN', 'DEBT'] },
  { key: 'investments', types: ['INVESTMENT'] },
];

export interface AccountGroup {
  key: string;
  accounts: Account[];
  /** Sum in the base currency; null when an account has no rate. */
  totalInBase: number | null;
}

const bySortOrder = (a: Account, b: Account) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name ?? '').localeCompare(b.name ?? '');

function total(accounts: Account[]): number | null {
  return accounts.every((account) => account.balanceInBase != null)
    ? accounts.reduce((sum, account) => sum + (account.balanceInBase ?? 0), 0)
    : null;
}

/** Splits accounts into the display groups; archived accounts go to their own group at the end. */
export function groupAccounts(accounts: Account[], showArchived: boolean): AccountGroup[] {
  const active = accounts.filter((account) => !account.archived);
  const groups = accountGroups
    .map(({ key, types }) => {
      const members = active
        .filter((account) => account.type && types.includes(account.type))
        .sort(bySortOrder);
      return { key, accounts: members, totalInBase: total(members) };
    })
    .filter((group) => group.accounts.length > 0);

  const archived = accounts.filter((account) => account.archived).sort(bySortOrder);
  if (showArchived && archived.length)
    groups.push({ key: 'archived', accounts: archived, totalInBase: null });
  return groups;
}

/** Interest rate makes sense for these types only. */
export function hasInterest(type: AccountType | undefined): boolean {
  return type === 'DEPOSIT' || type === 'SAVINGS' || type === 'LOAN';
}
