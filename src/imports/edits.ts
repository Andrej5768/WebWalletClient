import type { OperationEdit, PreviewOperation } from './api';

type Type = PreviewOperation['type'];
export type Suggestion = NonNullable<PreviewOperation['transferSuggestions']>[number];

/** The other half of a transfer: an operation of the same import or a transaction of the ledger. */
export interface Pair {
  operationKey: string | null;
  transactionId: number | null;
}

/** What the user may have changed in one previewed operation. */
export interface RowEdit {
  include: boolean;
  type: Type;
  transferAccountId: string | null;
  categoryId: string | null;
  /** False keeps the suggested category, also one the import would create. */
  categoryChanged: boolean;
  tags: string[];
  comment: string | null;
  rememberRule: boolean;
  /** Merge this expense or income with the other half into one transfer. */
  pair: Pair | null;
  touched: boolean;
}

/** The row as previewed; `tagNames` resolves the suggested tags, `pair` is a pair chosen in advance. */
export function initialEdit(
  operation: PreviewOperation,
  tagNames: Map<number, string>,
  pair: Pair | null = null,
): RowEdit {
  return {
    include: true,
    type: operation.type,
    transferAccountId: null,
    categoryId: operation.categoryId != null ? String(operation.categoryId) : null,
    categoryChanged: false,
    tags: operation.tagIds.map((id) => tagNames.get(id)).filter((name) => name !== undefined),
    comment: operation.comment,
    rememberRule: false,
    pair,
    touched: false,
  };
}

export const pairOf = (suggestion: Suggestion): Pair => ({
  operationKey: suggestion.operationKey ?? null,
  transactionId: suggestion.transactionId ?? null,
});

export const samePair = (a: Pair | null, b: Pair | null) =>
  a?.operationKey === b?.operationKey && a?.transactionId === b?.transactionId;

const pairId = (pair: Pair) =>
  pair.operationKey != null ? `operation:${pair.operationKey}` : `transaction:${pair.transactionId}`;

/** The only exact match of an operation, if it has exactly one. */
function exactMatch(operation: PreviewOperation): Suggestion | undefined {
  const exact = (operation.transferSuggestions ?? []).filter((suggestion) => suggestion.exact);
  return exact.length === 1 ? exact[0] : undefined;
}

/**
 * Pairs chosen in advance: an operation with exactly one exact match, when nothing else claims that
 * match. Within the file both halves must point at each other; both rows then carry the pair.
 */
export function exactPairs(operations: Iterable<PreviewOperation>): Map<string, Pair> {
  const all = [...operations].filter((operation) => !operation.duplicate);
  const byKey = new Map(all.map((operation) => [operation.key, operation]));
  const claims = new Map<string, number>();
  const candidates = all.flatMap((operation) => {
    const match = exactMatch(operation);
    if (!match) return [];
    if (match.operationKey != null) {
      const other = byKey.get(match.operationKey);
      if (!other || exactMatch(other)?.operationKey !== operation.key) return [];
    }
    const pair = pairOf(match);
    claims.set(pairId(pair), (claims.get(pairId(pair)) ?? 0) + 1);
    return [[operation.key, pair] as const];
  });
  return new Map(candidates.filter(([, pair]) => claims.get(pairId(pair)) === 1));
}

/** Whether the row offers to merge with another half: an expense or income kept as detected. */
export const canPair = (operation: PreviewOperation, edit: RowEdit) =>
  !operation.duplicate &&
  !!operation.transferSuggestions?.length &&
  operation.type !== 'TRANSFER' &&
  edit.type === operation.type;

/** Allowed type changes: an expense or income can become a transfer, a transfer either of them. */
export function allowedTypes(type: Type): Type[] {
  return type === 'TRANSFER' ? ['TRANSFER', 'EXPENSE', 'INCOME'] : [type, 'TRANSFER'];
}

/** An expense or income turned into a transfer needs the other account. */
export function needsTransferAccount(operation: PreviewOperation, edit: RowEdit): boolean {
  return edit.include && edit.type === 'TRANSFER' && operation.type !== 'TRANSFER' && !edit.transferAccountId;
}

/** The row shows no category and the import would not give it one. */
export function isUncategorized(operation: PreviewOperation, edit: RowEdit): boolean {
  if (edit.type === 'TRANSFER' || (edit.pair && canPair(operation, edit))) return false;
  return edit.categoryChanged ? !edit.categoryId : !operation.categoryId && !operation.categoryName;
}

/**
 * The confirm request: every changed or paired row with all its values, since a listed row gets
 * exactly what is sent. Duplicates are never imported, so their rows are left out.
 */
export function buildEdits(
  operations: Map<string, PreviewOperation>,
  editOf: (operation: PreviewOperation) => RowEdit,
  tagIds: Map<string, number>,
): OperationEdit[] {
  return [...operations.values()]
    .filter((operation) => !operation.duplicate)
    .map((operation) => [operation.key, editOf(operation)] as const)
    .filter(([, edit]) => edit.touched || edit.pair)
    .map(([key, edit]) => {
      const operation = operations.get(key)!;
      const transfer = edit.type === 'TRANSFER';
      const pair = edit.include && edit.pair && canPair(operation, edit) ? edit.pair : null;
      return {
        key,
        include: edit.include,
        type: edit.type,
        transferAccountId:
          transfer && operation.type !== 'TRANSFER' && edit.transferAccountId
            ? Number(edit.transferAccountId)
            : undefined,
        keepSuggestedCategory: !edit.categoryChanged,
        categoryId: edit.categoryChanged && !transfer && edit.categoryId ? Number(edit.categoryId) : null,
        tagIds: edit.tags
          .map((name) => tagIds.get(name.trim().toLowerCase()))
          .filter((id): id is number => id !== undefined),
        comment: edit.comment,
        rememberRule: edit.categoryChanged && edit.rememberRule,
        pairKey: pair?.operationKey ?? undefined,
        pairTransactionId: pair?.transactionId ?? undefined,
      };
    });
}
