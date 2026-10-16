import {
  Badge,
  Button,
  Card,
  CloseButton,
  Collapse,
  Group,
  Kbd,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue, useHotkeys, useOs } from '@mantine/hooks';
import { ListFilter, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts, useCategories, usePayees, useTags } from '../api/queries';
import { categorySelectData } from '../lib/categories';
import { formatDate } from '../lib/format';
import type { Preset } from '../lib/periods';
import type { TransactionFilters } from './useTransactionFilters';

const PRESETS: Preset[] = ['month', 'prevMonth', 'quarter', 'year', 'twelveMonths', 'all', 'custom'];
const TYPES = ['', 'EXPENSE', 'INCOME', 'TRANSFER'] as const;

const FILTER_KEYS = ['accountId', 'categoryId', 'payeeId', 'tagId', 'type'];

/** Period presets, search (hidden until asked for) and filters (folded away until asked for). */
export function TransactionFiltersBar({ filters }: { filters: TransactionFilters }) {
  const { t } = useTranslation();
  const { params, preset, period, update } = filters;
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const tags = useTags();
  const os = useOs();

  const urlSearch = params.get('q') ?? '';
  const [searchOpen, setSearchOpen] = useState(!!urlSearch);
  const [search, setSearch] = useState(urlSearch);
  const [debounced] = useDebouncedValue(search.trim(), 300);
  useHotkeys([['mod+K', () => setSearchOpen(true)]]);
  const activeFilters = FILTER_KEYS.filter((key) => params.get(key)).length;
  const [filtersOpen, setFiltersOpen] = useState(activeFilters > 0);

  // The debounced text goes to the URL, which also brings the feed back to the first page.
  useEffect(() => {
    if (debounced !== urlSearch.trim()) update({ q: debounced || null });
  }, [debounced, urlSearch, update]);

  const closeSearch = () => {
    setSearch('');
    setSearchOpen(false);
    update({ q: null });
  };

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            aria-label={t('transactions.period')}
            value={preset}
            onChange={(value) => update({ period: value === 'month' ? null : value })}
            data={PRESETS.map((value) => ({ value, label: t(`transactions.presets.${value}`) }))}
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
                ? `${formatDate(period.from)} – ${formatDate(period.to)}`
                : t('transactions.allTime')}
            </Text>
          )}
          <Group gap="sm" ml="auto">
            <Button
              variant={filtersOpen ? 'light' : 'default'}
              size="sm"
              leftSection={<ListFilter size={16} />}
              rightSection={
                activeFilters > 0 ? (
                  <Badge size="xs" circle>
                    {activeFilters}
                  </Badge>
                ) : undefined
              }
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              {t('transactions.filters.toggle')}
            </Button>
            {searchOpen ? (
              <TextInput
                autoFocus
                w={300}
                aria-label={t('transactions.search')}
                placeholder={t('transactions.searchPlaceholder')}
                leftSection={<Search size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') closeSearch();
                }}
                rightSection={
                  <CloseButton size="sm" aria-label={t('transactions.closeSearch')} onClick={closeSearch} />
                }
              />
            ) : (
              <Button
                variant="default"
                size="sm"
                leftSection={<Search size={16} />}
                rightSection={<Kbd size="xs">{os === 'macos' ? '⌘ K' : 'Ctrl K'}</Kbd>}
                onClick={() => setSearchOpen(true)}
              >
                {t('transactions.search')}
              </Button>
            )}
          </Group>
        </Group>
        <Collapse expanded={filtersOpen}>
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
                .map((account) => ({ value: String(account.id), label: account.name }))}
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
              data={(payees.data ?? []).map((payee) => ({ value: String(payee.id), label: payee.name }))}
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
                filters.reset();
              }}
            >
              {t('transactions.filters.reset')}
            </Button>
          </Group>
        </Collapse>
      </Stack>
    </Card>
  );
}
