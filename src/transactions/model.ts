import type { Schemas } from '../api/client';
import type { CategoryInfo } from '../lib/categories';

export type Transaction = Schemas['TransactionResponse'];
export type TransactionRequest = Schemas['TransactionRequest'];

/** The single category of a transaction, or null when it is uncategorized or split. */
export function singleCategoryId(transaction: Transaction): number | null {
  const splits = transaction.splits ?? [];
  return splits.length === 1 ? (splits[0]?.categoryId ?? null) : null;
}

export function isSplit(transaction: Transaction): boolean {
  return (transaction.splits ?? []).length > 1;
}

export function isUncategorized(transaction: Transaction): boolean {
  if (transaction.type === 'TRANSFER') return false;
  const splits = transaction.splits ?? [];
  return splits.length === 0 || splits.some((split) => split.categoryId == null);
}

/** Request that recreates the transaction as it is, with the given changes on top. */
export function toRequest(
  transaction: Transaction,
  changes: Partial<TransactionRequest> = {},
): TransactionRequest {
  const split = isSplit(transaction);
  return {
    type: transaction.type!,
    date: transaction.date!,
    accountId: transaction.accountId!,
    amount: transaction.amount!,
    toAccountId: transaction.toAccountId,
    toAmount: transaction.toAmount,
    originalAmount: transaction.originalAmount,
    originalCurrency: transaction.originalCurrency,
    categoryId: split ? undefined : (singleCategoryId(transaction) ?? undefined),
    splits: split
      ? (transaction.splits ?? []).map((item) => ({
          categoryId: item.categoryId,
          amount: item.amount!,
          comment: item.comment,
        }))
      : undefined,
    payeeId: transaction.payee?.id,
    comment: transaction.comment,
    tagIds: transaction.tagIds,
    ...changes,
  };
}

/** Category to draw for the row: the single category, or the first one of a split. */
export function displayCategory(
  transaction: Transaction,
  categories: Map<number, CategoryInfo>,
): CategoryInfo | undefined {
  const first = (transaction.splits ?? []).find((split) => split.categoryId != null);
  return first?.categoryId != null ? categories.get(first.categoryId) : undefined;
}

export interface DayGroup {
  date: string;
  transactions: Transaction[];
  /** Net change per currency, transfers excluded. */
  totals: { currency: string; amount: number }[];
}

/** Groups a page of transactions (newest first) by date. */
export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const days = new Map<string, Transaction[]>();
  transactions.forEach((transaction) => {
    const date = transaction.date ?? '';
    days.set(date, [...(days.get(date) ?? []), transaction]);
  });
  return [...days.entries()].map(([date, items]) => {
    const totals = new Map<string, number>();
    items
      .filter((transaction) => transaction.type !== 'TRANSFER')
      .forEach((transaction) => {
        const sign = transaction.type === 'EXPENSE' ? -1 : 1;
        const currency = transaction.currency ?? 'UAH';
        totals.set(currency, (totals.get(currency) ?? 0) + sign * (transaction.amount ?? 0));
      });
    return {
      date,
      transactions: items,
      totals: [...totals.entries()].map(([currency, amount]) => ({ currency, amount })),
    };
  });
}

/** Signed amount for display: expenses negative, income positive, transfers as is. */
export function signedAmount(transaction: Transaction): number {
  const amount = transaction.amount ?? 0;
  return transaction.type === 'EXPENSE' ? -amount : amount;
}
