import { Avatar, Card, Skeleton, Stack, Table, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../lib/money';
import type { Period } from '../lib/periods';
import { usePayeeReport } from './api';
import { ShareBar } from '../components/Figure';
import { QueryError, UnconvertedAlert } from '../components/feedback';

export function PayeesReport({ period }: { period: Period }) {
  const { t } = useTranslation();
  const report = usePayeeReport(period);
  if (report.isLoading) return <Skeleton height={360} radius="md" />;
  if (!report.data) return <QueryError error={report.error} onRetry={() => void report.refetch()} />;
  const data = report.data;
  const currency = data?.currency ?? 'UAH';
  const payees = data?.payees ?? [];
  const top = payees[0]?.amount ?? 0;

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data?.unconvertedCurrencies} />
      <Card withBorder radius="md" p={0}>
        {payees.length === 0 ? (
          <Text ta="center" c="dimmed" py={48}>
            {t('reports.empty')}
          </Text>
        ) : (
          <Table highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={48}>#</Table.Th>
                <Table.Th>{t('transactions.filters.payee')}</Table.Th>
                <Table.Th ta="right">{t('reports.operations')}</Table.Th>
                <Table.Th w={220} />
                <Table.Th ta="right">{t('reports.expense')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {payees.map((payee, index) => (
                <Table.Tr key={payee.payeeId ?? payee.name}>
                  <Table.Td c="dimmed" className="num">
                    {index + 1}
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={500}
                      component="span"
                      style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}
                    >
                      <Avatar size={24} radius="xl" color="gray">
                        {(payee.name ?? '?').charAt(0).toUpperCase()}
                      </Avatar>
                      {payee.name}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" className="num" c="dimmed">
                    {payee.transactions}
                  </Table.Td>
                  <Table.Td>
                    <ShareBar share={top ? (payee.amount ?? 0) / top : 0} />
                  </Table.Td>
                  <Table.Td ta="right" className="num" fw={500}>
                    {formatMoney(payee.amount ?? 0, currency)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
