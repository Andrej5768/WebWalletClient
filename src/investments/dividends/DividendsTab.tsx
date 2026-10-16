import { BarChart } from '@mantine/charts';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import dayjs from 'dayjs';
import { ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { useAccounts, useBaseCurrency } from '../../api/queries';
import { Figure, ShareBar } from '../../components/Figure';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { locale } from '../../i18n';
import { formatDayShort, formatMonthLong, formatMonthShort, formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { isoDate, kyivToday } from '../../lib/periods';
import { useDividends, type DividendEvent } from '../api';
import { MonthCalendar } from './MonthCalendar';
import { monthsFrom, ofMonth, receivedByMonth, STATUS_COLORS, STATUSES } from './model';
import { PaymentsList } from './PaymentsList';

/** Expected payments warned about above the calendar at most. */
const MAX_WARNINGS = 3;

/**
 * Dividends and coupons of the brokerage accounts: the income of the next 12 months, a month calendar or list, and
 * what was received over the last 12 months.
 */
export function DividendsTab({ accountId }: { accountId?: number }) {
  const { t } = useTranslation();
  const [, setParams] = useSearchParams();
  const baseCurrency = useBaseCurrency();
  const accounts = useAccounts();
  const today = useMemo(() => kyivToday(), []);
  const currentMonth = today.format('YYYY-MM');
  const [currency, setCurrency] = useState<string>('base');
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(currentMonth);

  // A year back for what was received, a year ahead for the calendar
  const from = today.startOf('month').subtract(12, 'month').format('YYYY-MM-DD');
  const to = today.endOf('month').add(12, 'month').format('YYYY-MM-DD');
  const calendar = useDividends({
    accountId,
    from,
    to,
    currency: currency === 'base' ? undefined : currency,
  });
  const accountNames = new Map((accounts.data ?? []).map((account) => [account.id, account.name]));

  if (calendar.isLoading) return <Skeleton height={480} radius="md" />;
  if (!calendar.data) return <QueryError error={calendar.error} onRetry={() => void calendar.refetch()} />;
  const data = calendar.data;
  const target = data.currency;
  const money = (value: number) => formatMoney(value, target);
  const events = data.events;

  if (events.length === 0) {
    return (
      <Text c="dimmed" py="xl">
        {t('invDividends.empty')}
      </Text>
    );
  }

  const label = (status: (typeof STATUSES)[number]) => t(`invDividends.status.${status}`);
  const chartData = monthsFrom(currentMonth, 13).map((key) => {
    const totals = data.months.find((item) => item.month === key);
    return {
      key,
      month: formatMonthShort(key),
      [label('RECEIVED')]: totals?.received ?? 0,
      [label('EXPECTED')]: totals?.expected ?? 0,
      [label('DECLARED')]: totals?.declared ?? 0,
      [label('FORECAST')]: totals?.forecast ?? 0,
    };
  });
  const past = monthsFrom(dayjs(`${currentMonth}-01`).subtract(11, 'month').format('YYYY-MM'), 12);
  const received = receivedByMonth(events, past);
  const maxPayer = Math.max(0, ...data.receivedByInstrument.map((item) => item.amount));
  const expected = events.filter((event) => event.status === 'EXPECTED').slice(-MAX_WARNINGS);
  const monthEvents = ofMonth(events, month);
  const monthTotal = monthEvents.reduce((sum, event) => sum + event.grossInTarget, 0);
  const minMonth = dayjs(from).format('YYYY-MM');
  const maxMonth = dayjs(to).format('YYYY-MM');
  const shift = (months: number) => setMonth(dayjs(`${month}-01`).add(months, 'month').format('YYYY-MM'));

  const addDividend = (event: DividendEvent) =>
    setParams(
      (params) => {
        const next = new URLSearchParams(params);
        next.set('operation', 'new');
        next.set('instrumentId', String(event.instrumentId));
        return next;
      },
      { replace: true },
    );

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" c="dimmed" maw={720}>
          {t('invDividends.sources')}
        </Text>
        {baseCurrency !== 'USD' && (
          <SegmentedControl
            size="xs"
            aria-label={t('invDividends.currency')}
            value={currency}
            onChange={setCurrency}
            data={[
              { value: 'base', label: symbolOf(baseCurrency) },
              { value: 'USD', label: symbolOf('USD') },
            ]}
          />
        )}
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="sm">
        <Figure
          label={t('invDividends.next12')}
          value={money(data.next12Months)}
          note={t('invDividends.next12Net', { amount: money(data.next12MonthsNet) })}
          className="income"
        />
        <Figure
          label={t('invDividends.monthly')}
          value={money(data.monthly)}
          note={t('invDividends.monthlyNote')}
        />
        <Figure
          label={t('invDividends.yield')}
          value={formatPercent(data.yield)}
          note={t('invDividends.yieldNote')}
        />
        <Figure
          label={t('invDividends.yieldOnCost')}
          value={formatPercent(data.yieldOnCost)}
          note={t('invDividends.yieldOnCostNote')}
        />
      </SimpleGrid>

      <Card withBorder radius="md" padding="lg">
        <Text fw={600}>{t('invDividends.chart')}</Text>
        <Text size="xs" c="dimmed" mb="sm">
          {t('invDividends.chartHint')}
        </Text>
        <BarChart
          h={240}
          data={chartData}
          dataKey="month"
          type="stacked"
          series={STATUSES.map((status) => ({ name: label(status), color: STATUS_COLORS[status] }))}
          withLegend
          valueFormatter={money}
          gridAxis="y"
          tickLine="none"
          barChartProps={{
            onClick: (state) => {
              const index = Number(state?.activeTooltipIndex);
              const key = Number.isInteger(index) ? chartData[index]?.key : undefined;
              if (key) setMonth(key);
            },
          }}
        />
      </Card>

      {expected.map((event) => (
        <Alert
          key={`${event.date}-${event.instrumentId}-${event.accountId}`}
          color="yellow"
          variant="light"
          icon={<CircleAlert size={18} />}
          title={t('invDividends.expected', { symbol: event.symbol, date: formatDayShort(event.date) })}
        >
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm">{t('invDividends.expectedHint')}</Text>
            <Button size="xs" variant="default" onClick={() => addDividend(event)}>
              {t('invDividends.addDividend')}
            </Button>
          </Group>
        </Alert>
      ))}

      <Card withBorder radius="md" padding={0}>
        <Group justify="space-between" p="md" wrap="wrap">
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('invDividends.prevMonth')}
              disabled={month <= minMonth}
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={18} />
            </ActionIcon>
            <Text fw={600} miw={150} ta="center" data-testid="calendar-month">
              {capitalize(formatMonthLong(dayjs(`${month}-01`)))}
            </Text>
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={t('invDividends.nextMonth')}
              disabled={month >= maxMonth}
              onClick={() => shift(1)}
            >
              <ChevronRight size={18} />
            </ActionIcon>
            <Badge
              variant="light"
              color={monthTotal > 0 ? 'green' : 'gray'}
              style={{ textTransform: 'none' }}
              title={t('invDividends.monthTotal')}
            >
              {formatMoney(monthTotal, target, { signed: monthTotal > 0 })}
            </Badge>
          </Group>
          <SegmentedControl
            size="xs"
            aria-label={t('invDividends.view')}
            value={view}
            onChange={(value) => setView(value as 'calendar' | 'list')}
            data={[
              { value: 'calendar', label: t('invDividends.calendar') },
              { value: 'list', label: t('invDividends.list') },
            ]}
          />
        </Group>
        {view === 'calendar' ? (
          <MonthCalendar month={month} events={monthEvents} currency={target} today={isoDate(today)} />
        ) : monthEvents.length === 0 ? (
          <Text c="dimmed" size="sm" px="md" pb="md">
            {t('invDividends.noPayments')}
          </Text>
        ) : (
          <PaymentsList events={monthEvents} currency={target} accountNames={accountNames} />
        )}
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="md" padding="lg">
          <Text fw={600}>{t('invDividends.received')}</Text>
          <Text size="xs" c="dimmed" mb="sm">
            {t('invDividends.receivedNet', { amount: money(data.received12Months) })}
          </Text>
          <BarChart
            h={200}
            data={received.map((item) => ({
              month: formatMonthShort(item.month),
              [label('RECEIVED')]: item.amount,
            }))}
            dataKey="month"
            series={[{ name: label('RECEIVED'), color: STATUS_COLORS.RECEIVED }]}
            valueFormatter={money}
            gridAxis="y"
            tickLine="none"
          />
        </Card>
        <Card withBorder radius="md" padding="lg">
          <Text fw={600} mb="sm">
            {t('invDividends.payers')}
          </Text>
          <Stack gap="sm">
            {data.receivedByInstrument.map((item) => (
              <div key={item.instrumentId} data-testid="payer">
                <Group justify="space-between" mb={4}>
                  <Text size="sm" fw={600} ff="monospace">
                    {item.symbol}
                  </Text>
                  <Text size="sm" className="num">
                    {money(item.amount)}
                  </Text>
                </Group>
                <ShareBar share={maxPayer ? item.amount / maxPayer : 0} color="var(--ww-income)" />
              </div>
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "₴", "$": the narrow symbol of a currency, else its code. */
function symbolOf(currency: string): string {
  const parts = new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}
