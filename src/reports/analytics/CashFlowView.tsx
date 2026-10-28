import { CompositeChart } from '@mantine/charts';
import { moneyAxis } from '../../components/chartAxis';
import { Card, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { capitalize, formatMonthShort, formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { kyivToday, periodOf } from '../../lib/periods';
import { useIncomeExpense } from '../api';

/** Income and expenses side by side with what was left, for the last 12 months. */
export function CashFlowView() {
  const { t } = useTranslation();
  const report = useIncomeExpense(periodOf('twelveMonths', kyivToday()));
  if (report.isLoading) return <Skeleton height={420} radius="md" />;
  if (!report.data) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const currency = data.currency;
  const income = t('reports.income');
  const expense = t('reports.expense');
  const net = t('reports.net');
  const chart = data.months.map((month) => ({
    month: formatMonthShort(month.month),
    [income]: month.income,
    [expense]: month.expense,
    [net]: month.net,
  }));
  const average = data.months.length ? data.net / data.months.length : 0;

  return (
    <Stack gap="md">
      <Stack gap={0}>
        <Title order={2} size="h4">
          {t('analytics.cashflow.title')}
        </Title>
        <Text size="sm" c="dimmed">
          {t('analytics.cashflow.subtitle')}
        </Text>
      </Stack>
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <Card withBorder radius="md" padding="lg">
        <CompositeChart
          h={300}
          data={chart}
          dataKey="month"
          series={[
            { name: income, color: 'green.6', type: 'bar' },
            { name: expense, color: 'red.6', type: 'bar' },
            { name: net, color: 'dark.4', type: 'line' },
          ]}
          withLegend
          valueFormatter={(value) => formatMoney(value, currency)}
          yAxisProps={moneyAxis}
          gridAxis="y"
          tickLine="none"
        />
        <Text size="sm" c="dimmed" mt="sm">
          {average >= 0
            ? t('analytics.cashflow.average', { amount: formatMoney(average, currency) })
            : t('analytics.cashflow.averageNegative', { amount: formatMoney(-average, currency) })}
        </Text>
      </Card>
      <Card withBorder radius="md" p={0}>
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('reports.month')}</Table.Th>
              <Table.Th ta="right">{income}</Table.Th>
              <Table.Th ta="right">{expense}</Table.Th>
              <Table.Th ta="right">{net}</Table.Th>
              <Table.Th ta="right">{t('reports.savingsRate')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {[...data.months].reverse().map((month) => (
              <Table.Tr key={month.month}>
                <Table.Td>{capitalize(formatMonthShort(month.month))}</Table.Td>
                <Table.Td ta="right" className="num income">
                  {formatMoney(month.income, currency)}
                </Table.Td>
                <Table.Td ta="right" className="num expense">
                  {formatMoney(month.expense, currency)}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {formatMoney(month.net, currency, { signed: true })}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {formatPercent(month.savingsRate)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
