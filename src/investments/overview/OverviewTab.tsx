import { CompositeChart, DonutChart } from '@mantine/charts';
import {
  Alert,
  Card,
  Chip,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Info } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Figure } from '../../components/Figure';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { formatDayShort, formatMonthShort, formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { moneyAxis } from '../../components/chartAxis';
import { kyivToday } from '../../lib/periods';
import { useHistory, usePortfolio, type Benchmark, type Portfolio } from '../api';
import { CurrencySwitch } from '../CurrencySwitch';
import { useDisplayCurrency } from '../useDisplayCurrency';
import { fromFirstMoney, RANGES, rangeFrom, result, type Range, type Result } from './model';
import classes from './overview.module.css';

// Provided by the dividends part: the next payments with a link to the calendar.
const UpcomingPayments = lazy(() =>
  import('../dividends/UpcomingPayments').then((m) => ({ default: m.UpcomingPayments })),
);

const BENCHMARKS: Benchmark[] = ['SP500', 'MSCI_WORLD', 'NASDAQ100'];

/** Colors of the allocation parts; the donut and its legend use the same order. */
const PART_COLORS = ['cobalt.6', 'teal.6', 'orange.5', 'violet.5', 'pink.5', 'lime.6', 'gray.5', 'cyan.6'];

/** The overview of the portfolio: key figures, the value over time with a benchmark, the allocation. */
export function OverviewTab({ accountId }: { accountId?: number }) {
  const { t } = useTranslation();
  const display = useDisplayCurrency();
  const portfolio = usePortfolio(accountId, display.requested);
  if (portfolio.isLoading) return <Skeleton height={420} radius="md" />;
  if (!portfolio.data) return <QueryError error={portfolio.error} onRetry={() => void portfolio.refetch()} />;
  const data = portfolio.data;
  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <Figures data={data} />
      <Group justify="space-between" wrap="wrap">
        <Text size="xs" c="dimmed">
          {data.pricesAsOf && t('investments.pricesAsOf', { date: formatDayShort(data.pricesAsOf) })}
        </Text>
        {/* The figures, the chart and the allocation follow it */}
        <CurrencySwitch label={t('invOverview.currency')} />
      </Group>
      <ValueChart accountId={accountId} />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Allocation
          title={t('invOverview.allocation.byType')}
          parts={data.byType}
          currency={data.currency}
          typed
        />
        <Allocation
          title={t('invOverview.allocation.byCurrency')}
          parts={data.byCurrency}
          currency={data.currency}
        />
        <Suspense fallback={<Skeleton height={240} radius="md" />}>
          <UpcomingPayments accountId={accountId} />
        </Suspense>
      </SimpleGrid>
    </Stack>
  );
}

function Figures({ data }: { data: Portfolio }) {
  const { t } = useTranslation();
  const money = (value: number, signed = false) => formatMoney(value, data.currency, { signed });
  const sign = (value: number) => (value < 0 ? 'expense' : value > 0 ? 'income' : '');
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }} spacing="sm">
      <Figure
        label={t('invOverview.value')}
        value={money(data.value)}
        note={
          // Without two market closes there is no change of the day to speak of
          data.positions.some((position) => position.dayChange != null)
            ? t('invOverview.dayChange', { amount: money(data.dayChange, true) })
            : undefined
        }
      />
      {/* What was brought minus what was taken out, so that value minus it is the whole result */}
      <Figure
        label={t('invOverview.invested')}
        value={money(data.deposited)}
        note={t('invOverview.investedNote', { result: money(data.value - data.deposited, true) })}
      />
      <Figure
        label={t('invOverview.unrealized')}
        value={money(data.unrealized, true)}
        className={sign(data.unrealized)}
        note={t('invOverview.unrealizedNote', {
          share: data.unrealizedShare != null ? formatSigned(data.unrealizedShare) : '—',
          cost: money(data.invested),
        })}
      />
      <Figure
        label={t('invOverview.realized', { year: kyivToday().year() })}
        value={money(data.realizedThisYear, true)}
        className={sign(data.realizedThisYear)}
        note={t('invOverview.realizedNote')}
      />
      <Figure
        label={t('invOverview.dividends')}
        value={money(data.dividendsLast12Months)}
        note={t('invOverview.dividendsNote')}
      />
    </SimpleGrid>
  );
}

/** "+29,5%" with the sign. */
function formatSigned(share: number): string {
  const text = formatPercent(share);
  return share > 0 ? `+${text}` : text;
}

