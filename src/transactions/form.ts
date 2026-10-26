import { fieldErrors, type ApiProblem } from '../api/errors';
import { roundTo } from '../lib/money';
import { isoDate, kyivToday } from '../lib/periods';
import { isSplit, singleCategoryId, type Transaction, type TransactionRequest } from './model';

export type TransactionType = TransactionRequest['type'];
/** What the form offers: the API types plus a debt, which is saved as a transfer with the debt account. */
export type FormType = TransactionType | 'DEBT';
/** Of a debt: money given to the person (lent, or a borrowed amount repaid) or received from them. */
export type DebtDirection = 'GAVE' | 'RECEIVED';

/** Whether the type has a category: an expense or an income, unlike a transfer or a debt. */
export const categorized = (type: FormType) => type === 'EXPENSE' || type === 'INCOME';

interface SplitValue {
  categoryId: string | null;
  amount: number | string;
  comment: string;
}

export interface TransactionValues {
  type: FormType;
  debtDirection: DebtDirection;
  amount: number | string;
  date: string | null;
  accountId: string | null;
  toAccountId: string | null;
  /** Received amount of a transfer (less than the amount in the same currency means a fee), or the amount of a debt
   * in the debt account's currency when the own account has another. */
  toAmount: number | string;
  payee: string;
  categoryId: string | null;
  split: boolean;
  splits: SplitValue[];
  tags: string[];
  comment: string;
  originalAmount: number | string;
  originalCurrency: string | null;
  /** A balance correction: no category, left out of the reports. Set by the Monobank difference, kept on edit. */
  adjustment: boolean;
}

export const toNumber = (value: number | string): number => (value === '' ? 0 : Number(value));

const emptySplit = (): SplitValue => ({ categoryId: null, amount: '', comment: '' });

export function initialTransactionValues(
  transaction: Transaction | null,
  tagNames: Map<number, string>,
  accountId?: number,
  debtAccounts: Set<number> = new Set(),
): TransactionValues {
  const split = transaction ? isSplit(transaction) : false;
  // A transfer with a debt account is a debt; the own account is the other side, and the amount is what moved there
  const direction = transaction ? debtDirection(transaction, debtAccounts) : undefined;
  const gave = direction === 'GAVE';
  return {
    type: direction ? 'DEBT' : (transaction?.type ?? 'EXPENSE'),
    debtDirection: direction ?? 'GAVE',
    amount: (direction && !gave ? transaction?.toAmount : transaction?.amount) ?? '',
    date: transaction?.date ?? isoDate(kyivToday()),
    accountId: transaction
      ? String(direction && !gave ? transaction.toAccountId : transaction.accountId)
      : accountId
        ? String(accountId)
        : null,
    toAccountId: transaction?.toAccountId && !direction ? String(transaction.toAccountId) : null,
    toAmount: (direction && !gave ? transaction?.amount : transaction?.toAmount) ?? '',
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
    adjustment: transaction?.adjustment ?? false,
  };
}

/**
 * The other direction of a transfer: the accounts change places. The amounts change places too
 * when asked and a received amount is set: between currencies the sent amount must stay in the
 * sending account's currency, while a fee in one currency stays with the sending side.
 */
export function swapAccounts(
  values: TransactionValues,
  amountsToo = values.toAmount !== '',
): Partial<TransactionValues> {
  return {
    accountId: values.toAccountId,
    toAccountId: values.accountId,
    ...(amountsToo && values.toAmount !== '' ? { amount: values.toAmount, toAmount: values.amount } : {}),
  };
}

/**
 * What changes with the type. Categories of the other kind are dropped. The account of an
 * income is the one that received the money, so when an income becomes a transfer it moves to
 * "to account", and when a transfer becomes an income the receiving account becomes its account.
 */
export function switchType(values: TransactionValues, type: FormType): Partial<TransactionValues> {
  const changes: Partial<TransactionValues> = { type };
  if ((type === 'INCOME') !== (values.type === 'INCOME')) {
    changes.categoryId = null;
    changes.splits = values.splits.map((item) => ({ ...item, categoryId: null }));
  }
  const incomeToTransfer = values.type === 'INCOME' && type === 'TRANSFER';
  const transferToIncome = values.type === 'TRANSFER' && type === 'INCOME' && values.toAccountId !== null;
  if (incomeToTransfer || transferToIncome) Object.assign(changes, swapAccounts(values));
  return changes;
}

/** Which way a transfer with a debt account goes, or undefined for any other transaction. */
export function debtDirection(
  transaction: Pick<Transaction, 'type' | 'accountId' | 'toAccountId'>,
  debtAccounts: Set<number>,
): DebtDirection | undefined {
  if (transaction.type !== 'TRANSFER' || transaction.toAccountId == null) return undefined;
  const from = debtAccounts.has(transaction.accountId);
  const to = debtAccounts.has(transaction.toAccountId);
  if (from === to) return undefined;
  return to ? 'GAVE' : 'RECEIVED';
}

/** Unassigned part of a split: amount minus the parts. */
export function splitRemainder(values: TransactionValues): number {
  return roundTo(
    toNumber(values.amount) - values.splits.reduce((sum, item) => sum + toNumber(item.amount), 0),
    2,
  );
}

/**
 * Request body of the form; tag names are already resolved to `tagIds`. A debt becomes a transfer between the own
 * account and the debt account, with the person as the payee; `debtAccountId` is required for it.
 */
export function toTransactionBody(
  values: TransactionValues,
  tagIds: number[],
  debtAccountId?: number,
): TransactionRequest {
  const amount = toNumber(values.amount);
  if (values.type === 'DEBT') {
    const gave = values.debtDirection === 'GAVE';
    // The amount in the debt account's currency, when the own account has another one
    const debtAmount = values.toAmount === '' ? amount : toNumber(values.toAmount);
    return {
      type: 'TRANSFER',
      date: values.date!,
      accountId: gave ? Number(values.accountId) : debtAccountId!,
      amount: gave ? amount : debtAmount,
      toAccountId: gave ? debtAccountId! : Number(values.accountId),
      toAmount: gave ? debtAmount : amount,
      payeeName: values.payee.trim() || undefined,
      tagIds,
      comment: values.comment.trim() || undefined,
    };
  }
  const transfer = values.type === 'TRANSFER';
  return {
    type: values.type as TransactionType,
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
    adjustment: values.adjustment || undefined,
  };
}

/** Form errors from the backend's field errors; `splits[1].amount` becomes `splits.1.amount`. */
export function formErrors(problem: ApiProblem): Record<string, string> {
  return fieldErrors(problem, (field) => field.replace(/\[(\d+)]/g, '.$1'));
}
