import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  Stack,
  Table,
  TagsInput,
  Text,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  invalidateCategories,
  invalidateLedger,
  queryKeys,
  useAccounts,
  useCategories,
  useTags,
} from '../api/queries';
import { ensureTagIds } from '../api/tags';
import { FormFooter } from '../components/FormFooter';
import { ProblemAlert, QueryError } from '../components/feedback';
import { categorySelectData } from '../lib/categories';
import {
  confirmPreview,
  discardPreview,
  previewPage,
  type ImportResult,
  type Preview,
  type PreviewOperation,
} from './api';
import {
  buildEdits,
  canPair,
  exactPairs,
  initialEdit,
  isUncategorized,
  needsTransferAccount,
  samePair,
  type Pair,
  type RowEdit,
} from './edits';
import { ImportResultView } from './ImportResultView';
import { PreviewRow } from './PreviewRow';
import { selectableAccounts } from '../lib/accounts';

type Filter = 'all' | 'uncategorized' | 'duplicates';

const PAGE_SIZE = 100;

const RESULT_COUNTS = [
  'transactionsImported',
  'transactionsMatched',
  'transactionsSkipped',
  'accountsCreated',
  'accountsUpdated',
  'categoriesCreated',
  'payeesCreated',
  'budgetsImported',
] as const;