interface Row {
  label: string;
  date: string;
  value: number;
  deposited: number;
  benchmark: number | null;
}

function ValueChart({ accountId }: { accountId?: number }) {
  const { t } = useTranslation();
  const display = useDisplayCurrency();
  const currency = display.currency;
  const [range, setRange] = useState<Range>('1y');
  const [benchmark, setBenchmark] = useState<Benchmark | 'none'>('none');
  const today = useMemo(() => kyivToday(), []);
  const history = useHistory({
    accountId,
    from: rangeFrom(range, today),
    currency: display.requested,
    benchmark: benchmark === 'none' ? undefined : benchmark,
  });
  const data = history.data;
  const shownCurrency = data?.currency ?? currency;
  const benchmarkName = benchmark === 'none' ? '' : t(`invOverview.chart.benchmarks.${benchmark}`);
  const money = (value: number, signed = false) => formatMoney(value, shownCurrency, { signed });
  // A history shorter than the range starts at the first money on the accounts, not with empty months
  const points = fromFirstMoney(data?.points ?? []);
  const long = points.length > 1 && points[0]!.date < today.subtract(13, 'month').format('YYYY-MM-DD');
  const rows: Row[] = points.map((point) => ({
    label: long ? formatMonthShort(point.date.slice(0, 7)) : formatDayShort(point.date),
    date: point.date,
    value: point.value,
    deposited: point.deposited,
    benchmark: point.benchmark,
  }));
  const valueName = t('invOverview.chart.value');
  const depositedName = t('invOverview.chart.deposited');
  const benchmarkLine = t('invOverview.chart.benchmark', { name: benchmarkName });
  const withBenchmark = benchmark !== 'none' && points.some((point) => point.benchmark != null);
  // Compared over the same days: from the first one the index has a price on
  const compared = withBenchmark
    ? points.slice(points.findIndex((point) => point.benchmark != null))
    : points;
  const portfolioResult = result(compared, (point) => point.value);
  const benchmarkResult = withBenchmark ? result(compared, (point) => point.benchmark) : null;

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Title order={3} size="h5">
            {t('invOverview.chart.title')}
          </Title>
          <Group gap="xs" wrap="wrap">
            <SegmentedControl
              size="xs"
              aria-label={t('invOverview.chart.range')}
              value={range}
              onChange={(value) => setRange(value as Range)}
              data={RANGES.map((value) => ({ value, label: t(`invOverview.chart.ranges.${value}`) }))}
            />
          </Group>
        </Group>
        <Group gap="xs">
          <Text size="sm" c="dimmed">
            {t('invOverview.chart.compareWith')}
          </Text>
          <Chip.Group value={benchmark} onChange={(value) => setBenchmark(value as Benchmark | 'none')}>
            <Group gap={6}>
              {(['none', ...BENCHMARKS] as const).map((value) => (
                <Chip key={value} value={value} size="xs" type="radio">
                  {t(`invOverview.chart.benchmarks.${value}`)}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>
        {benchmark !== 'none' && data && data.benchmark?.pricesFrom == null && (
          <Alert color="blue" variant="light" p="xs" icon={<Info size={16} />}>
            <Text size="sm">{t('invOverview.chart.loading')}</Text>
          </Alert>
        )}
        {history.isLoading ? (
          <Skeleton height={300} />
        ) : !data ? (
          <QueryError error={history.error} onRetry={() => void history.refetch()} />
        ) : rows.length < 2 ? (
          <Text size="sm" c="dimmed" py="xl" ta="center">
            {t('invOverview.chart.empty')}
          </Text>
        ) : (
          <CompositeChart
            h={300}
            data={rows.map((row) => ({
              label: row.label,
              [valueName]: row.value,
              [depositedName]: row.deposited,
              ...(withBenchmark ? { [benchmarkLine]: row.benchmark } : {}),
            }))}
            dataKey="label"
            series={[
              { name: valueName, color: 'cobalt.6', type: 'area' },
              { name: depositedName, color: 'gray.5', type: 'line', strokeDasharray: '2 3' },
              ...(withBenchmark
                ? [{ name: benchmarkLine, color: 'orange.5', type: 'line' as const, strokeDasharray: '6 4' }]
                : []),
            ]}
            withLegend
            withDots={false}
            curveType="linear"
            connectNulls={false}
            valueFormatter={(value) => money(value)}
            yAxisProps={moneyAxis}
            gridAxis="y"
            tickLine="none"
            tooltipProps={{
              content: ({ active, label }) => {
                const row = active ? rows.find((item) => item.label === label) : undefined;
                if (!row) return null;
                return (
                  <HistoryTooltip
                    row={row}
                    money={money}
                    labels={{ value: valueName, deposited: depositedName, benchmark: benchmarkLine }}
                    benchmarkName={withBenchmark ? benchmarkName : null}
                  />
                );
              },
            }}
          />
        )}
        {portfolioResult && (
          <Summary
            portfolio={portfolioResult}
            benchmark={benchmarkResult}
            benchmarkName={benchmarkName}
            money={money}
          />
        )}
        {withBenchmark && (
          <Text size="xs" c="dimmed">
            {t('invOverview.chart.note')}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function HistoryTooltip({
  row,
  money,
  labels,
  benchmarkName,
}: {
  row: Row;
  money(value: number, signed?: boolean): string;
  labels: { value: string; deposited: string; benchmark: string };
  benchmarkName: string | null;
}) {
  const { t } = useTranslation();
  return (
    <Paper withBorder shadow="md" radius="md" p="sm" className={classes.tooltip}>
      <Text size="xs" fw={600} mb={4}>
        {formatDayShort(row.date)} {row.date.slice(0, 4)}
      </Text>
      <TooltipLine label={labels.value} value={money(row.value)} />
      <TooltipLine label={labels.deposited} value={money(row.deposited)} />
      {benchmarkName && row.benchmark != null && (
        <>
          <TooltipLine label={labels.benchmark} value={money(row.benchmark)} />
          <Text size="xs" className={`num ${row.value >= row.benchmark ? 'income' : 'expense'}`} fw={500}>
            {t('invOverview.chart.difference', {
              amount: money(row.value - row.benchmark, true),
              name: benchmarkName,
            })}
          </Text>
        </>
      )}
    </Paper>
  );
}

function TooltipLine({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="md" wrap="nowrap">
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="xs" className="num" fw={500}>
        {value}
      </Text>
    </Group>
  );
}

function Summary({
  portfolio,
  benchmark,
  benchmarkName,
  money,
}: {
  portfolio: Result;
  benchmark: Result | null;
  benchmarkName: string;
  money(value: number, signed?: boolean): string;
}) {
  const { t } = useTranslation();
  const item = (label: string, value: Result) => (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} className={`num ${value.profit < 0 ? 'expense' : 'income'}`}>
        {money(value.profit, true)}
        {value.share != null && ` · ${formatSigned(value.share)}`}
      </Text>
    </Stack>
  );
  return (
    <Group gap="xl" wrap="wrap" data-testid="history-summary">
      {item(t('invOverview.chart.portfolio'), portfolio)}
      {benchmark && item(t('invOverview.chart.sameDeposits', { name: benchmarkName }), benchmark)}
      {benchmark &&
        item(t('invOverview.chart.differenceLabel'), {
          profit: portfolio.profit - benchmark.profit,
          share:
            portfolio.share != null && benchmark.share != null ? portfolio.share - benchmark.share : null,
        })}
    </Group>
  );
}

function Allocation({
  title,
  parts,
  currency,
  typed,
}: {
  title: string;
  parts: Portfolio['byType'];
  currency: string;
  typed?: boolean;
}) {
  const { t } = useTranslation();
  const label = (key: string) => (typed ? t(`investments.types.${key}`, { defaultValue: key }) : key);
  const data = parts.map((part, index) => ({
    name: label(part.key),
    value: part.value,
    color: PART_COLORS[index % PART_COLORS.length]!,
  }));
  return (
    <Card withBorder radius="md" padding="lg">
      <Title order={3} size="h5" mb="sm">
        {title}
      </Title>
      {parts.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t('invOverview.allocation.empty')}
        </Text>
      ) : (
        <Stack gap="sm" align="center">
          <DonutChart
            data={data}
            size={160}
            thickness={22}
            withTooltip
            tooltipDataSource="segment"
            valueFormatter={(value) => formatMoney(value, currency)}
            aria-label={title}
          />
          <Stack gap={4} w="100%">
            {parts.map((part, index) => (
              <Group key={part.key} justify="space-between" wrap="nowrap" gap="xs">
                <Group gap={6} wrap="nowrap">
                  <span
                    className={classes.swatch}
                    style={{ background: `var(--mantine-color-${data[index]!.color.replace('.', '-')})` }}
                  />
                  <Text size="sm">{label(part.key)}</Text>
                </Group>
                <Text size="sm" className="num">
                  {formatPercent(part.share)}
                </Text>
              </Group>
            ))}
          </Stack>
        </Stack>
      )}
    </Card>
  );
}
