import type { ApiProblem } from '../api/errors';
import { isoDate, kyivToday } from '../lib/periods';
import { isSplit, singleCategoryId, type Transaction, type TransactionRequest } from './model';

export type TransactionType = TransactionRequest['type'];

interface SplitValue {
  categoryId: string | null;
  amount: number | string;
  comment: string;
}

export interface TransactionValues {
  type: TransactionType;
  amount: number | string;
  date: string | null;
  accountId: string | null;
  toAccountId: string | null;
  /** Received amount of a transfer; less than the amount in the same currency means a fee. */
  toAmount: number | string;
  payee: string;
  categoryId: string | null;
  split: boolean;
  splits: SplitValue[];
  tags: string[];
  comment: string;
  originalAmount: number | string;
  originalCurrency: string | null;
}

export const toNumber = (value: number | string): number => (value === '' ? 0 : Number(value));
const round2 = (value: number) => Math.round(value * 100) / 100;

const emptySplit = (): SplitValue => ({ categoryId: null, amount: '', comment: '' });

export function initialTransactionValues(
  transaction: Transaction | null,
  tagNames: Map<number, string>,
  accountId?: number,
): TransactionValues {
  const split = transaction ? isSplit(transaction) : false;
  return {
    type: transaction?.type ?? 'EXPENSE',
    amount: transaction?.amount ?? '',
    date: transaction?.date ?? isoDate(kyivToday()),
    accountId: transaction ? String(transaction.accountId) : accountId ? String(accountId) : null,
    toAccountId: transaction?.toAccountId ? String(transaction.toAccountId) : null,
    toAmount: transaction?.toAmount ?? '',
    payee: transaction?.payee?.name ?? '',
    categoryId: transaction && !split ? (singleCategoryId(transaction)?.toString() ?? null) : null,
    split,
    splits: split
      ? transaction!.splits.map((item) => ({
          categoryId: item.categoryId ? String(item.categoryId) : null,
          amount: item.amount,
          comment: item.comment ?? '',
        }))
      : [emptySplit(), emptySplit()],
    tags: (transaction?.tagIds ?? []).map((id) => tagNames.get(id)).filter((name) => name !== undefined),
    comment: transaction?.comment ?? '',
    originalAmount: transaction?.originalAmount ?? '',
    originalCurrency: transaction?.originalCurrency ?? null,
  };
}

/** Unassigned part of a split: amount minus the parts. */
export function splitRemainder(values: TransactionValues): number {
  return round2(
    toNumber(values.amount) - values.splits.reduce((sum, item) => sum + toNumber(item.amount), 0),
  );
}

/** Request body of the form; tag names are already resolved to `tagIds`. */
export function toTransactionBody(values: TransactionValues, tagIds: number[]): TransactionRequest {
  const transfer = values.type === 'TRANSFER';
  const amount = toNumber(values.amount);
  return {
    type: values.type,
    date: values.date!,
    accountId: Number(values.accountId),
    amount,
    toAccountId: transfer ? Number(values.toAccountId) : undefined,
    // Always sent for transfers: an omitted amount would default to the sent one and drop a fee.
    toAmount: transfer ? (values.toAmount === '' ? amount : toNumber(values.toAmount)) : undefined,
    payeeName: transfer ? undefined : values.payee.trim() || undefined,
    categoryId: !transfer && !values.split && values.categoryId ? Number(values.categoryId) : undefined,
    splits:
      !transfer && values.split
        ? values.splits.map((item) => ({
            categoryId: item.categoryId ? Number(item.categoryId) : undefined,
            amount: toNumber(item.amount),
            comment: item.comment.trim() || undefined,
          }))
        : undefined,
    tagIds,
    comment: values.comment.trim() || undefined,
    originalAmount: values.originalAmount === '' ? undefined : toNumber(values.originalAmount),
    originalCurrency: values.originalAmount === '' ? undefined : (values.originalCurrency ?? undefined),
  };
}

/** Form errors from the backend's field errors; `splits[1].amount` becomes `splits.1.amount`. */
export function formErrors(problem: ApiProblem): Record<string, string> {
  return Object.fromEntries(
    (problem.errors ?? []).map(({ field, message }) => [field.replace(/\[(\d+)]/g, '.$1'), message]),
  );
}
