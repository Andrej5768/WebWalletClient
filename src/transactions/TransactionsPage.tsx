import { Button, Card, Group, Pagination, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ListPlus, Repeat } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { useConfirmOccurrence, useOccurrences, type Occurrence } from '../recurring/api';
import { ConfirmModal } from '../recurring/ConfirmModal';
import { LinkModal } from '../recurring/LinkModal';
import { PlannedGroup } from '../recurring/PlannedGroup';
import { RecurringDrawer, type RecurringView } from '../recurring/RecurringDrawer';
import { displayCategory, groupByDay, toRequest, type Transaction } from './model';
import { PairHint } from './PairHint';
import { TransactionDrawer } from './TransactionDrawer';
import { TransactionFiltersBar } from './TransactionFiltersBar';
import { debtAccountIds } from './debts';
import { BulkDrawer } from './BulkDrawer';
import { debtDirection, type TransactionValues } from './form';
import { TransactionRow } from './TransactionRow';
import classes from './transactions.module.css';
import { useTransferPairs } from './transferPairs';
import { PAGE_SIZE, useTransactionFilters } from './useTransactionFilters';

/** Values a link opens the new-transaction form with: a transfer to an account, or an income or expense of an amount. */
function newDefaults(params: URLSearchParams): Partial<TransactionValues> | undefined {
  const type = params.get('newType');
  if (type === 'TRANSFER') return { type, toAccountId: params.get('toAccountId') };
  if (type === 'INCOME' || type === 'EXPENSE') {
    const amount = Number(params.get('amount'));
    return { type, amount: amount > 0 ? amount : '' };
  }
  return undefined;
}

export function TransactionsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const filters = useTransactionFilters();
  const { params, page, query, period, update } = filters;

  const transactions = useTransactions(query);
  const accounts = useAccounts();
  const categories = useCategories();
  const categoriesById = useCategoriesById();
  const tags = useTags();

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id, account])),
    [accounts.data],
  );
  const debtAccounts = useMemo(() => debtAccountIds(accounts.data ?? []), [accounts.data]);
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

  // Possible transfers among the operations of this page: both halves are shown, the hint follows their day.
  const shown = useMemo(
    () => new Map((transactions.data?.items ?? []).map((item) => [item.id, item])),
    [transactions.data],
  );
  const dates = days.map((day) => day.date).sort();
  const pairs = useTransferPairs(dates[0] ?? null, dates.at(-1) ?? null);
  const pairsOf = (date: string) =>
    (pairs.data ?? []).filter(
      (pair) => pair.date === date && shown.has(pair.expenseId) && shown.has(pair.incomeId),
    );
  const accountOf = (id: number) => accountsById.get(shown.get(id)!.accountId)?.name ?? '';
  const today = kyivToday();
  const todayIso = today.format('YYYY-MM-DD');

  // Planned payments sit above today's operations: only on the first page of a period with today
  // and without filters they could not be matched against.
  const showPlanned =
    page === 1 &&
    !params.get('q') &&
    !params.get('categoryId') &&
    !params.get('payeeId') &&
    !params.get('tagId') &&
    (!period.from || period.from <= todayIso) &&
    (!period.to || period.to >= todayIso);
  const occurrences = useOccurrences(showPlanned);
  const accountFilter = intParam(params, 'accountId');
  const typeFilter = params.get('type');
  const planned = (occurrences.data ?? []).filter(
    (item) =>
      item.status === 'PENDING' &&
      (!accountFilter || item.accountId === accountFilter || item.toAccountId === accountFilter) &&
      (!typeFilter || item.type === typeFilter),
  );
  const [linkFor, setLinkFor] = useState<Occurrence | null>(null);
  const [confirmFor, setConfirmFor] = useState<Occurrence | null>(null);
  const confirm = useConfirmOccurrence();
  const recurringParam = params.get('recurring');
  const recurringView: RecurringView | null =
    recurringParam === 'list' || recurringParam === 'new'
      ? recurringParam
      : recurringParam
        ? Number(recurringParam)
        : null;
  const openRecurring = (view: RecurringView | null) =>
    update({ recurring: view === null ? null : String(view), page: params.get('page') });

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
        <Group gap="xs">
          <Button variant="default" leftSection={<Repeat size={16} />} onClick={() => openRecurring('list')}>
            {t('recurring.button')}
          </Button>
          <Button
            variant="default"
            leftSection={<ListPlus size={16} />}
            onClick={() => update({ bulk: '1', page: params.get('page') })}
          >
            {t('transactions.bulk.button')}
          </Button>
        </Group>
      </Group>

      <TransactionFiltersBar filters={filters} />
      <QueryError error={transactions.error} onRetry={() => void transactions.refetch()} />
      {editMissing && <QueryError error={{ detail: t('transactions.notFound') }} />}

      <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          {transactions.isLoading && <Skeleton height={240} m="md" />}
          {showPlanned && (
            <PlannedGroup
              occurrences={planned}
              accountsById={accountsById}
              categoriesById={categoriesById}
              onConfirm={(occurrence) =>
                occurrence.variableAmount ? setConfirmFor(occurrence) : confirm.mutate({ occurrence })
              }
              onLink={setLinkFor}
              onEditSeries={(id) => openRecurring(id)}
              busy={(occurrence) =>
                confirm.isPending &&
                confirm.variables?.occurrence.recurringId === occurrence.recurringId &&
                confirm.variables.occurrence.date === occurrence.date
              }
            />
          )}
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
                  debt={debtDirection(transaction, debtAccounts)}
                  tags={transaction.tagIds.map((id) => tagsById.get(id)).filter((tag) => tag !== undefined)}
                  onOpen={() => update({ edit: String(transaction.id), new: null, page: params.get('page') })}
                  onCategorize={(categoryId) => recategorize.mutate({ transaction, categoryId })}
                />
              ))}
              {pairsOf(day.date).map((pair) => (
                <PairHint
                  key={`${pair.expenseId}-${pair.incomeId}`}
                  pair={pair}
                  names={[accountOf(pair.expenseId), accountOf(pair.incomeId)]}
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
          defaults={newDefaults(params)}
          onClose={() =>
            update({
              new: null,
              edit: null,
              newType: null,
              toAccountId: null,
              amount: null,
              page: params.get('page'),
            })
          }
        />
      )}
      {params.get('bulk') && <BulkDrawer onClose={() => update({ bulk: null, page: params.get('page') })} />}
      {recurringView !== null && (
        <RecurringDrawer view={recurringView} onView={openRecurring} onClose={() => openRecurring(null)} />
      )}
      {linkFor && (
        <LinkModal occurrence={linkFor} accountsById={accountsById} onClose={() => setLinkFor(null)} />
      )}
      {confirmFor && <ConfirmModal occurrence={confirmFor} onClose={() => setConfirmFor(null)} />}
    </Stack>
  );
}
