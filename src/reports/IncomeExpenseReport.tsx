import { BarChart } from '@mantine/charts';
import { Card, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { locale } from '../i18n';
import { formatMoney } from '../lib/money';
import type { Period } from '../transactions/periods';
import { useIncomeExpense } from './api';
import { Figure } from './Figure';
import { UnconvertedAlert } from './ReportsPage';

const rate = (value?: number | null) => (value == null ? '—' : `${Math.round(value * 1000) / 10}%`);

export function IncomeExpenseReport({ period }: { period: Period }) {
  const { t, i18n } = useTranslation();
  const report = useIncomeExpense(period);
  if (report.isLoading) return <Skeleton height={360} radius="md" />;
  const data = report.data;
  const currency = data?.currency ?? 'UAH';
  const monthName = (month?: string) =>
    dayjs(`${month}-01`)
      .toDate()
      .toLocaleDateString(locale(i18n.language), { month: 'short', year: '2-digit' });
  const months = (data?.months ?? []).map((month) => ({
    month: monthName(month.month),
    [t('reports.income')]: month.income ?? 0,
    [t('reports.expense')]: month.expense ?? 0,
  }));

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data?.unconvertedCurrencies} />
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Figure
          label={t('reports.income')}
          value={formatMoney(data?.income ?? 0, currency)}
          className="income"
        />
        <Figure
          label={t('reports.expense')}
          value={formatMoney(data?.expense ?? 0, currency)}
          className="expense"
        />
        <Figure label={t('reports.net')} value={formatMoney(data?.net ?? 0, currency, { signed: true })} />
        <Figure label={t('reports.savingsRate')} value={rate(data?.savingsRate)} />
      </SimpleGrid>
      <Card withBorder radius="md" padding="lg">
        <BarChart
          h={280}
          data={months}
          dataKey="month"
          series={[
            { name: t('reports.income'), color: 'green.6' },
            { name: t('reports.expense'), color: 'red.6' },
          ]}
          withLegend
          valueFormatter={(value) => formatMoney(value, currency)}
          gridAxis="y"
          tickLine="none"
        />
      </Card>
      <Card withBorder radius="md" p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('reports.month')}</Table.Th>
              <Table.Th ta="right">{t('reports.income')}</Table.Th>
              <Table.Th ta="right">{t('reports.expense')}</Table.Th>
              <Table.Th ta="right">{t('reports.net')}</Table.Th>
              <Table.Th ta="right">{t('reports.savingsRate')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...(data?.months ?? [])].reverse().map((month) => (
              <Table.Tr key={month.month}>
                <Table.Td tt="capitalize">{monthName(month.month)}</Table.Td>
                <Table.Td ta="right" className="num income">
                  {formatMoney(month.income ?? 0, currency)}
                </Table.Td>
                <Table.Td ta="right" className="num expense">
                  {formatMoney(month.expense ?? 0, currency)}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {formatMoney(month.net ?? 0, currency, { signed: true })}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  <Text size="sm" c="dimmed" span>
                    {rate(month.savingsRate)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
