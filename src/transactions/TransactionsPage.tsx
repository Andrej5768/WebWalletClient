import { Button, Card, Group, Pagination, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { check } from '../api/http';
import {
  invalidateLedger,
  useAccounts,
  useCategories,
  useCategoriesById,
  useTags,
  useTransaction,
  useTransactions,
} from '../api/queries';
import { QueryError } from '../components/feedback';
import { locale } from '../i18n';
import { formatMoney } from '../lib/money';
import { kyivToday } from '../lib/periods';
import { intParam } from '../lib/useUrlParams';
import { displayCategory, groupByDay, toRequest, type Transaction } from './model';
import { TransactionDrawer } from './TransactionDrawer';
import { TransactionFiltersBar } from './TransactionFiltersBar';
import { TransactionRow } from './TransactionRow';
import classes from './transactions.module.css';
import { PAGE_SIZE, useTransactionFilters } from './useTransactionFilters';

export function TransactionsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const filters = useTransactionFilters();
  const { params, page, query, update } = filters;

  const transactions = useTransactions(query);
  const accounts = useAccounts();
  const categories = useCategories();
  const categoriesById = useCategoriesById();
  const tags = useTags();

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account])),
    [accounts.data],
  );
  const tagsById = useMemo(() => new Map((tags.data ?? []).map((tag) => [tag.id, tag])), [tags.data]);

  const recategorize = useMutation({
    mutationFn: ({ transaction, categoryId }: { transaction: Transaction; categoryId: number }) =>
      check(
        api.PUT('/api/v1/transactions/{id}', {
          params: { path: { id: transaction.id } },
          body: toRequest(transaction, { categoryId, splits: undefined }),
        }),
      ),
    onSettled: () => invalidateLedger(queryClient),
  });

  // A transaction opened by link may be outside the current page or period: it is loaded by id.
  const editId = intParam(params, 'edit') ?? null;
  const onPage = transactions.data?.items.find((item) => item.id === editId);
  const loaded = useTransaction(editId !== null && !onPage && !transactions.isLoading ? editId : null);
  const editing = onPage ?? loaded.data ?? null;
  const editMissing = editId !== null && loaded.isSuccess && loaded.data === null;

  const total = transactions.data?.totalItems ?? 0;
  const days = groupByDay(transactions.data?.items ?? []);
  const today = kyivToday();

  const dayLabel = (date: string) => {
    const day = dayjs(date);
    const formatted = day
      .toDate()
      .toLocaleDateString(locale(i18n.language), { weekday: 'long', day: 'numeric', month: 'long' });
    if (day.isSame(today, 'day')) return `${t('transactions.today')}, ${formatted}`;
    if (day.isSame(today.subtract(1, 'day'), 'day')) return `${t('transactions.yesterday')}, ${formatted}`;
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Title order={1} size="h2">
            {t('nav.transactions')}
          </Title>
          <Text c="dimmed">{t('transactions.count', { count: total })}</Text>
        </Stack>
        <Button
          leftSection={<Plus size={16} />}
          onClick={() => update({ new: '1', edit: null, page: params.get('page') })}
        >
          {t('shell.addTransaction')}
        </Button>
      </Group>

      <TransactionFiltersBar filters={filters} />
      <QueryError error={transactions.error} onRetry={() => void transactions.refetch()} />
      {editMissing && <QueryError error={{ detail: t('transactions.notFound') }} />}

      <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          {transactions.isLoading && <Skeleton height={240} m="md" />}
          {transactions.isSuccess && days.length === 0 && (
            <Stack align="center" gap={6} py={48}>
              <Text fw={500}>{t('transactions.empty.title')}</Text>
              <Text size="sm" c="dimmed">
                {t('transactions.empty.text')}
              </Text>
            </Stack>
          )}
          {days.map((day) => (
            <div key={day.date}>
              <div className={classes.day}>
                <span>{dayLabel(day.date)}</span>
                <span className="num muted">
                  {day.totals
                    .map((item) => formatMoney(item.amount, item.currency, { signed: true }))
                    .join(' · ')}
                </span>
              </div>
              {day.transactions.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  category={displayCategory(transaction, categoriesById)}
                  categories={categories.data ?? []}
                  accountName={accountsById.get(transaction.accountId)?.name}
                  toAccountName={
                    transaction.toAccountId ? accountsById.get(transaction.toAccountId)?.name : undefined
                  }
                  tags={transaction.tagIds.map((id) => tagsById.get(id)).filter((tag) => tag !== undefined)}
                  onOpen={() => update({ edit: String(transaction.id), new: null, page: params.get('page') })}
                  onCategorize={(categoryId) => recategorize.mutate({ transaction, categoryId })}
                />
              ))}
            </div>
          ))}
          {(transactions.data?.totalPages ?? 0) > 1 && (
            <Group justify="space-between" px="md" py="sm" className={classes.footer}>
              <Text size="xs" c="dimmed">
                {t('transactions.shown', {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, total),
                  total,
                })}
              </Text>
              <Pagination
                size="sm"
                total={transactions.data?.totalPages ?? 1}
                value={page}
                onChange={(value) => update({ page: value === 1 ? null : String(value) })}
              />
            </Group>
          )}
        </div>
      </Card>

      {(params.get('new') || editing) && (
        <TransactionDrawer
          key={editing?.id ?? 'new'}
          transaction={params.get('new') ? null : editing}
          defaultAccountId={intParam(params, 'accountId')}
          onClose={() => update({ new: null, edit: null, page: params.get('page') })}
        />
      )}
    </Stack>
  );
}
