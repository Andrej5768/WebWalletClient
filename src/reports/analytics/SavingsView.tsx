import { CompositeChart, LineChart } from '@mantine/charts';
import { Card, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../../api/client';
import { Figure } from '../../components/Figure';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { formatMonthShort, formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { useNeedsWants, useSavings } from './api';
import classes from './analytics.module.css';
import { lastCompleteMonth, monthPeriod } from './model';

export function SavingsView() {
  const { t } = useTranslation();
  const savings = useSavings();
  const last = savings.data ? lastCompleteMonth(savings.data.months) : undefined;
  const needsWants = useNeedsWants(last ? monthPeriod(last.month) : {}, !!last);

  if (savings.isLoading) return <Skeleton height={420} radius="md" />;
  if (!savings.data) return <QueryError error={savings.error} onRetry={() => void savings.refetch()} />;
  const data = savings.data;
  const currency = data.currency;
  const money = (value: number) => formatMoney(value, currency);
  const target = formatPercent(data.target);
  const saved = t('analytics.savings.saved');
  const cumulative = t('analytics.savings.cumulative');
  const rate = t('analytics.savings.rate');
  const best = data.months.find((month) => month.month === data.bestMonth);

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Figure
          label={rate}
          value={formatPercent(data.averageRate)}
          className={data.averageRate != null && data.averageRate < data.target ? 'expense' : 'income'}
          note={t('analytics.savings.rateNote', { target })}
        />
        <Figure
          label={t('analytics.savings.total')}
          value={formatMoney(data.totalSaved, currency, { signed: true })}
          note={t('analytics.savings.totalNote', { count: data.months.length })}
        />
        <Figure
          label={t('analytics.savings.best')}
          value={best ? money(best.net) : '—'}
          note={best ? formatMonthShort(best.month) : undefined}
        />
      </SimpleGrid>
      <Card withBorder radius="md" padding="lg">
        <Text fw={500}>{t('analytics.savings.chart')}</Text>
        <Text size="xs" c="dimmed" mb="sm">
          {t('analytics.savings.chartHint')}
        </Text>
        <CompositeChart
          h={260}
          data={data.months.map((month) => ({
            month: formatMonthShort(month.month),
            [saved]: month.net,
            [cumulative]: month.cumulative,
          }))}
          dataKey="month"
          series={[
            { name: saved, color: 'green.5', type: 'bar' },
            { name: cumulative, color: 'blue.7', type: 'line' },
          ]}
          withLegend
          referenceLines={[{ y: 0, color: 'gray.5' }]}
          valueFormatter={(value) => money(value)}
          gridAxis="y"
          tickLine="none"
        />
      </Card>
      <Card withBorder radius="md" padding="lg">
        <Text fw={500} mb="sm">
          {t('analytics.savings.rateChart')}
        </Text>
        <LineChart
          h={180}
          data={data.months.map((month) => ({
            month: formatMonthShort(month.month),
            [rate]: month.savingsRate != null ? Math.round(month.savingsRate * 1000) / 10 : null,
          }))}
          dataKey="month"
          series={[{ name: rate, color: 'teal.6' }]}
          referenceLines={[
            { y: data.target * 100, color: 'gray.6', label: t('analytics.savings.target', { target }) },
          ]}
          valueFormatter={(value) => `${value}%`}
          unit="%"
          connectNulls={false}
          gridAxis="y"
          tickLine="none"
        />
      </Card>
      {last && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <RuleCard month={last.month} data={needsWants.data} loading={needsWants.isLoading} />
          <DestinationsCard month={last} currency={currency} />
        </SimpleGrid>
      )}
    </Stack>
  );
}

const PART_COLORS = {
  needs: 'var(--mantine-color-blue-6)',
  wants: 'var(--mantine-color-orange-5)',
  savings: 'var(--mantine-color-green-6)',
  unclassified: 'var(--mantine-color-gray-4)',
} as const;

