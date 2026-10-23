import { Card, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { capitalize, formatMonthShort, formatPercent } from '../lib/format';
import { formatMoney } from '../lib/money';
import type { Period } from '../lib/periods';
import { useIncomeExpense } from './api';
import { IncomeExpenseChart } from './IncomeExpenseChart';
import { Figure } from '../components/Figure';
import { QueryError, UnconvertedAlert } from '../components/feedback';

export function IncomeExpenseReport({ period }: { period: Period }) {
  const { t } = useTranslation();
  const report = useIncomeExpense(period);
  if (report.isLoading) return <Skeleton height={360} radius="md" />;
  if (!report.data) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const currency = data?.currency ?? 'UAH';

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
        <Figure label={t('reports.savingsRate')} value={formatPercent(data?.savingsRate)} />
      </SimpleGrid>
      <Card withBorder radius="md" padding="lg">
        <IncomeExpenseChart months={data?.months ?? []} currency={currency} height={280} />
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
                <Table.Td>{capitalize(formatMonthShort(month.month))}</Table.Td>
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
                    {formatPercent(month.savingsRate)}
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
