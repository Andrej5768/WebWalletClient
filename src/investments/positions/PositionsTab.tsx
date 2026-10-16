import {
  Anchor,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useAccounts } from '../../api/queries';
import { Figure } from '../../components/Figure';
import { QueryError, UnconvertedAlert } from '../../components/feedback';
import { formatPercent } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { usePortfolio, type Portfolio, type Position } from '../api';
import classes from './positions.module.css';

type Grouping = 'account' | 'type';
type Cash = Portfolio['cash'][number];

interface Group {
  key: string;
  title: string;
  positions: Position[];
  cash: Cash[];
}

/** The holdings of the brokerage accounts with their cash, grouped by account or by asset class. */
export function PositionsTab({ accountId }: { accountId?: number }) {
  const { t } = useTranslation();
  const portfolio = usePortfolio(accountId);
  const accounts = useAccounts();
  const [grouping, setGrouping] = useState<Grouping>('account');
  if (portfolio.isLoading) return <Skeleton height={360} radius="md" />;
  if (!portfolio.data) return <QueryError error={portfolio.error} onRetry={() => void portfolio.refetch()} />;
  const data = portfolio.data;
  const money = (value: number, signed = false) => formatMoney(value, data.currency, { signed });
  const accountName = (id: number) => accounts.data?.find((account) => account.id === id)?.name ?? '';
  const cash = data.cash.filter((item) => item.amount !== 0);
  const groups = grouping === 'account' ? byAccount(data, cash, accountName) : byType(data, cash, t);

  return (
    <Stack gap="md">
      <UnconvertedAlert currencies={data.unconvertedCurrencies} />
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
        <Figure label={t('invPositions.value')} value={money(data.value)} />
        <Figure
          label={t('invPositions.unrealized')}
          value={money(data.unrealized, true)}
          className={data.unrealized < 0 ? 'expense' : data.unrealized > 0 ? 'income' : ''}
          note={data.unrealizedShare != null ? formatPercent(data.unrealizedShare) : undefined}
        />
        <Figure
          label={t('invPositions.day')}
          value={money(data.dayChange, true)}
          className={data.dayChange < 0 ? 'expense' : data.dayChange > 0 ? 'income' : ''}
        />
      </SimpleGrid>
      <Group justify="flex-end">
        <SegmentedControl
          size="xs"
          aria-label={t('invPositions.grouping')}
          value={grouping}
          onChange={(value) => setGrouping(value as Grouping)}
          data={[
            { value: 'account', label: t('invPositions.byAccount') },
            { value: 'type', label: t('invPositions.byType') },
          ]}
        />
      </Group>
      {data.positions.length === 0 && cash.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" ta="center">
            {t('invPositions.empty')}
          </Text>
        </Card>
      ) : (
        <Card withBorder radius="md" p={0} className={classes.scroll}>
          <Table verticalSpacing="sm" horizontalSpacing="md" miw={900}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('invPositions.columns.instrument')}</Table.Th>
                <Table.Th ta="right">{t('invPositions.columns.quantity')}</Table.Th>
                <Table.Th ta="right">{t('invPositions.columns.average')}</Table.Th>
                <Table.Th ta="right">{t('invPositions.columns.price')}</Table.Th>
                <Table.Th ta="right">{t('invPositions.columns.value')}</Table.Th>
                <Table.Th ta="right">{t('invPositions.columns.profit')}</Table.Th>
                <Table.Th ta="right">{t('invPositions.columns.share')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groups.map((group) => (
                <GroupRows key={group.key} group={group} baseCurrency={data.currency} total={data.value} />
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}

function byAccount(data: Portfolio, cash: Cash[], accountName: (id: number) => string): Group[] {
  const ids = [...new Set([...data.positions.map((p) => p.accountId), ...cash.map((c) => c.accountId)])];
  return ids.map((id) => ({
    key: `account-${id}`,
    title: accountName(id),
    positions: data.positions.filter((position) => position.accountId === id),
    cash: cash.filter((item) => item.accountId === id),
  }));
}

function byType(data: Portfolio, cash: Cash[], t: (key: string) => string): Group[] {
  const types = [...new Set(data.positions.map((position) => position.instrument.type))];
  const groups: Group[] = types.map((type) => ({
    key: `type-${type}`,
    title: t(`investments.types.${type}`),
    positions: data.positions.filter((position) => position.instrument.type === type),
    cash: [],
  }));
  if (cash.length > 0) {
    groups.push({ key: 'type-CASH', title: t('investments.types.CASH'), positions: [], cash });
  }
  return groups;
}

function GroupRows({ group, baseCurrency, total }: { group: Group; baseCurrency: string; total: number }) {
  const { t } = useTranslation();
  return (
    <>
      <Table.Tr className={classes.group}>
        <Table.Td colSpan={7}>
          <Text size="xs" fw={600} tt="uppercase" c="dimmed">
            {group.title}
          </Text>
        </Table.Td>
      </Table.Tr>
      {group.positions.map((position) => (
        <PositionRow
          key={`${position.accountId}-${position.instrument.id}`}
          position={position}
          baseCurrency={baseCurrency}
        />
      ))}
      {group.cash.map((item) => (
        <Table.Tr key={`cash-${item.accountId}-${item.currency}`}>
          <Table.Td>
            <Text fw={500}>{t('invPositions.cash', { currency: item.currency })}</Text>
          </Table.Td>
          <Table.Td />
          <Table.Td />
          <Table.Td />
          <Table.Td ta="right">
            <Text className="num" fw={500}>
              {formatMoney(item.amount, item.currency)}
            </Text>
            {item.currency !== baseCurrency && item.amountInBase != null && (
              <Text size="xs" c="dimmed" className="num">
                {formatMoney(item.amountInBase, baseCurrency)}
              </Text>
            )}
          </Table.Td>
          <Table.Td />
          <Table.Td ta="right">
            <Text size="sm" className="num">
              {item.amountInBase != null && total > 0 ? formatPercent(item.amountInBase / total) : '—'}
            </Text>
          </Table.Td>
        </Table.Tr>
      ))}
    </>
  );
}

function PositionRow({ position, baseCurrency }: { position: Position; baseCurrency: string }) {
  const { t } = useTranslation();
  const instrument = position.instrument;
  const currency = instrument.currency;
  const href = `/investments/instruments/${instrument.id}?accountId=${position.accountId}`;
  const profitClass = position.unrealized < 0 ? 'expense' : position.unrealized > 0 ? 'income' : '';
  return (
    <Table.Tr>
      <Table.Td>
        <Anchor component={Link} to={href} underline="never" c="inherit" className={classes.instrument}>
          <span className={classes.ticker}>{instrument.symbol}</span>
          <Text size="sm" truncate maw={260}>
            {instrument.name}
          </Text>
        </Anchor>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" className="num">
          {formatQuantity(position.quantity)}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" className="num">
          {formatMoney(position.averagePrice, currency)}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        {position.price != null ? (
          <>
            <Text size="sm" className="num">
              {formatMoney(position.price, currency)}
            </Text>
            {instrument.valuation !== 'MARKET' ? (
              <Text size="xs" c="dimmed">
                {t(`invPositions.valuation.${instrument.valuation}`)}
              </Text>
            ) : (
              position.dayChange != null && (
                <Text
                  size="xs"
                  className={`num ${position.dayChange < 0 ? 'expense' : position.dayChange > 0 ? 'income' : ''}`}
                >
                  {formatMoney(position.dayChange, currency, { signed: true })}
                </Text>
              )
            )}
          </>
        ) : (
          <Text size="xs" c="dimmed">
            {t('invPositions.noPrice')}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" className="num" fw={500}>
          {formatMoney(position.value, currency)}
        </Text>
        {currency !== baseCurrency && position.valueInBase != null && (
          <Text size="xs" c="dimmed" className="num">
            {formatMoney(position.valueInBase, baseCurrency)}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" className={`num ${profitClass}`} fw={500}>
          {formatMoney(position.unrealized, currency, { signed: true })}
        </Text>
        {position.unrealizedShare != null && (
          <Text size="xs" className={`num ${profitClass}`}>
            {formatPercent(position.unrealizedShare)}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" className="num">
          {formatPercent(position.share)}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}

/** Whole units without decimals, fractions with up to four. */
function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 4 }).format(quantity);
}