function RuleCard({
  month,
  data,
  loading,
}: {
  month: string;
  data?: Schemas['NeedsWantsResponse'];
  loading: boolean;
}) {
  const { t } = useTranslation();
  const parts = (['needs', 'wants', 'savings', 'unclassified'] as const).map((key) => ({
    key,
    label: t(key === 'savings' ? 'analytics.savings.savingsPart' : `analytics.savings.${key}`),
    part: data?.[key],
  }));
  return (
    <Card withBorder radius="md" padding="lg">
      <Title order={3} size="h5">
        {t('analytics.savings.rule', { month: formatMonthShort(month) })}
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        {t('analytics.savings.ruleHint')}
      </Text>
      {loading || !data ? (
        <Skeleton height={120} />
      ) : data.income <= 0 ? (
        <Text size="sm" c="dimmed">
          {t('analytics.savings.noIncome')}
        </Text>
      ) : (
        <Stack gap="sm">
          <Text size="xs" c="dimmed">
            {t('analytics.savings.actual')}
          </Text>
          <div className={classes.stack} aria-hidden>
            {parts.map(({ key, part }) => (
              <span
                key={key}
                style={{ width: `${Math.max(0, part?.share ?? 0) * 100}%`, background: PART_COLORS[key] }}
              />
            ))}
          </div>
          <Text size="xs" c="dimmed">
            {t('analytics.savings.goal')}
          </Text>
          <div className={`${classes.stack} ${classes.stackThin}`} aria-hidden>
            {parts
              .filter(({ part }) => part?.target != null)
              .map(({ key, part }) => (
                <span
                  key={key}
                  style={{ width: `${(part?.target ?? 0) * 100}%`, background: PART_COLORS[key] }}
                />
              ))}
          </div>
          {parts
            .filter(({ key, part }) => key !== 'unclassified' || (part?.amount ?? 0) !== 0)
            .map(({ key, label, part }) => (
              <Group key={key} justify="space-between" wrap="nowrap">
                <Group gap={8} wrap="nowrap">
                  <span className={classes.swatch} style={{ background: PART_COLORS[key] }} />
                  <Text size="sm">{label}</Text>
                </Group>
                <Group gap="md" wrap="nowrap">
                  <Text size="sm" className="num">
                    {formatMoney(part?.amount ?? 0, data.currency)}
                  </Text>
                  <Text size="sm" className="num" fw={600} w={56} ta="right">
                    {formatPercent(part?.share)}
                  </Text>
                  <Text size="xs" c="dimmed" w={40} ta="right">
                    {part?.target != null ? formatPercent(part.target) : ''}
                  </Text>
                </Group>
              </Group>
            ))}
        </Stack>
      )}
    </Card>
  );
}

function DestinationsCard({ month, currency }: { month: Schemas['MonthSavings']; currency: string }) {
  const { t } = useTranslation();
  const moved = month.destinations.reduce((sum, item) => sum + item.amount, 0);
  const stayed = month.net - moved;
  return (
    <Card withBorder radius="md" padding="lg">
      <Title order={3} size="h5">
        {t('analytics.savings.destinations')}
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        {t('analytics.savings.destinationsMonth', {
          month: formatMonthShort(month.month),
          amount: formatMoney(month.net, currency),
        })}
      </Text>
      <Stack gap={8}>
        {month.destinations.length === 0 && (
          <Text size="sm" c="dimmed">
            {t('analytics.savings.noDestinations')}
          </Text>
        )}
        {month.destinations.map((item) => (
          <Group key={item.accountId} justify="space-between" wrap="nowrap">
            <Text size="sm">{item.name}</Text>
            <Text size="sm" className="num">
              {formatMoney(item.amount, currency)}
            </Text>
          </Group>
        ))}
        {stayed !== 0 && (
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" c="dimmed">
              {t('analytics.savings.stayed')}
            </Text>
            <Text size="sm" className="num">
              {formatMoney(stayed, currency, { signed: stayed < 0 })}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
