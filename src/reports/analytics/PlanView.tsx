import {
  ActionIcon,
  Alert,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { ChevronDown, ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../../api/client';
import { Figure, ShareBar } from '../../components/Figure';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { formatMonthTitle, formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { kyivToday } from '../../lib/periods';
import dayjs from 'dayjs';
import { usePlan } from './api';
import classes from './analytics.module.css';
import { shiftMonth, todayShare } from './model';

type Row = Schemas['PlanRow'];

export function PlanView() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => kyivToday().format('YYYY-MM'));
  const [open, setOpen] = useState<Set<number>>(new Set());
  const plan = usePlan(month);

  const header = (
    <Group justify="space-between" wrap="wrap">
      <Stack gap={0}>
        <Title order={2} size="h4">
          {t('analytics.plan.title')}
        </Title>
        <Text size="sm" c="dimmed">
          {t('analytics.plan.subtitle')}
        </Text>
      </Stack>
      <Group gap={4}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t('analytics.previousMonth')}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft size={18} />
        </ActionIcon>
        <Text fw={500} miw={130} ta="center">
          {formatMonthTitle(dayjs(`${month}-01`))}
        </Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t('analytics.nextMonth')}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );

  if (plan.isLoading)
    return (
      <Stack gap="md">
        {header}
        <Skeleton height={360} radius="md" />
      </Stack>
    );
  if (!plan.data) return <QueryError error={plan.error} onRetry={() => void plan.refetch()} />;
  const data = plan.data;
  const currency = data.currency;
  const money = (value: number) => formatMoney(value, currency);
  const marker = todayShare(data);
  const over = data.forecast - data.planned;
  const current = marker != null;

  const toggle = (id: number) =>
    setOpen((value) => {
      const next = new Set(value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const row = (item: Row, child: boolean) => {
    const expandable = !child && item.children.length > 0;
    const expanded = open.has(item.categoryId);
    return (
      <Fragment key={item.categoryId}>
        <Table.Tr className={child ? classes.child : undefined}>
          <Table.Td>
            <Group gap={6} wrap="nowrap">
              {expandable ? (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  aria-label={t(expanded ? 'reports.collapse' : 'reports.expand', { name: item.name })}
                  onClick={() => toggle(item.categoryId)}
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </ActionIcon>
              ) : (
                !child && <span style={{ width: 22 }} />
              )}
              <Stack gap={0}>
                <Text size="sm" fw={child ? 400 : 500}>
                  {item.name}
                </Text>
                {item.plannedRemaining > 0 && (
                  <Text size="xs" c="dimmed">
                    {t('analytics.plan.plannedRemaining', { amount: money(item.plannedRemaining) })}
                  </Text>
                )}
              </Stack>
            </Group>
          </Table.Td>
          <Table.Td ta="right" className="num">
            {money(item.planned)}
          </Table.Td>
          <Table.Td ta="right" className="num">
            {money(item.actual)}
          </Table.Td>
          <Table.Td ta="right" className={`num ${item.difference < 0 ? 'expense' : ''}`}>
            {formatMoney(item.difference, currency, { signed: item.difference < 0 })}
          </Table.Td>
          <Table.Td w={200}>
            <Completion row={item} marker={marker} />
            <Group justify="space-between" mt={4} gap={4} wrap="nowrap">
              <Text size="xs" c="dimmed">
                {formatPercent(item.completion)}
              </Text>
              {current && (
                <Text size="xs" c={item.forecast > item.planned ? 'var(--ww-expense)' : 'dimmed'}>
                  {t('analytics.plan.forecastRow', { amount: money(item.forecast) })}
                </Text>
              )}
            </Group>
          </Table.Td>
        </Table.Tr>
        {expanded && item.children.map((sub) => row(sub, true))}
      </Fragment>
    );
  };

  return (
    <Stack gap="md">
      {header}
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Figure
          label={t('analytics.plan.planned')}
          value={money(data.planned)}
          note={t('analytics.plan.plannedNote')}
        />
        <Figure
          label={t('analytics.plan.actual')}
          value={money(data.actual)}
          note={
            data.planned > 0
              ? t('analytics.plan.actualNote', { percent: formatPercent(data.actual / data.planned) })
              : undefined
          }
        />
        {data.difference >= 0 ? (
          <Figure
            label={t('analytics.plan.left')}
            value={money(data.difference)}
            note={t('analytics.plan.leftNote')}
          />
        ) : (
          <Figure
            label={t('analytics.plan.overspent')}
            value={money(-data.difference)}
            className="expense"
            note={t('analytics.plan.overspentNote')}
          />
        )}
        <Figure
          label={t('analytics.plan.forecast')}
          value={money(data.forecast)}
          className={over > 0 ? 'expense' : undefined}
          note={
            over > 0
              ? t('analytics.plan.forecastOver', { amount: money(over) })
              : t('analytics.plan.forecastUnder', { amount: money(-over) })
          }
        />
      </SimpleGrid>
      {current && over > 0 && (
        <Alert color="yellow" variant="light" icon={<TriangleAlert size={18} />}>
          {t('analytics.plan.forecast')}: {t('analytics.plan.forecastOver', { amount: money(over) })}
        </Alert>
      )}
      {data.categories.length === 0 ? (
        <Card withBorder radius="md" py={48}>
          <Text ta="center" c="dimmed">
            {t('analytics.plan.empty')}
          </Text>
        </Card>
      ) : (
        <Card withBorder radius="md" p={0}>
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('analytics.plan.group')}</Table.Th>
                <Table.Th ta="right">{t('analytics.plan.planned')}</Table.Th>
                <Table.Th ta="right">{t('analytics.plan.actual')}</Table.Th>
                <Table.Th ta="right">{t('analytics.plan.difference')}</Table.Th>
                <Table.Th>{t('analytics.plan.completion')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.categories.map((item) => row(item, false))}
              <Table.Tr fw={600} bg="var(--ww-subtle)">
                <Table.Td>{t('analytics.plan.total')}</Table.Td>
                <Table.Td ta="right" className="num">
                  {money(data.planned)}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {money(data.actual)}
                </Table.Td>
                <Table.Td ta="right" className={`num ${data.difference < 0 ? 'expense' : ''}`}>
                  {formatMoney(data.difference, currency, { signed: data.difference < 0 })}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" className="num">
                    {formatPercent(data.planned > 0 ? data.actual / data.planned : null)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>
      )}
      <Text size="xs" c="dimmed">
        {current
          ? t('analytics.plan.note', { day: data.daysElapsed, days: data.daysInMonth })
          : data.daysElapsed >= data.daysInMonth
            ? t('analytics.plan.notePast')
            : null}
      </Text>
    </Stack>
  );
}

/** Spent part of the envelope; red when over the plan, amber when the forecast goes over it. */
function Completion({ row, marker }: { row: Row; marker: number | null }) {
  const share = row.planned > 0 ? row.actual / row.planned : row.actual > 0 ? 1 : 0;
  const color =
    row.actual > row.planned && row.planned >= 0
      ? 'var(--ww-expense)'
      : marker != null && row.forecast > row.planned
        ? 'var(--ww-warn-border)'
        : undefined;
  return <ShareBar share={share} color={color} marker={marker} height={8} />;
}
