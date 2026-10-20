import {
  Badge,
  Card,
  Group,
  Pagination,
  SegmentedControl,
  Skeleton,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts } from '../../api/queries';
import { QueryError } from '../../components/feedback';
import { formatDate } from '../../lib/format';
import { formatMoney, formatQuantity } from '../../lib/money';
import { isBrokerage, useOperations, type Operation, type OperationType } from '../api';
import { OPERATION_COLORS } from '../operationColors';
import { useOpenOperation } from './useOpenOperation';

const PAGE_SIZE = 50;

/** The filters of the list and the types each shows; none means all. */
const FILTERS: Record<string, OperationType[]> = {
  all: [],
  trades: ['BUY', 'SELL', 'SPLIT'],
  income: ['DIVIDEND', 'COUPON'],
  fees: ['FEE'],
  money: ['DEPOSIT', 'WITHDRAWAL', 'EXCHANGE'],
};
type Filter = keyof typeof FILTERS;

/** Every operation of the brokerage accounts, newest first; a row opens it in the operation drawer. */
export function OperationsTab({ accountId }: { accountId?: number }) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const openOperation = useOpenOperation();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const operations = useOperations({ accountId, types: FILTERS[filter], page: page - 1, size: PAGE_SIZE });

  const brokerage = (accounts.data ?? []).filter(isBrokerage);
  const accountName = (id: number) => brokerage.find((account) => account.id === id)?.name ?? '';
  // The account of each row matters only when several are shown together
  const showAccount = accountId === undefined && brokerage.length > 1;
  const data = operations.data;

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <SegmentedControl
          size="xs"
          aria-label={t('invOperations.list.filter')}
          value={filter}
          onChange={(value) => {
            setFilter(value as Filter);
            setPage(1);
          }}
          data={Object.keys(FILTERS).map((value) => ({
            value,
            label: t(`invOperations.list.filters.${value}`),
          }))}
        />
      </Group>
      {operations.isLoading ? (
        <Skeleton height={320} radius="md" />
      ) : !data ? (
        <QueryError error={operations.error} onRetry={() => void operations.refetch()} />
      ) : data.items.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" ta="center">
            {t(filter === 'all' ? 'invOperations.list.empty' : 'invOperations.list.emptyFilter')}
          </Text>
        </Card>
      ) : (
        <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
          <Table verticalSpacing="sm" horizontalSpacing="md" miw={760} highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={110}>{t('invOperations.list.columns.date')}</Table.Th>
                <Table.Th w={140}>{t('invOperations.list.columns.type')}</Table.Th>
                <Table.Th>{t('invOperations.list.columns.what')}</Table.Th>
                {showAccount && <Table.Th>{t('invOperations.list.columns.account')}</Table.Th>}
                <Table.Th ta="right">{t('invOperations.list.columns.quantity')}</Table.Th>
                <Table.Th ta="right">{t('invOperations.list.columns.cash')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.items.map((operation) => (
                <OperationRow
                  key={operation.id}
                  operation={operation}
                  account={showAccount ? accountName(operation.accountId) : null}
                  onOpen={() => openOperation({ operationId: operation.id })}
                />
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
      {data && data.totalPages > 1 && (
        <Group justify="center">
          <Pagination size="sm" total={data.totalPages} value={page} onChange={setPage} />
        </Group>
      )}
    </Stack>
  );
}

function OperationRow({
  operation,
  account,
  onOpen,
}: {
  operation: Operation;
  account: string | null;
  onOpen(): void;
}) {
  const { t } = useTranslation();
  const type = t(`investments.operationTypes.${operation.type}`);
  const title =
    operation.type === 'EXCHANGE'
      ? `${operation.currency} → ${operation.toCurrency}`
      : (operation.symbol ?? type);
  const quantity =
    operation.type === 'BUY' || operation.type === 'SELL'
      ? `${formatQuantity(operation.quantity ?? 0)} × ${formatMoney(operation.price ?? 0, operation.currency)}`
      : operation.type === 'SPLIT'
        ? `${operation.splitFrom} → ${operation.splitTo}`
        : '—';
  const signed = (amount: number, currency: string) =>
    formatMoney(amount, currency, {
      signed: true,
      decimals: amount !== 0 && Math.abs(amount) < 0.01 ? 4 : 2,
    });
  const tone = (amount: number) => (amount < 0 ? 'expense' : amount > 0 ? 'income' : 'muted');

  return (
    <Table.Tr onClick={onOpen} style={{ cursor: 'pointer' }}>
      <Table.Td>
        <Text size="sm" c="dimmed" className="num">
          {formatDate(operation.date)}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color={OPERATION_COLORS[operation.type]} style={{ textTransform: 'none' }}>
          {type}
        </Badge>
      </Table.Td>
      <Table.Td style={{ maxWidth: 0 }}>
        <UnstyledButton
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          aria-label={t('invOperations.list.open', { what: title, date: formatDate(operation.date) })}
          style={{ display: 'block', width: '100%', minWidth: 0 }}
        >
          <Text size="sm" fw={500} truncate>
            {title}
          </Text>
          {operation.comment && (
            <Text size="xs" c="dimmed" truncate title={operation.comment}>
              {operation.comment}
            </Text>
          )}
        </UnstyledButton>
      </Table.Td>
      {account !== null && (
        <Table.Td>
          <Text size="sm" c="dimmed" truncate>
            {account}
          </Text>
        </Table.Td>
      )}
      <Table.Td ta="right">
        <Text size="sm" c="dimmed" className="num">
          {quantity}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        {operation.type === 'SPLIT' ? (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ) : (
          <Stack gap={0} align="flex-end">
            <Text size="sm" fw={500} className={`num ${tone(operation.cash)}`}>
              {signed(operation.cash, operation.currency)}
            </Text>
            {operation.type === 'EXCHANGE' && operation.toAmount != null && operation.toCurrency && (
              <Text size="sm" fw={500} className="num income">
                {signed(operation.toAmount, operation.toCurrency)}
              </Text>
            )}
          </Stack>
        )}
      </Table.Td>
    </Table.Tr>
  );
}