export function ImportPreviewModal({ preview, onClose }: { preview: Preview; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const categories = useCategories();
  const accounts = useAccounts();
  const tags = useTags();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [edits, setEdits] = useState<Map<string, RowEdit>>(new Map());
  const [seen, setSeen] = useState<Map<string, PreviewOperation>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string | null>(null);
  const [bulkTag, setBulkTag] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const id = preview.id;

  const pageQuery = useQuery({
    queryKey: queryKeys.preview(id, page),
    queryFn: () => previewPage(id, page - 1, PAGE_SIZE),
    enabled: page > 1,
  });
  const items = useMemo(
    () => (page === 1 ? preview.operations.items : (pageQuery.data?.operations.items ?? [])),
    [page, preview, pageQuery.data],
  );

  // Every operation shown so far, so their edits can be sent from any page.
  const known = useMemo(() => {
    const added = items.filter((operation) => !seen.has(operation.key));
    return added.length
      ? new Map([...seen, ...added.map((operation) => [operation.key, operation] as const)])
      : seen;
  }, [items, seen]);
  if (known !== seen) setSeen(known);

  const tagNamesById = useMemo(
    () => new Map((tags.data ?? []).map((tag) => [tag.id, tag.name])),
    [tags.data],
  );
  // Exact matches are merged unless the user says otherwise.
  const autoPairs = useMemo(() => exactPairs(known.values()), [known]);
  const initial = (operation: PreviewOperation) =>
    initialEdit(operation, tagNamesById, autoPairs.get(operation.key) ?? null);
  const editOf = (operation: PreviewOperation) => edits.get(operation.key) ?? initial(operation);

  /**
   * Applies a change and keeps the pairs consistent: an operation of the file paired with this one
   * points back at it, and a half chosen here is let go by any other row.
   */
  const update = (operation: PreviewOperation, patch: Partial<RowEdit>) =>
    setEdits((current) => {
      const next = new Map(current);
      const get = (key: string) => {
        const other = known.get(key);
        return next.get(key) ?? (other ? initial(other) : undefined);
      };
      const set = (key: string, values: Partial<RowEdit>) => {
        const edit = get(key);
        if (edit) next.set(key, { ...edit, ...values, touched: true });
      };
      const release = (key: string) => {
        const partner = get(key)?.pair?.operationKey;
        if (partner != null && get(partner)?.pair?.operationKey === key) set(partner, { pair: null });
      };
      const merged = { ...get(operation.key)!, ...patch };
      const pair = merged.include && canPair(operation, merged) ? merged.pair : null;
      const before = get(operation.key)!.pair;
      if (!samePair(before, pair)) {
        release(operation.key);
        if (pair) {
          known.forEach((_, key) => {
            if (key !== operation.key && samePair(get(key)?.pair ?? null, pair)) set(key, { pair: null });
          });
          if (pair.operationKey != null) {
            release(pair.operationKey);
            known.forEach((_, key) => {
              if (get(key)?.pair?.operationKey === operation.key && key !== pair.operationKey)
                set(key, { pair: null });
            });
            set(pair.operationKey, { pair: { operationKey: operation.key, transactionId: null } });
          }
        }
      }
      next.set(operation.key, { ...merged, pair, touched: true });
      return next;
    });
  const change = (operation: PreviewOperation, patch: Partial<RowEdit>) => update(operation, patch);
  const choosePair = (operation: PreviewOperation, pair: Pair | null) => update(operation, { pair });

  const visible = items.filter((operation) => {
    if (filter === 'duplicates') return operation.duplicate;
    if (filter === 'uncategorized')
      return !operation.duplicate && isUncategorized(operation, editOf(operation));
    return true;
  });
  const selectable = visible.filter((operation) => !operation.duplicate);

  const summary = preview.summary;
  const total = preview.operations.totalItems;
  // Duplicates are never imported; the summary counts what the import would do as previewed.
  const duplicates = total - summary.transactionsImported;
  const uncategorized = [...known.values()].filter(
    (operation) => !operation.duplicate && isUncategorized(operation, editOf(operation)),
  ).length;
  const excluded = [...known.values()].filter(
    (operation) => !operation.duplicate && !editOf(operation).include,
  );
  const importCount = summary.transactionsImported - excluded.length;
  const withoutTransferAccount = [...known.values()].filter((operation) =>
    needsTransferAccount(operation, editOf(operation)),
  );
  // A pair within the file counts once.
  const pairable = [...known.values()].filter((operation) => canPair(operation, editOf(operation)));
  const chosenPairs = pairable.filter((operation) => {
    const edit = editOf(operation);
    return edit.include && edit.pair && (edit.pair.operationKey == null || operation.type === 'EXPENSE');
  }).length;
  const possiblePairs = pairable.filter(
    (operation) =>
      operation.type === 'EXPENSE' ||
      !(operation.transferSuggestions ?? []).some((suggestion) => suggestion.operationKey != null),
  ).length;

  const confirm = useMutation({
    mutationFn: async () => {
      const changed = [...known.values()]
        .map(editOf)
        .filter((edit) => (edit.touched || edit.pair) && edit.include);
      const names = [
        ...new Map(
          changed.flatMap((edit) => edit.tags).map((name) => [name.trim().toLowerCase(), name]),
        ).values(),
      ];
      const ids = await ensureTagIds(names, tags.data ?? [], queryClient);
      const tagIds = new Map(names.map((name, index) => [name.trim().toLowerCase(), ids[index]!]));
      return confirmPreview(id, buildEdits(known, editOf, tagIds));
    },
    onSuccess: async (imported) => {
      setResult(imported);
      await Promise.all([invalidateLedger(queryClient), invalidateCategories(queryClient)]);
    },
    meta: { errorShown: true },
  });

  const submit = () => {
    if (withoutTransferAccount.length > 0) {
      setShowErrors(true);
      return;
    }
    confirm.mutate();
  };

  const cancel = () => {
    // Closing is blocked while the import runs, so it never discards a preview being confirmed.
    if (confirm.isPending) return;
    // The server forgets an unconfirmed preview on its own too; a failed discard changes nothing.
    if (!result) discardPreview(id).catch(() => undefined);
    onClose();
  };

  const applyBulk = () => {
    setEdits((current) => {
      const next = new Map(current);
      selected.forEach((key) => {
        const operation = known.get(key);
        if (!operation) return;
        const edit = next.get(key) ?? initial(operation);
        const categorize = !!bulkCategory && edit.type !== 'TRANSFER';
        const tag = bulkTag.trim();
        next.set(key, {
          ...edit,
          categoryId: categorize ? bulkCategory : edit.categoryId,
          categoryChanged: edit.categoryChanged || categorize,
          tags:
            tag && !edit.tags.some((name) => name.toLowerCase() === tag.toLowerCase())
              ? [...edit.tags, tag]
              : edit.tags,
          touched: true,
        });
      });
      return next;
    });
    setBulkCategory(null);
    setBulkTag('');
  };

  // The header checkbox selects or clears the rows of this page; selections on other pages stay.
  const allVisibleSelected =
    selectable.length > 0 && selectable.every((operation) => selected.has(operation.key));
  const toggleVisible = (checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      selectable.forEach((operation) => (checked ? next.add(operation.key) : next.delete(operation.key)));
      return next;
    });

  const ownAccounts = selectableAccounts(accounts.data ?? []);
  const tagNames = (tags.data ?? []).map((tag) => tag.name);

  return (
    <Modal
      opened
      onClose={cancel}
      closeOnEscape={!confirm.isPending}
      closeOnClickOutside={!confirm.isPending}
      closeButtonProps={{ disabled: confirm.isPending }}
      size={1100}
      title={<Text fw={600}>{t(result ? 'imports.result.title' : 'imports.preview.title')}</Text>}
    >
      {result ? (
        <ImportResultView
          stats={RESULT_COUNTS.map((key) => ({
            key,
            label: t(`imports.result.${key}`),
            value: result[key],
          }))}
          link={{ to: '/transactions', label: t('imports.result.toTransactions') }}
          onClose={onClose}
        >
          <Warnings warnings={result.warnings} title={t('imports.result.warnings')} />
        </ImportResultView>
      ) : (
        <Stack gap="md">
          <Text size="sm">
            {t('imports.preview.summary', { count: total, duplicates, uncategorized })}
            {summary.accountsCreated
              ? ` · ${t('imports.preview.accountsCreated', { count: summary.accountsCreated })}`
              : ''}
            {summary.categoriesCreated
              ? ` · ${t('imports.preview.categoriesCreated', { count: summary.categoriesCreated })}`
              : ''}
          </Text>
          {possiblePairs > 0 && (
            <Alert color="blue" variant="light" p="xs">
              {t('imports.preview.pairs', { count: possiblePairs, chosen: chosenPairs })}
            </Alert>
          )}
          <Warnings warnings={summary.warnings} />
          <Group justify="space-between" wrap="wrap" gap="sm">
            <SegmentedControl
              size="xs"
              aria-label={t('imports.preview.filter')}
              value={filter}
              onChange={(value) => setFilter(value as Filter)}
              data={(['all', 'uncategorized', 'duplicates'] as const).map((value) => ({
                value,
                label: t(`imports.preview.filters.${value}`),
              }))}
            />
            <Group gap="xs" wrap="wrap">
              <Select
                size="xs"
                w={220}
                searchable
                clearable
                aria-label={t('imports.preview.bulkCategory')}
                placeholder={t('imports.preview.bulkCategory')}
                data={categorySelectData(categories.data ?? [])}
                value={bulkCategory}
                onChange={setBulkCategory}
              />
              <TagsInput
                size="xs"
                w={160}
                maxTags={1}
                aria-label={t('imports.preview.bulkTag')}
                placeholder={t('imports.preview.bulkTag')}
                data={tagNames}
                value={bulkTag ? [bulkTag] : []}
                onChange={(values) => setBulkTag(values[0] ?? '')}
              />
              <Button
                size="xs"
                variant="default"
                disabled={selected.size === 0 || (!bulkCategory && !bulkTag.trim())}
                onClick={applyBulk}
              >
                {t('imports.preview.applyToSelected', { count: selected.size })}
              </Button>
            </Group>
          </Group>

          <QueryError error={pageQuery.error} onRetry={() => void pageQuery.refetch()} />
          <div style={{ overflowX: 'auto' }}>
            <Table verticalSpacing={6} miw={1000}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={32}>
                    <Checkbox
                      aria-label={t('imports.preview.selectAll')}
                      checked={allVisibleSelected}
                      indeterminate={
                        !allVisibleSelected && selectable.some((operation) => selected.has(operation.key))
                      }
                      onChange={(event) => toggleVisible(event.currentTarget.checked)}
                    />
                  </Table.Th>
                  <Table.Th>{t('imports.preview.columns.import')}</Table.Th>
                  <Table.Th>{t('imports.preview.columns.operation')}</Table.Th>
                  <Table.Th ta="right">{t('imports.preview.columns.amount')}</Table.Th>
                  <Table.Th>{t('imports.preview.columns.type')}</Table.Th>
                  <Table.Th>{t('imports.preview.columns.category')}</Table.Th>
                  <Table.Th>{t('imports.preview.columns.tags')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((operation) => (
                  <PreviewRow
                    key={operation.key}
                    operation={operation}
                    edit={editOf(operation)}
                    selected={selected.has(operation.key)}
                    categories={categories.data ?? []}
                    accounts={ownAccounts}
                    tagNames={tagNames}
                    showErrors={showErrors}
                    onSelect={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(operation.key);
                        else next.delete(operation.key);
                        return next;
                      })
                    }
                    onChange={(patch) => change(operation, patch)}
                    onPair={(pair) => choosePair(operation, pair)}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </div>

          {preview.operations.totalPages > 1 && (
            <Group justify="center">
              <Pagination size="sm" total={preview.operations.totalPages} value={page} onChange={setPage} />
            </Group>
          )}

          {showErrors && withoutTransferAccount.length > 0 && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              {t('imports.preview.transfersIncomplete', { count: withoutTransferAccount.length })}
            </Alert>
          )}
          <ProblemAlert error={confirm.error} />
          <FormFooter
            onCancel={cancel}
            saving={confirm.isPending}
            submitDisabled={importCount <= 0 || !tags.isSuccess}
            submitLabel={t('imports.preview.submit', { count: Math.max(importCount, 0) })}
            onSubmit={submit}
          />
        </Stack>
      )}
    </Modal>
  );
}

function Warnings({ warnings, title }: { warnings: string[]; title?: string }) {
  if (warnings.length === 0) return null;
  return (
    <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />} p="xs" title={title}>
      <Stack gap={2}>
        {warnings.map((warning) => (
          <Text key={warning} size="sm">
            {warning}
          </Text>
        ))}
      </Stack>
    </Alert>
  );
}
