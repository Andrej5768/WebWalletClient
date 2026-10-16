import { LineChart } from '@mantine/charts';
import { Group, SegmentedControl, Skeleton, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatDayShort } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { isoDate, kyivToday } from '../../lib/periods';
import { usePrices, type Operation } from '../api';

const RANGES = { year: 1, threeYears: 3, all: 20 } as const;
type Range = keyof typeof RANGES;

/** Daily closes with the trades of the position as vertical marks and its average price as a dashed line. */
export function PriceChart({
  instrumentId,
  currency,
  operations,
  averagePrice,
}: {
  instrumentId: number;
  currency: string;
  operations: Operation[];
  averagePrice: number | null;
}) {
  const { t } = useTranslation();
  const [range, setRange] = useState<Range>('year');
  const from = isoDate(kyivToday().subtract(RANGES[range], 'year'));
  const prices = usePrices(instrumentId, from);
  const points = prices.data ?? [];
  const trades = operations.filter(
    (operation) =>
      (operation.type === 'BUY' || operation.type === 'SELL') && operation.date >= (points[0]?.date ?? from),
  );
  const price = t('invInstrument.chart.price');

  return (
    <div>
      <Group justify="space-between" mb="sm">
        <Text fw={600}>{t('invInstrument.chart.title')}</Text>
        <SegmentedControl
          size="xs"
          aria-label={t('invInstrument.chart.range')}
          value={range}
          onChange={(value) => setRange(value as Range)}
          data={(Object.keys(RANGES) as Range[]).map((value) => ({
            value,
            label: t(`invInstrument.chart.ranges.${value}`),
          }))}
        />
      </Group>
      {prices.isLoading ? (
        <Skeleton height={260} radius="md" />
      ) : points.length === 0 ? (
        <Text size="sm" c="dimmed" py="xl" ta="center">
          {t('invInstrument.chart.empty')}
        </Text>
      ) : (
        <LineChart
          h={260}
          data={points.map((point) => ({ date: point.date, [price]: point.close }))}
          dataKey="date"
          series={[{ name: price, color: 'cobalt.6' }]}
          withDots={false}
          curveType="linear"
          gridAxis="y"
          tickLine="none"
          xAxisProps={{ tickFormatter: (value: string) => formatDayShort(value), minTickGap: 40 }}
          valueFormatter={(value) => formatMoney(value, currency)}
          tooltipProps={{
            labelFormatter: (value: unknown) => formatDate(String(value)),
          }}
          referenceLines={[
            ...(averagePrice != null
              ? [
                  {
                    y: averagePrice,
                    label: t('invInstrument.chart.average', { price: formatMoney(averagePrice, currency) }),
                    color: 'gray.6',
                    strokeDasharray: '5 5',
                  },
                ]
              : []),
            ...trades.map((trade) => ({
              x: nearest(points, trade.date),
              color: trade.type === 'BUY' ? 'green.6' : 'red.6',
              label: t(`investments.operationTypes.${trade.type}`),
            })),
          ]}
        />
      )}
    </div>
  );
}

/** The date of the first close on or after the day, so that a trade on a holiday still has its mark. */
function nearest(points: { date: string }[], day: string): string {
  const found = points.find((point) => point.date >= day);
  return found?.date ?? points[points.length - 1]?.date ?? day;
}
