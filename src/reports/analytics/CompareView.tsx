import { LineChart } from '@mantine/charts';
import {
  Card,
  Checkbox,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../../api/client';
import { Figure } from '../../components/Figure';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { formatDate, formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { kyivToday } from '../../lib/periods';
import { useCompare } from './api';
import { commonDays, comparePeriods, truncate, type ComparePeriods, type ComparePreset } from './model';

const PRESETS: ComparePreset[] = ['mom', 'yoy', 'custom'];

export function CompareView() {
  const { t } = useTranslation();
  const today = kyivToday();
  const [preset, setPreset] = useState<ComparePreset>('mom');
  const [sameDate, setSameDate] = useState(true);
  const [custom, setCustom] = useState<ComparePeriods>(() => comparePeriods('mom', today, false));
  const periods =
    preset === 'custom'
      ? truncate(custom, sameDate ? commonDays(custom) : null)
      : comparePeriods(preset, today, sameDate);
  const compare = useCompare(periods);

  const range = (from: string, to: string) => `${formatDate(from)} – ${formatDate(to)}`;
  const labelA = range(periods.fromA, periods.toA);
  const labelB = range(periods.fromB, periods.toB);

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <SegmentedControl
          value={preset}
          onChange={(value) => setPreset(value as ComparePreset)}
          data={PRESETS.map((value) => ({ value, label: t(`analytics.compare.${value}`) }))}
        />
        <Checkbox
          label={t('analytics.compare.sameDate')}
          checked={sameDate}
          onChange={(event) => setSameDate(event.currentTarget.checked)}
        />
      </Group>
      {preset === 'custom' && (
        <Group gap="sm" wrap="wrap">
          <DatePickerInput
            type="range"
            label={t('analytics.compare.periodA')}
            valueFormat="DD.MM.YYYY"
            w={240}
            value={[custom.fromA, custom.toA]}
            onChange={([from, to]) => from && to && setCustom({ ...custom, fromA: from, toA: to })}
          />
          <DatePickerInput
            type="range"
            label={t('analytics.compare.periodB')}
            valueFormat="DD.MM.YYYY"
            w={240}
            value={[custom.fromB, custom.toB]}
            onChange={([from, to]) => from && to && setCustom({ ...custom, fromB: from, toB: to })}
          />
        </Group>
      )}
      {compare.isLoading ? (
        <Skeleton height={420} radius="md" />
      ) : !compare.data ? (
        <QueryError error={compare.error} onRetry={() => void compare.refetch()} />
      ) : (
        <CompareResult data={compare.data} labelA={labelA} labelB={labelB} />
      )}
    </Stack>
  );
}

function CompareResult({
  data,
  labelA,
  labelB,
}: {
  data: Schemas['CompareResponse'];
  labelA: string;
  labelB: string;
}) {
  const { t } = useTranslation();
  const currency = data.currency;
  const money = (value: number) => formatMoney(value, currency);
  const name = (row: Schemas['CategoryChange']) => row.name ?? t('analytics.compare.uncategorized');
  const biggest = data.categories.filter((row) => row.change !== 0).slice(0, 3);
  const chart = data.days.map((day) => ({
    day: String(day.day),
    [labelA]: day.a,
    [labelB]: day.b,
  }));

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Figure label={t('analytics.compare.periodA')} value={money(data.totalA)} note={labelA} />
        <Figure label={t('analytics.compare.periodB')} value={money(data.totalB)} note={labelB} />
        <Figure
          label={t('analytics.compare.change')}
          value={formatMoney(data.change, currency, { signed: true })}
          className={data.change > 0 ? 'expense' : data.change < 0 ? 'income' : undefined}
          note={formatPercent(data.changeShare)}
        />
      </SimpleGrid>
      {biggest.length > 0 && (
        <Text size="sm">
          <Text span fw={500}>
            {t('analytics.compare.biggest')}
          </Text>{' '}
          {biggest
            .map((row) => `${name(row)} ${formatMoney(row.change, currency, { signed: true })}`)
            .join(' · ')}
        </Text>
      )}
      <Card withBorder radius="md" padding="lg">
        <Text fw={500}>{t('analytics.compare.cumulative')}</Text>
        <Text size="xs" c="dimmed" mb="sm">
          {t('analytics.compare.cumulativeHint')}
        </Text>
        <LineChart
          h={260}
          data={chart}
          dataKey="day"
          series={[
            { name: labelA, color: 'blue.7' },
            { name: labelB, color: 'gray.5', strokeDasharray: '6 5' },
          ]}
          withLegend
          withDots={false}
          connectNulls={false}
          curveType="linear"
          valueFormatter={(value) => money(value)}
          gridAxis="y"
          tickLine="none"
        />
      </Card>
      <Card withBorder radius="md" p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('analytics.compare.category')}</Table.Th>
              <Table.Th ta="right">{t('analytics.compare.periodA')}</Table.Th>
              <Table.Th ta="right">{t('analytics.compare.periodB')}</Table.Th>
              <Table.Th ta="right">{t('analytics.compare.change')}</Table.Th>
              <Table.Th ta="right">%</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.categories.map((row) => (
              <Table.Tr key={row.categoryId ?? 'none'}>
                <Table.Td>{name(row)}</Table.Td>
                <Table.Td ta="right" className="num">
                  {money(row.a)}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {money(row.b)}
                </Table.Td>
                <Table.Td
                  ta="right"
                  className={`num ${row.change > 0 ? 'expense' : row.change < 0 ? 'income' : ''}`}
                >
                  {formatMoney(row.change, currency, { signed: true })}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {formatPercent(row.changeShare)}
                </Table.Td>
              </Table.Tr>
            ))}
            <Table.Tr fw={600} bg="var(--ww-subtle)">
              <Table.Td>{t('analytics.plan.total')}</Table.Td>
              <Table.Td ta="right" className="num">
                {money(data.totalA)}
              </Table.Td>
              <Table.Td ta="right" className="num">
                {money(data.totalB)}
              </Table.Td>
              <Table.Td ta="right" className="num">
                {formatMoney(data.change, currency, { signed: true })}
              </Table.Td>
              <Table.Td ta="right" className="num">
                {formatPercent(data.changeShare)}
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>
      <Text size="xs" c="dimmed">
        {t('analytics.compare.legend')}
      </Text>
    </Stack>
  );
}
