import { ActionIcon, Anchor, Badge, Group, Menu, Text, UnstyledButton } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ChevronDown, ChevronUp, EllipsisVertical } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type Schemas } from '../api/client';
import { check } from '../api/http';
import { invalidateLedger } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { locale } from '../i18n';
import type { CategoryInfo } from '../lib/categories';
import { formatDayShort } from '../lib/format';
import { formatMoney } from '../lib/money';
import { isoDate, kyivToday } from '../lib/periods';
import type { Occurrence } from './api';
import classes from './recurring.module.css';

/** Upcoming payments shown when the group is collapsed, besides the overdue ones. */
const NEAREST = 2;

interface Props {
  occurrences: Occurrence[];
  accountsById: Map<number, Schemas['AccountResponse']>;
  categoriesById: Map<number, CategoryInfo>;
  onConfirm(occurrence: Occurrence): void;
  onLink(occurrence: Occurrence): void;
  onEditSeries(recurringId: number): void;
}

/**
 * Pending payments above today's operations, newest on top like the feed. Collapsed it shows the
 * overdue ones and the nearest upcoming ones; expanded everything up to a month ahead.
 */
export function PlannedGroup({ occurrences, accountsById, categoriesById, ...actions }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (occurrences.length === 0) return null;

  const today = isoDate(kyivToday());
  const upcoming = occurrences.filter((item) => !item.overdue);
  const shown = expanded
    ? occurrences
    : [...upcoming.slice(0, NEAREST), ...occurrences.filter((item) => item.overdue)];
  const hidden = occurrences.length - shown.length;
  const last = occurrences[occurrences.length - 1]!.date;
  const sorted = [...shown].sort((a, b) => b.date.localeCompare(a.date));

  const totals = (sign: 1 | -1) => {
    const byCurrency = new Map<string, number>();
    for (const item of occurrences) {
      const signed = item.type === 'INCOME' ? item.amount : item.type === 'EXPENSE' ? -item.amount : 0;
      if (Math.sign(signed) === sign)
        byCurrency.set(item.currency, (byCurrency.get(item.currency) ?? 0) + signed);
    }
    return [...byCurrency].map(([currency, amount]) => formatMoney(amount, currency, { signed: true }));
  };

  return (
    <div>
      <div className={classes.header}>
        <span>{t('recurring.planned.title', { date: formatDayShort(last), count: occurrences.length })}</span>
        <span className="num muted">{[...totals(1), ...totals(-1)].join(' · ')}</span>
      </div>
      {hidden > 0 && (
        <UnstyledButton className={classes.more} onClick={() => setExpanded(true)}>
          <ChevronUp size={14} />
          {t('recurring.planned.more', { count: hidden, date: formatDayShort(last) })}
        </UnstyledButton>
      )}
      {sorted.map((occurrence) => (
        <OccurrenceRow
          key={`${occurrence.recurringId}-${occurrence.date}`}
          occurrence={occurrence}
          today={today}
          accountName={accountsById.get(occurrence.accountId)?.name}
          toAccountName={occurrence.toAccountId ? accountsById.get(occurrence.toAccountId)?.name : undefined}
          category={occurrence.categoryId ? categoriesById.get(occurrence.categoryId) : undefined}
          {...actions}
        />
      ))}
      {expanded && occurrences.length > NEAREST && (
        <UnstyledButton className={classes.more} onClick={() => setExpanded(false)}>
          <ChevronDown size={14} />
          {t('recurring.planned.less')}
        </UnstyledButton>
      )}
    </div>
  );
}

function OccurrenceRow({
  occurrence,
  today,
  accountName,
  toAccountName,
  category,
  onConfirm,
  onLink,
  onEditSeries,
}: {
  occurrence: Occurrence;
  today: string;
  accountName?: string;
  toAccountName?: string;
  category?: CategoryInfo;
} & Omit<Props, 'occurrences' | 'accountsById' | 'categoriesById'>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const skip = useMutation({
    mutationFn: () =>
      check(
        api.POST('/api/v1/recurring/{id}/occurrences/{date}/skip', {
          params: { path: { id: occurrence.recurringId, date: occurrence.date } },
        }),
      ),
    onSettled: () => invalidateLedger(queryClient),
  });

  const transfer = occurrence.type === 'TRANSFER';
  const days = dayjs(occurrence.date).diff(dayjs(today), 'day');
  const weekday = dayjs(occurrence.date).toDate().toLocaleDateString(locale(), { weekday: 'short' });
  const when =
    days === 0
      ? t('recurring.planned.today')
      : days > 0
        ? t('recurring.planned.inDays', { count: days })
        : t('recurring.planned.daysAgo', { count: -days });
  const subtitle = [
    `${formatDayShort(occurrence.date)}, ${weekday} · ${when}`,
    transfer ? `${accountName ?? ''} → ${toAccountName ?? ''}` : category?.path,
  ]
    .filter(Boolean)
    .join(' · ');
  const signed = occurrence.type === 'EXPENSE' ? -occurrence.amount : occurrence.amount;

  return (
    <div className={`${classes.row} ${occurrence.overdue ? classes.overdue : ''}`}>
      <span className={classes.planned}>
        <CategoryIcon icon={category?.icon} color={category?.color} transfer={transfer} />
      </span>
      <div style={{ minWidth: 0 }}>
        <Text fw={500} truncate>
          {occurrence.name}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {subtitle}
        </Text>
      </div>
      <Group gap={6} wrap="wrap">
        {!transfer && (
          <Text size="sm" c="dimmed" truncate maw="100%">
            {accountName}
          </Text>
        )}
        {occurrence.overdue ? (
          <>
            <Badge size="xs" variant="light" color="yellow" style={{ textTransform: 'none' }}>
              {t('recurring.planned.notFound')}
            </Badge>
            <Anchor component="button" type="button" size="xs" onClick={() => onConfirm(occurrence)}>
              {t('recurring.actions.confirm')}
            </Anchor>
          </>
        ) : (
          occurrence.autoCreate && (
            <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
              {t('recurring.planned.auto')}
            </Badge>
          )
        )}
      </Group>
      <Group gap={4} justify="flex-end" wrap="nowrap">
        <Text
          component="span"
          fw={500}
          className={`num ${transfer ? 'muted' : signed < 0 ? 'expense' : 'income'}`}
        >
          {occurrence.variableAmount && '≈ '}
          {formatMoney(signed, occurrence.currency, { signed: !transfer })}
        </Text>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('recurring.actions.label', { name: occurrence.name })}
            >
              <EllipsisVertical size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => onConfirm(occurrence)}>{t('recurring.actions.confirm')}</Menu.Item>
            <Menu.Item onClick={() => onLink(occurrence)}>{t('recurring.actions.link')}</Menu.Item>
            <Menu.Item onClick={() => skip.mutate()}>{t('recurring.actions.skip')}</Menu.Item>
            <Menu.Divider />
            <Menu.Item onClick={() => onEditSeries(occurrence.recurringId)}>
              {t('recurring.actions.editSeries')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </div>
  );
}
