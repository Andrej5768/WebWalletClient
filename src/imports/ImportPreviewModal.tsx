import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Pagination,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  TagsInput,
  Text,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { api } from '../api/client';
import { problemMessage, toProblem } from '../api/errors';
import { queryKeys, useAccounts, useCategories, useTags } from '../api/queries';
import { categorySelectData } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { allowedTypes, buildEdits, initialEdit, type RowEdit } from './edits';
import {
  confirmPreview,
  discardPreview,
  previewPage,
  type ImportResult,
  type Preview,
  type PreviewOperation,
} from './api';

type Type = NonNullable<PreviewOperation['type']>;
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
  const [result, setResult] = useState<ImportResult | null>(null);
  const id = preview.id!;

  const pageQuery = useQuery({
    queryKey: ['imports', 'preview', id, page],
    queryFn: () => previewPage(id, page - 1, PAGE_SIZE),
    initialData: page === 1 ? preview : undefined,
    enabled: page > 1,
  });
  const items = useMemo(
    () => (page === 1 ? preview.operations?.items : pageQuery.data?.operations?.items) ?? [],
    [page, preview, pageQuery.data],
  );

  // Remember every operation shown so far, so their edits can be sent from any page.
  const known = useMemo(() => {
    const next = new Map(seen);
    let changed = false;
    items.forEach((operation) => {
      if (operation.key && !next.has(operation.key)) {
        next.set(operation.key, operation);
        changed = true;
      }
    });
    return changed ? next : seen;
  }, [items, seen]);
  if (known !== seen) setSeen(known);

  const editOf = (operation: PreviewOperation) => edits.get(operation.key!) ?? initialEdit(operation);
  const change = (operation: PreviewOperation, patch: Partial<RowEdit>) =>
    setEdits((current) => {
      const next = new Map(current);
      next.set(operation.key!, { ...editOf(operation), ...patch, touched: true });
      return next;
    });

  const visible = items.filter((operation) => {
    const edit = editOf(operation);
    if (filter === 'duplicates') return operation.duplicate;
    if (filter === 'uncategorized')
      return edit.type !== 'TRANSFER' && !edit.categoryId && !operation.categoryName;
    return true;
  });

  const summary = preview.summary ?? {};
  const total = preview.operations?.totalItems ?? items.length;
  const duplicates = [...known.values()].filter((operation) => operation.duplicate).length;
  const uncategorized = [...known.values()].filter(
    (operation) => operation.type !== 'TRANSFER' && operation.categoryId == null && !operation.categoryName,
  ).length;
  const excluded = [...known.values()].filter((operation) => !editOf(operation).include).length;
  const importCount = total - excluded;

  const confirm = useMutation({
    mutationFn: async () => {
      // Tags are picked by name; create the missing ones first.
      const byName = new Map((tags.data ?? []).map((tag) => [tag.name!.toLowerCase(), tag.id!]));
      const names = new Set([...edits.values()].flatMap((edit) => edit.tags));
      for (const name of names) {
        if (byName.has(name.toLowerCase())) continue;
        const { data, error } = await api.POST('/api/v1/tags', { body: { name } });
        if (error || !data?.id) throw error ?? new Error('Tag not created');
        byName.set(name.toLowerCase(), data.id);
      }
      return confirmPreview(id, buildEdits(known, edits, byName));
    },
    onSuccess: async (imported) => {
      setResult(imported);
      await Promise.all(
        [
          queryKeys.transactions,
          queryKeys.accounts,
          queryKeys.categories,
          queryKeys.payees,
          queryKeys.tags,
          queryKeys.monobank,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });

  const cancel = () => {
    if (!result) void discardPreview(id);
    onClose();
  };

  const applyBulk = () => {
    setEdits((current) => {
      const next = new Map(current);
      selected.forEach((key) => {
        const operation = known.get(key);
        if (!operation) return;
        const edit = next.get(key) ?? initialEdit(operation);
        next.set(key, {
          ...edit,
          categoryId: bulkCategory && edit.type !== 'TRANSFER' ? bulkCategory : edit.categoryId,
          categoryChanged: edit.categoryChanged || (!!bulkCategory && edit.type !== 'TRANSFER'),
          tags:
            bulkTag.trim() && !edit.tags.includes(bulkTag.trim())
              ? [...edit.tags, bulkTag.trim()]
              : edit.tags,
          touched: true,
        });
      });
      return next;
    });
    setBulkCategory(null);
    setBulkTag('');
  };

  const ownAccounts = (accounts.data ?? []).filter((account) => !account.archived);
  const tagNames = (tags.data ?? []).map((tag) => tag.name ?? '');

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
          {(summary.warnings ?? []).length > 0 && (
            <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />} p="xs">
              <Stack gap={2}>
                {summary.warnings!.map((warning) => (
                  <Text key={warning} size="sm">
                    {warning}
                  </Text>
                ))}
              </Stack>
            </Alert>
          )}
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

          <div style={{ overflowX: 'auto' }}>
            <Table verticalSpacing={6} miw={1000}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={32}>
                    <Checkbox
                      aria-label={t('imports.preview.selectAll')}
                      checked={
                        visible.length > 0 && visible.every((operation) => selected.has(operation.key!))
                      }
                      onChange={(event) =>
                        setSelected(
                          event.currentTarget.checked
                            ? new Set(visible.map((operation) => operation.key!))
                            : new Set(),
                        )
                      }
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
                {visible.map((operation) => {
                  const edit = editOf(operation);
                  const signed =
                    operation.type === 'EXPENSE' ? -(operation.amount ?? 0) : (operation.amount ?? 0);
                  const missing = edit.type !== 'TRANSFER' && !edit.categoryId && !operation.categoryName;
                  const transferChoices = ownAccounts.filter(
                    (account) =>
                      account.currency === operation.currency && account.id !== operation.account?.id,
                  );
                  return (
                    <Table.Tr
                      key={operation.key}
                      data-testid={`preview-row-${operation.key}`}
                      style={{ opacity: edit.include ? 1 : 0.5 }}
                    >
                      <Table.Td>
                        <Checkbox
                          aria-label={t('imports.preview.select', { name: operation.payee ?? operation.key })}
                          checked={selected.has(operation.key!)}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setSelected((current) => {
                              const next = new Set(current);
                              if (checked) next.add(operation.key!);
                              else next.delete(operation.key!);
                              return next;
                            });
                          }}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          <Switch
                            size="xs"
                            aria-label={t('imports.preview.include', {
                              name: operation.payee ?? operation.key,
                            })}
                            checked={edit.include}
                            onChange={(event) => change(operation, { include: event.currentTarget.checked })}
                          />
                          {operation.duplicate && (
                            <Badge size="xs" variant="light" color="gray">
                              {t('imports.preview.duplicate')}
                            </Badge>
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td maw={260}>
                        <Text size="sm" fw={500} truncate>
                          {operation.payee ?? operation.comment ?? '—'}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {dayjs(operation.date).format('DD.MM.YYYY')} · {operation.account?.name}
                          {operation.account?.created ? ` (${t('imports.preview.new')})` : ''}
                          {operation.toAccount ? ` → ${operation.toAccount.name}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text
                          size="sm"
                          fw={500}
                          className={`num ${operation.type === 'TRANSFER' ? 'muted' : signed < 0 ? 'expense' : 'income'}`}
                        >
                          {formatMoney(signed, operation.currency ?? 'UAH', {
                            signed: operation.type !== 'TRANSFER',
                          })}
                        </Text>
                      </Table.Td>
                      <Table.Td w={150}>
                        <Stack gap={4}>
                          <Select
                            size="xs"
                            allowDeselect={false}
                            aria-label={t('imports.preview.typeOf', {
                              name: operation.payee ?? operation.key,
                            })}
                            data={allowedTypes(operation.type ?? 'EXPENSE').map((value) => ({
                              value,
                              label: t(`transactions.form.types.${value}`),
                            }))}
                            value={edit.type}
                            onChange={(value) => value && change(operation, { type: value as Type })}
                          />
                          {edit.type === 'TRANSFER' && operation.type !== 'TRANSFER' && (
                            <Select
                              size="xs"
                              placeholder={t('imports.preview.transferAccount')}
                              aria-label={t('imports.preview.transferAccount')}
                              data={transferChoices.map((account) => ({
                                value: String(account.id),
                                label: account.name ?? '',
                              }))}
                              value={edit.transferAccountId}
                              onChange={(value) => change(operation, { transferAccountId: value })}
                            />
                          )}
                        </Stack>
                      </Table.Td>
                      <Table.Td w={240}>
                        {edit.type === 'TRANSFER' ? (
                          <Text size="xs" c="dimmed">
                            —
                          </Text>
                        ) : (
                          <Stack gap={4}>
                            <Select
                              size="xs"
                              searchable
                              clearable
                              aria-label={t('imports.preview.categoryOf', {
                                name: operation.payee ?? operation.key,
                              })}
                              placeholder={
                                operation.categoryName && operation.categoryId == null
                                  ? t('imports.preview.newCategory', { name: operation.categoryName })
                                  : t('transactions.uncategorized')
                              }
                              data={categorySelectData(
                                categories.data ?? [],
                                edit.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
                              )}
                              value={edit.categoryId}
                              onChange={(value) =>
                                change(operation, { categoryId: value, categoryChanged: true })
                              }
                              styles={
                                missing
                                  ? {
                                      input: {
                                        borderColor: 'var(--ww-warn-border)',
                                        background: 'var(--ww-warn-bg)',
                                      },
                                    }
                                  : undefined
                              }
                            />
                            {edit.categoryChanged && edit.categoryId && operation.payee && (
                              <Checkbox
                                size="xs"
                                label={t('imports.preview.rememberRule')}
                                checked={edit.rememberRule}
                                onChange={(event) =>
                                  change(operation, { rememberRule: event.currentTarget.checked })
                                }
                              />
                            )}
                          </Stack>
                        )}
                      </Table.Td>
                      <Table.Td w={180}>
                        <TagsInput
                          size="xs"
                          aria-label={t('imports.preview.tagsOf', { name: operation.payee ?? operation.key })}
                          placeholder={edit.tags.length ? '' : t('imports.preview.addTag')}
                          data={tagNames}
                          value={edit.tags}
                          onChange={(value) => change(operation, { tags: value })}
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>

          {(preview.operations?.totalPages ?? 1) > 1 && (
            <Group justify="center">
              <Pagination size="sm" total={preview.operations!.totalPages!} value={page} onChange={setPage} />
            </Group>
          )}

          {confirm.error && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              {problemMessage(toProblem(confirm.error))}
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={cancel}>
              {t('common.cancel')}
            </Button>
            <Button loading={confirm.isPending} disabled={importCount <= 0} onClick={() => confirm.mutate()}>
              {t('imports.preview.submit', { count: importCount })}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function ResultView({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const { t } = useTranslation();
  const counts: [string, number | undefined][] = [
    ['transactionsImported', result.transactionsImported],
    ['transactionsMatched', result.transactionsMatched],
    ['transactionsSkipped', result.transactionsSkipped],
    ['accountsCreated', result.accountsCreated],
    ['accountsUpdated', result.accountsUpdated],
    ['categoriesCreated', result.categoriesCreated],
    ['payeesCreated', result.payeesCreated],
    ['budgetsImported', result.budgetsImported],
  ];
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {counts.map(([key, value]) => (
          <Stack key={key} gap={2} p="sm" style={{ border: '1px solid var(--ww-border)', borderRadius: 8 }}>
            <Text className="num" fz={22} fw={600}>
              {value ?? 0}
            </Text>
            <Text size="xs" c="dimmed">
              {t(`imports.result.${key}`)}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
      {(result.warnings ?? []).length > 0 && (
        <Alert
          color="yellow"
          variant="light"
          icon={<TriangleAlert size={16} />}
          title={t('imports.result.warnings')}
        >
          <Stack gap={2}>
            {result.warnings!.map((warning) => (
              <Text key={warning} size="sm">
                {warning}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t('imports.result.close')}
        </Button>
        <Anchor component={Link} to="/transactions" onClick={onClose}>
          <Button component="span">{t('imports.result.toTransactions')}</Button>
        </Anchor>
      </Group>
    </Stack>
  );
}
