import {
  Badge,
  Button,
  Card,
  CloseButton,
  Group,
  Kbd,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { api } from '../api/client';
import {
  queryKeys,
  useAccounts,
  useCategories,
  usePayees,
  useTags,
  useTransactions,
  type TransactionQuery,
} from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { locale } from '../i18n';
import { categorySelectData, type CategoryInfo } from '../lib/categories';
import { formatMoney } from '../lib/money';
import { mantineColor } from '../lib/palette';
import {
  displayCategory,
  groupByDay,
  isSplit,
  isUncategorized,
  signedAmount,
  toRequest,
  type Transaction,
} from './model';
import { periodOf, presets, type Preset } from './periods';
import { TransactionDrawer } from './TransactionDrawer';
import classes from './transactions.module.css';

const PAGE_SIZE = 50;
const TYPES = ['', 'EXPENSE', 'INCOME', 'TRANSFER'] as const;

export function TransactionsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const preset = (params.get('period') as Preset | null) ?? 'month';
  const [searchOpen, setSearchOpen] = useState(!!params.get('q'));
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  useHotkeys([['mod+K', () => setSearchOpen(true)]]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  const period = periodOf(preset, new Date(), {
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });
  const page = Number(params.get('page') ?? '1');
  const number = (key: string) => (params.get(key) ? Number(params.get(key)) : undefined);
  const query: TransactionQuery = {
    from: period.from,
    to: period.to,
    accountId: number('accountId'),
    categoryId: number('categoryId'),
    payeeId: number('payeeId'),
    tagId: number('tagId'),
    type: (params.get('type') || undefined) as TransactionQuery['type'],
    q: debouncedSearch || undefined,
    page: page - 1,
    size: PAGE_SIZE,
  };

  const transactions = useTransactions(query);
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const tags = useTags();

  const accountsById = useMemo(
    () => new Map((accounts.data ?? []).map((account) => [account.id!, account])),
    [accounts.data],
  );
  const categoriesById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category])),
    [categories.data],
  );
  const tagsById = useMemo(() => new Map((tags.data ?? []).map((tag) => [tag.id!, tag])), [tags.data]);

  const recategorize = useMutation({
    mutationFn: async ({ transaction, categoryId }: { transaction: Transaction; categoryId: number }) => {
      const { error } = await api.PUT('/api/v1/transactions/{id}', {
        params: { path: { id: transaction.id! } },
        body: toRequest(transaction, { categoryId, splits: undefined }),
      });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
  });

  const drawer = params.get('new') ? 'new' : params.get('edit');
  const editing =
    drawer && drawer !== 'new' ? transactions.data?.items?.find((item) => String(item.id) === drawer) : null;
  const total = transactions.data?.totalItems ?? 0;
  const days = groupByDay(transactions.data?.items ?? []);

  const dayLabel = (date: string) => {
    const day = dayjs(date);
    const formatted = day.toDate().toLocaleDateString(locale(i18n.language), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    if (day.isSame(dayjs(), 'day')) return `${t('transactions.today')}, ${formatted}`;
    if (day.isSame(dayjs().subtract(1, 'day'), 'day')) return `${t('transactions.yesterday')}, ${formatted}`;
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
        <Button leftSection={<Plus size={16} />} onClick={() => update({ new: '1' })}>
          {t('shell.addTransaction')}
        </Button>
      </Group>

      <Card withBorder radius="md" padding="md">
        <Stack gap="sm">
          <Group gap="sm" wrap="wrap">
            <SegmentedControl
              aria-label={t('transactions.period')}
              value={preset}
              onChange={(value) => update({ period: value === 'month' ? null : value })}
              data={presets.map((value) => ({ value, label: t(`transactions.presets.${value}`) }))}
            />
            {preset === 'custom' ? (
              <DatePickerInput
                type="range"
                aria-label={t('transactions.presets.custom')}
                valueFormat="DD.MM.YYYY"
                w={240}
                value={[params.get('from'), params.get('to')]}
                onChange={([from, to]) => update({ from, to })}
                clearable
              />
            ) : (
              <Text size="sm" c="dimmed">
                {period.from
                  ? `${dayjs(period.from).format('DD.MM.YYYY')} – ${dayjs(period.to).format('DD.MM.YYYY')}`
                  : t('transactions.allTime')}
              </Text>
            )}
            <div style={{ flex: 1 }} />
            {searchOpen ? (
              <TextInput
                autoFocus
                w={300}
                aria-label={t('transactions.search')}
                placeholder={t('transactions.searchPlaceholder')}
                leftSection={<Search size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                rightSection={
                  <CloseButton
                    size="sm"
                    aria-label={t('transactions.closeSearch')}
                    onClick={() => {
                      setSearch('');
                      setSearchOpen(false);
                    }}
                  />
                }
              />
            ) : (
              <Button
                variant="default"
                size="sm"
                leftSection={<Search size={16} />}
                rightSection={<Kbd size="xs">Ctrl K</Kbd>}
                onClick={() => setSearchOpen(true)}
              >
                {t('transactions.search')}
              </Button>
            )}
          </Group>
          <Group gap="sm" wrap="wrap" align="flex-end">
            <Select
              size="sm"
              w={210}
              clearable
              searchable
              placeholder={t('transactions.filters.allAccounts')}
              aria-label={t('transactions.filters.account')}
              value={params.get('accountId')}
              onChange={(value) => update({ accountId: value })}
              data={(accounts.data ?? [])
                .filter((account) => !account.archived)
                .map((account) => ({ value: String(account.id), label: account.name ?? '' }))}
            />
            <Select
              size="sm"
              w={230}
              clearable
              searchable
              placeholder={t('transactions.filters.allCategories')}
              aria-label={t('transactions.filters.category')}
              value={params.get('categoryId')}
              onChange={(value) => update({ categoryId: value })}
              data={categorySelectData(categories.data ?? [])}
            />
            <Select
              size="sm"
              w={190}
              clearable
              searchable
              placeholder={t('transactions.filters.allPayees')}
              aria-label={t('transactions.filters.payee')}
              value={params.get('payeeId')}
              onChange={(value) => update({ payeeId: value })}
              data={(payees.data ?? []).map((payee) => ({
                value: String(payee.id),
                label: payee.name ?? '',
              }))}
            />
            <Select
              size="sm"
              w={160}
              clearable
              placeholder={t('transactions.filters.allTags')}
              aria-label={t('transactions.filters.tag')}
              value={params.get('tagId')}
              onChange={(value) => update({ tagId: value })}
              data={(tags.data ?? []).map((tag) => ({ value: String(tag.id), label: `#${tag.name}` }))}
            />
            <SegmentedControl
              aria-label={t('transactions.filters.type')}
              value={params.get('type') ?? ''}
              onChange={(value) => update({ type: value || null })}
              data={TYPES.map((value) => ({ value, label: t(`transactions.types.${value || 'all'}`) }))}
            />
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              onClick={() => {
                setSearch('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              {t('transactions.filters.reset')}
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 760 }}>
          {transactions.isLoading && <Skeleton height={240} m="md" />}
          {!transactions.isLoading && days.length === 0 && (
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
                  accountName={accountsById.get(transaction.accountId!)?.name}
                  toAccountName={
                    transaction.toAccountId ? accountsById.get(transaction.toAccountId)?.name : undefined
                  }
                  tags={(transaction.tagIds ?? []).map((id) => tagsById.get(id)).filter((tag) => !!tag)}
                  onOpen={() => update({ edit: String(transaction.id) })}
                  onCategorize={(categoryId) => recategorize.mutate({ transaction, categoryId })}
                />
              ))}
            </div>
          ))}
          {(transactions.data?.totalPages ?? 0) > 1 && (
            <Group
              justify="space-between"
              px="md"
              py="sm"
              style={{ borderTop: '1px solid var(--ww-border)' }}
            >
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

      {drawer && (drawer === 'new' || editing) && (
        <TransactionDrawer
          transaction={drawer === 'new' ? null : (editing ?? null)}
          defaultAccountId={number('accountId')}
          onClose={() => update({ new: null, edit: null })}
        />
      )}
    </Stack>
  );
}

interface RowProps {
  transaction: Transaction;
  category?: CategoryInfo;
  categories: CategoryInfo[];
  accountName?: string;
  toAccountName?: string;
  tags: { id?: number; name?: string; color?: string }[];
  onOpen(): void;
  onCategorize(categoryId: number): void;
}

function TransactionRow({
  transaction,
  category,
  categories,
  accountName,
  toAccountName,
  tags,
  onOpen,
  onCategorize,
}: RowProps) {
  const { t } = useTranslation();
  const transfer = transaction.type === 'TRANSFER';
  const uncategorized = isUncategorized(transaction);
  const amount = signedAmount(transaction);
  const title = transfer
    ? `${accountName ?? ''} → ${toAccountName ?? ''}`
    : (transaction.payee?.name ?? transaction.comment ?? t('transactions.noPayee'));
  const subtitle = transfer
    ? t('transactions.types.TRANSFER')
    : isSplit(transaction)
      ? t('transactions.split', {
          names: (transaction.splits ?? [])
            .map((split) => categories.find((item) => item.id === split.categoryId)?.name)
            .filter(Boolean)
            .join(', '),
        })
      : category?.path;

  return (
    <div
      className={classes.row}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen();
      }}
    >
      <CategoryIcon icon={category?.icon} color={category?.color} transfer={transfer} />
      <div style={{ minWidth: 0 }}>
        <Text fw={500} truncate>
          {title}
        </Text>
        {uncategorized ? (
          <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <Select
              size="xs"
              w={240}
              mt={2}
              searchable
              placeholder={t('transactions.chooseCategory')}
              aria-label={t('transactions.chooseCategory')}
              data={categorySelectData(categories, transaction.type === 'INCOME' ? 'INCOME' : 'EXPENSE')}
              onChange={(value) => value && onCategorize(Number(value))}
              styles={{ input: { borderColor: 'var(--ww-warn-border)', background: 'var(--ww-warn-bg)' } }}
            />
          </div>
        ) : (
          <Text size="xs" c="dimmed" truncate>
            {subtitle}
          </Text>
        )}
      </div>
      <Stack gap={2} align="flex-start">
        <Text size="sm" c="dimmed" truncate maw="100%">
          {transfer ? '' : accountName}
        </Text>
        {tags.length > 0 && (
          <Group gap={4}>
            {tags.map((tag) => (
              <Badge key={tag.id} size="xs" variant="light" color={mantineColor(tag.color as never)}>
                #{tag.name}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>
      <div style={{ textAlign: 'right' }}>
        <Text className={`num ${transfer ? 'muted' : amount < 0 ? 'expense' : 'income'}`} fw={500}>
          {formatMoney(amount, transaction.currency ?? 'UAH', { signed: !transfer })}
        </Text>
        {transaction.originalAmount && transaction.originalCurrency ? (
          <Text size="xs" c="dimmed" className="num">
            {formatMoney(transaction.originalAmount, transaction.originalCurrency)}
          </Text>
        ) : null}
      </div>
    </div>
  );
}
