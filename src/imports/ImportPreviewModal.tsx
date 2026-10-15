import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TagsInput,
  Text,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
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
import { buildEdits, initialEdit, isUncategorized, needsTransferAccount, type RowEdit } from './edits';
import { PreviewRow } from './PreviewRow';

type Filter = 'all' | 'uncategorized' | 'duplicates';

const PAGE_SIZE = 100;

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
  const editOf = (operation: PreviewOperation) =>
    edits.get(operation.key) ?? initialEdit(operation, tagNamesById);
  const change = (operation: PreviewOperation, patch: Partial<RowEdit>) =>
    setEdits((current) =>
      new Map(current).set(operation.key, { ...editOf(operation), ...patch, touched: true }),
    );

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

  const confirm = useMutation({
    mutationFn: async () => {
      const changed = [...edits.values()].filter((edit) => edit.touched && edit.include);
      const names = [
        ...new Map(
          changed.flatMap((edit) => edit.tags).map((name) => [name.trim().toLowerCase(), name]),
        ).values(),
      ];
      const ids = await ensureTagIds(names, tags.data ?? [], queryClient);
      const tagIds = new Map(names.map((name, index) => [name.trim().toLowerCase(), ids[index]!]));
      return confirmPreview(id, buildEdits(known, edits, tagIds));
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
        const edit = next.get(key) ?? initialEdit(operation, tagNamesById);
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

  const ownAccounts = (accounts.data ?? []).filter((account) => !account.archived);
  const tagNames = (tags.data ?? []).map((tag) => tag.name);

  return (
    <Modal
      opened
      onClose={cancel}
      size={1100}
      title={<Text fw={600}>{t(result ? 'imports.result.title' : 'imports.preview.title')}</Text>}
    >
      {result ? (
        <ResultView result={result} onClose={onClose} />
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

function ResultView({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const { t } = useTranslation();
  const counts = [
    'transactionsImported',
    'transactionsMatched',
    'transactionsSkipped',
    'accountsCreated',
    'accountsUpdated',
    'categoriesCreated',
    'payeesCreated',
    'budgetsImported',
  ] as const;
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {counts.map((key) => (
          <Stack key={key} gap={2} p="sm" style={{ border: '1px solid var(--ww-border)', borderRadius: 8 }}>
            <Text className="num" fz={22} fw={600}>
              {result[key]}
            </Text>
            <Text size="xs" c="dimmed">
              {t(`imports.result.${key}`)}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
      <Warnings warnings={result.warnings} title={t('imports.result.warnings')} />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t('imports.result.close')}
        </Button>
        <Button component={Link} to="/transactions" onClick={onClose}>
          {t('imports.result.toTransactions')}
        </Button>
      </Group>
    </Stack>
  );
}
