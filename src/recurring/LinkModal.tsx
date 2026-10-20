import { Checkbox, Loader, Modal, Radio, Stack, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
import dayjs from 'dayjs';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { check, unwrap } from '../api/http';
import { invalidateLedger, queryKeys } from '../api/queries';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { formatDayShort } from '../lib/format';
import { formatMoney } from '../lib/money';
import { requestOf, useCandidates, useRecurringPayments, type Occurrence } from './api';
import classes from './recurring.module.css';

type Transaction = Schemas['TransactionResponse'];

/** The search looks this many days around the date, further than the suggested candidates. */
const SEARCH_DAYS = 60;

/** Links an existing operation to a planned payment, e.g. one paid from another card. */
export function LinkModal({
  occurrence,
  accountsById,
  onClose,
}: {
  occurrence: Occurrence;
  accountsById: Map<number, Schemas['AccountResponse']>;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const candidates = useCandidates(occurrence);
  const recurring = useRecurringPayments();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [updateAmount, setUpdateAmount] = useState(false);

  const [query] = useDebouncedValue(search.trim(), 300);
  // A search goes through all operations of the type around the date, not only the near candidates
  const found = useQuery({
    queryKey: [...queryKeys.transactions, 'link-search', occurrence.recurringId, occurrence.date, query],
    queryFn: () =>
      unwrap(
        api.GET('/api/v1/transactions', {
          params: {
            query: {
              q: query,
              type: occurrence.type,
              from: dayjs(occurrence.date).subtract(SEARCH_DAYS, 'day').format('YYYY-MM-DD'),
              to: dayjs(occurrence.date).add(SEARCH_DAYS, 'day').format('YYYY-MM-DD'),
              size: 50,
            },
          },
        }),
      ),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
  const lower = query.toLowerCase();
  const near = (candidates.data ?? []).filter(
    (item) =>
      !lower ||
      [item.payee?.name, item.comment, String(item.amount)].some((text) =>
        text?.toLowerCase().includes(lower),
      ),
  );
  // The near candidates stay on top; operations that already pay a payment are left out
  const visible: Transaction[] = [
    ...near,
    ...(lower ? (found.data?.items ?? []) : []).filter(
      (item) => item.recurring == null && !near.some((candidate) => candidate.id === item.id),
    ),
  ];
  const chosen = visible.find((item) => String(item.id) === selected);
  const amountDiffers = chosen !== undefined && chosen.amount !== occurrence.amount;
  const series = recurring.data?.find((item) => item.id === occurrence.recurringId);

  const link = useMutation({
    mutationFn: async () => {
      await check(
        api.POST('/api/v1/recurring/{id}/occurrences/{date}/link', {
          params: { path: { id: occurrence.recurringId, date: occurrence.date } },
          body: { transactionId: Number(selected) },
        }),
      );
      if (updateAmount && amountDiffers && series) {
        await check(
          api.PUT('/api/v1/recurring/{id}', {
            params: { path: { id: series.id } },
            body: requestOf(series, { amount: chosen.amount }),
          }),
        );
      }
    },
    onSuccess: async () => {
      await invalidateLedger(queryClient);
      onClose();
    },
    meta: { errorShown: true },
  });

  const reason = (item: Transaction) => {
    const parts: string[] = [];
    parts.push(
      item.accountId === occurrence.accountId
        ? t('recurring.link.sameAccount')
        : t('recurring.link.otherAccount'),
    );
    const diff = item.amount - occurrence.amount;
    if (diff === 0) parts.push(t('recurring.link.sameAmount'));
    else
      parts.push(
        t(diff > 0 ? 'recurring.link.moreBy' : 'recurring.link.lessBy', {
          amount: formatMoney(Math.abs(diff), item.currency),
          share: Math.round((Math.abs(diff) / occurrence.amount) * 100),
        }),
      );
    const days = dayjs(item.date).diff(dayjs(occurrence.date), 'day');
    if (days !== 0)
      parts.push(t(days < 0 ? 'recurring.link.earlier' : 'recurring.link.later', { count: Math.abs(days) }));
    return parts.join(' · ');
  };

  return (
    <Modal opened onClose={onClose} size="lg" title={<Text fw={600}>{t('recurring.actions.link')}</Text>}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          link.mutate();
        }}
      >
        <Stack gap="md">
          <div className={classes.plannedBox}>
            <Text fw={500}>{occurrence.name}</Text>
            <Text size="sm" c="dimmed">
              {t('recurring.link.plannedOn', {
                date: formatDayShort(occurrence.date),
                account: accountsById.get(occurrence.accountId)?.name ?? '',
                amount: formatMoney(occurrence.amount, occurrence.currency),
              })}
            </Text>
          </div>
          <Text size="sm" c="dimmed">
            {t('recurring.link.hint')}
          </Text>
          <TextInput
            leftSection={<Search size={16} />}
            aria-label={t('transactions.search')}
            placeholder={t('transactions.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          {candidates.isLoading && <Loader size="sm" />}
          {candidates.isSuccess && visible.length === 0 && (
            <Text size="sm" c="dimmed">
              {t('recurring.link.none')}
            </Text>
          )}
          <Radio.Group value={selected} onChange={setSelected} aria-label={t('recurring.link.candidates')}>
            <Stack gap="xs">
              {visible.map((item) => (
                <Radio.Card
                  key={item.id}
                  value={String(item.id)}
                  className={classes.candidate}
                  data-checked={String(item.id) === selected || undefined}
                >
                  <Radio.Indicator />
                  <div style={{ minWidth: 0 }}>
                    <Text fw={500} truncate>
                      {item.payee?.name ?? item.comment ?? t('transactions.noPayee')}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {formatDayShort(item.date)} · {accountsById.get(item.accountId)?.name} · {reason(item)}
                    </Text>
                  </div>
                  <Text className="num" fw={500}>
                    {formatMoney(item.amount, item.currency)}
                  </Text>
                </Radio.Card>
              ))}
            </Stack>
          </Radio.Group>
          {amountDiffers && series && (
            <Checkbox
              label={t('recurring.link.updateAmount', {
                amount: formatMoney(chosen.amount, chosen.currency),
              })}
              checked={updateAmount}
              onChange={(event) => setUpdateAmount(event.currentTarget.checked)}
            />
          )}
          <ProblemAlert error={link.error} />
          <FormFooter
            onCancel={onClose}
            saving={link.isPending}
            submitDisabled={!selected}
            submitLabel={t('recurring.link.submit')}
          />
        </Stack>
      </form>
    </Modal>
  );
}
