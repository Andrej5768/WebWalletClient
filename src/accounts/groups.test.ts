import { accountOf } from '../test/fixtures';
import { groupAccounts, type Account } from './groups';

const account = (id: number, type: Account['type'], balance: number, extra: Partial<Account> = {}): Account =>
  accountOf({ id, name: `Account ${id}`, type, balance, balanceInBase: balance, ...extra });

describe('groupAccounts', () => {
  const accounts = [
    account(1, 'CARD', 100),
    account(2, 'SAVINGS', 1000),
    account(3, 'DEPOSIT', 5000),
    account(4, 'CREDIT_CARD', -300),
    account(5, 'CARD', 0, { archived: true }),
  ];

  it('groups accounts by type in display order with totals', () => {
    const groups = groupAccounts(accounts, false);
    expect(groups.map((group) => group.key)).toEqual(['cards', 'credit', 'savings']);
    expect(groups.find((group) => group.key === 'savings')?.totalInBase).toBe(6000);
  });

  it('adds archived accounts at the end on request', () => {
    expect(groupAccounts(accounts, true).at(-1)).toMatchObject({ key: 'archived', totalInBase: null });
  });

  it('has no total when an account has no exchange rate', () => {
    const groups = groupAccounts(
      [account(1, 'CASH', 10), account(2, 'CASH', 5, { balanceInBase: undefined })],
      false,
    );
    expect(groups[0]?.totalInBase).toBeNull();
  });
});
