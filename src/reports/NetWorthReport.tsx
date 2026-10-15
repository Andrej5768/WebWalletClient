import { AreaChart } from '@mantine/charts';
import { Card, SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { formatMonthShort } from '../lib/format';
import { formatMoney } from '../lib/money';
import type { Period } from '../lib/periods';
import { useNetWorth } from './api';
import { Figure } from '../components/Figure';
import { QueryError, UnconvertedAlert } from '../components/feedback';

export function NetWorthReport({ period }: { period: Period }) {
  const { t } = useTranslation();
  const report = useNetWorth(period);
  if (report.isLoading) return <Skeleton height={360} radius="md" />;
  if (!report.data) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const currency = data?.currency ?? 'UAH';
  const months = data?.months ?? [];
  const first = months[0];
  const last = months.at(-1);
  const change = (pick: (month: NonNullable<typeof last>) => number | undefined) =>
    last && first
      ? t('reports.change', {
          amount: formatMoney((pick(last) ?? 0) - (pick(first) ?? 0), currency, { signed: true }),
        })
      : undefined;

  const chart = months.map((month) => ({
    month: formatMonthShort(month.month),
    [t('reports.netWorth')]: month.netWorth ?? 0,
    [t('reports.assets')]: month.assets ?? 0,
    [t('reports.debts')]: month.liabilities ?? 0,
  }));

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data?.unconvertedCurrencies} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Figure
          label={t('reports.assets')}
          value={formatMoney(last?.assets ?? 0, currency)}
          note={change((month) => month.assets)}
        />
        <Figure
          label={t('reports.debts')}
          value={formatMoney(last?.liabilities ?? 0, currency)}
          note={change((month) => month.liabilities)}
          className="expense"
        />
        <Figure
          label={t('reports.netWorth')}
          value={formatMoney(last?.netWorth ?? 0, currency)}
          note={change((month) => month.netWorth)}
        />
      </SimpleGrid>
      <Card withBorder radius="md" padding="lg">
        <AreaChart
          h={300}
          data={chart}
          dataKey="month"
          series={[
            { name: t('reports.netWorth'), color: 'cobalt.6' },
            { name: t('reports.assets'), color: 'green.6', strokeDasharray: '5 5' },
            { name: t('reports.debts'), color: 'red.6', strokeDasharray: '5 5' },
          ]}
          withLegend
          withGradient
          fillOpacity={0.15}
          curveType="monotone"
          valueFormatter={(value) => formatMoney(value, currency)}
          gridAxis="y"
          tickLine="none"
        />
      </Card>
    </Stack>
  );
}
