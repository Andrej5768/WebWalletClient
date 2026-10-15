import type { OperationEdit, PreviewOperation } from './api';

type Type = NonNullable<PreviewOperation['type']>;

/** What the user may have changed in one previewed operation. */
export interface RowEdit {
  include: boolean;
  type: Type;
  transferAccountId: string | null;
  categoryId: string | null;
  tags: string[];
  comment?: string;
  rememberRule: boolean;
  categoryChanged: boolean;
  touched: boolean;
}

export function initialEdit(operation: PreviewOperation): RowEdit {
  return {
    include: !operation.duplicate,
    type: operation.type ?? 'EXPENSE',
    transferAccountId: null,
    categoryId: operation.categoryId != null ? String(operation.categoryId) : null,
    tags: [],
    comment: operation.comment,
    rememberRule: false,
    categoryChanged: false,
    // Duplicates are excluded by default, which the server would not do on its own.
    touched: !!operation.duplicate,
  };
}

/** Allowed type changes: an expense or income can become a transfer, a transfer either of them. */
export function allowedTypes(type: Type): Type[] {
  return type === 'TRANSFER' ? ['TRANSFER', 'EXPENSE', 'INCOME'] : [type, 'TRANSFER'];
}

/** The confirm request: every touched row with all its values, since a listed row gets exactly what is sent. */
export function buildEdits(
  operations: Map<string, PreviewOperation>,
  edits: Map<string, RowEdit>,
  tagIds: Map<string, number>,
): OperationEdit[] {
  return [...operations.entries()]
    .map(([key, operation]) => [key, operation, edits.get(key) ?? initialEdit(operation)] as const)
    .filter(([, , edit]) => edit.touched)
    .map(([key, operation, edit]) => {
      const transfer = edit.type === 'TRANSFER';
      return {
        key,
        include: edit.include,
        type: edit.type,
        transferAccountId:
          transfer && operation?.type !== 'TRANSFER' && edit.transferAccountId
            ? Number(edit.transferAccountId)
            : undefined,
        categoryId: !transfer && edit.categoryId ? Number(edit.categoryId) : undefined,
        tagIds: edit.tags.map((name) => tagIds.get(name.toLowerCase())).filter((id): id is number => !!id),
        comment: edit.comment,
        rememberRule: edit.categoryChanged && edit.rememberRule,
      };
    });
}
