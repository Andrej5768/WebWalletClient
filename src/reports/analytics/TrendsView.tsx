import { LineChart } from '@mantine/charts';
import { Button, Card, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../../api/client';
import { useCategoriesById } from '../../api/queries';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { locale } from '../../i18n';
import { formatMonthShort } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { mantineColor } from '../../lib/palette';
import { useTrends } from './api';
import classes from './analytics.module.css';

type Trend = Schemas['CategoryTrend'];

const FALLBACK = ['blue', 'orange', 'teal', 'violet', 'pink', 'yellow', 'cyan', 'lime', 'indigo', 'red'];

export function TrendsView() {
  const { t } = useTranslation();
  const trends = useTrends();
  const byId = useCategoriesById();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<number | null>(null);

  if (trends.isLoading) return <Skeleton height={420} radius="md" />;
  if (!trends.data) return <QueryError error={trends.error} onRetry={() => void trends.refetch()} />;
  const data = trends.data;
  const currency = data.currency;
  const money = (value: number) => formatMoney(value, currency);
  const label = (trend: Trend) => trend.name ?? t('analytics.compare.uncategorized');
  const key = (trend: Trend) => String(trend.categoryId ?? 'none');
  const color = (trend: Trend, index: number) =>
    trend.categoryId == null
      ? 'gray.5'
      : `${mantineColor(byId.get(trend.categoryId)?.color, FALLBACK[index % FALLBACK.length])}.6`;

  const visible = data.categories.filter((trend) => !hidden.has(key(trend)));
  const chart = data.months.map((month, index) => {
    const point: Record<string, string | number> = { month: formatMonthShort(month.month) };
    visible.forEach((trend) => (point[label(trend)] = trend.amounts[index] ?? 0));
    return point;
  });
  const shown = pinned ?? data.months.length - 1;
  const shownTotal = visible.reduce((sum, trend) => sum + (trend.amounts[shown] ?? 0), 0);

  const toggle = (trend: Trend) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key(trend))) next.delete(key(trend));
      else next.add(key(trend));
      return next;
    });

  const anomalies = data.categories.flatMap((trend) =>
    trend.anomalies.map((anomaly) => ({ trend, anomaly })),
  );

  return (
    <Stack gap="md">
      <Stack gap={0}>
        <Title order={2} size="h4">
          {t('analytics.trends.title')}
        </Title>
        <Text size="sm" c="dimmed">
          {t('analytics.trends.hint')}
        </Text>
      </Stack>
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <Card withBorder radius="md" padding="lg">
        <div className={classes.trendGrid}>
          <div className={classes.trendMain}>
            <LineChart
              h={300}
              data={chart}
              dataKey="month"
              series={visible.map((trend) => ({
                name: label(trend),
                color: color(trend, data.categories.indexOf(trend)),
              }))}
              curveType="linear"
              valueFormatter={(value) => money(value)}
              gridAxis="y"
              tickLine="none"
              lineChartProps={{
                onClick: (state: { activeTooltipIndex?: number | string | null }) => {
                  const index = Number(state?.activeTooltipIndex);
                  if (Number.isInteger(index) && index >= 0) setPinned(index);
                },
              }}
            />
          </div>
          {data.months.length > 0 && (
            <div className={classes.trendSide}>
              <Text fw={500} tt="capitalize">
                {formatMonthShort(data.months[shown]?.month)}
              </Text>
              <Text size="xs" c="dimmed" mb={4}>
                {t('analytics.trends.sideHint')}
              </Text>
              {data.categories.map((trend, index) => {
                const off = hidden.has(key(trend));
                const amount = trend.amounts[shown] ?? 0;
                const delta = amount - trend.average;
                return (
                  <button
                    key={key(trend)}
                    type="button"
                    className={`${classes.legendRow} ${off ? classes.legendRowOff : ''}`}
                    aria-pressed={!off}
                    aria-label={t('analytics.trends.toggle', { name: label(trend) })}
                    onClick={() => toggle(trend)}
                  >
                    <span
                      className={classes.swatch}
                      style={{ background: `var(--mantine-color-${color(trend, index).replace('.', '-')})` }}
                    />
                    <Text size="sm" truncate>
                      {label(trend)}
                    </Text>
                    <Stack gap={0} align="flex-end">
                      <Text size="sm" className="num">
                        {money(amount)}
                      </Text>
                      <Text size="xs" className={`num ${delta > 0 ? 'expense' : delta < 0 ? 'income' : ''}`}>
                        {formatMoney(delta, currency, { signed: true })}
                      </Text>
                    </Stack>
                  </button>
                );
              })}
              <Text size="sm" fw={600} mt={6} px={10}>
                {t('analytics.trends.visibleTotal')}: <span className="num">{money(shownTotal)}</span>
              </Text>
              {pinned != null && (
                <Button variant="subtle" size="xs" onClick={() => setPinned(null)}>
                  {t('analytics.trends.unpin')}
                </Button>
              )}
            </div>
          )}
        </div>
        <Text size="xs" c="dimmed" mt="sm">
          {t('analytics.trends.range', {
            from: formatMonthShort(data.from),
            to: formatMonthShort(data.to),
          })}
        </Text>
      </Card>
      <Card withBorder radius="md" padding="lg">
        <Text fw={500}>{t('analytics.trends.anomalies')}</Text>
        <Text size="xs" c="dimmed" mb="sm">
          {t('analytics.trends.anomaliesHint')}
        </Text>
        {anomalies.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t('analytics.trends.noAnomalies')}
          </Text>
        ) : (
          <Stack gap={6}>
            {anomalies.map(({ trend, anomaly }) => (
              <Text key={`${key(trend)}-${anomaly.month}`} size="sm">
                {t('analytics.trends.anomaly', {
                  name: label(trend),
                  month: formatMonthShort(anomaly.month),
                  amount: money(anomaly.amount),
                  ratio: new Intl.NumberFormat(locale(), { maximumFractionDigits: 1 }).format(anomaly.ratio),
                  average: money(anomaly.average),
                })}
              </Text>
            ))}
          </Stack>
        )}
      </Card>
    </Stack>
  );
}
