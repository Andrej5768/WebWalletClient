import type { OperationEdit, PreviewOperation } from './api';

type Type = PreviewOperation['type'];

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
  touched: boolean;
}

/** The row as previewed; `tagNames` resolves the suggested tags. */
export function initialEdit(operation: PreviewOperation, tagNames: Map<number, string>): RowEdit {
  return {
    include: true,
    type: operation.type,
    transferAccountId: null,
    categoryId: operation.categoryId != null ? String(operation.categoryId) : null,
    categoryChanged: false,
    tags: operation.tagIds.map((id) => tagNames.get(id)).filter((name) => name !== undefined),
    comment: operation.comment,
    rememberRule: false,
    touched: false,
  };
}

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
  if (edit.type === 'TRANSFER') return false;
  return edit.categoryChanged ? !edit.categoryId : !operation.categoryId && !operation.categoryName;
}

/**
 * The confirm request: every changed row with all its values, since a listed row gets exactly what
 * is sent. Duplicates are never imported, so their rows are left out.
 */
export function buildEdits(
  operations: Map<string, PreviewOperation>,
  edits: Map<string, RowEdit>,
  tagIds: Map<string, number>,
): OperationEdit[] {
  return [...edits.entries()]
    .filter(([key, edit]) => edit.touched && operations.has(key) && !operations.get(key)!.duplicate)
    .map(([key, edit]) => {
      const operation = operations.get(key)!;
      const transfer = edit.type === 'TRANSFER';
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
      };
    });
}
