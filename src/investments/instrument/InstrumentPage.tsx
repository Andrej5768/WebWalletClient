import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useSearchParams } from 'react-router';
import { QueryError } from '../../components/feedback';
import { Figure, ShareBar } from '../../components/Figure';
import { formatDay, formatPercent } from '../../lib/format';
import { formatMoney, formatQuantity } from '../../lib/money';
import { kyivToday } from '../../lib/periods';
import { intParam } from '../../lib/useUrlParams';
import { useInstrument, usePortfolio, usePosition, type Operation, type PositionDetail } from '../api';
import { OperationDrawerFromUrl } from '../operations/OperationDrawerFromUrl';
import { useOpenOperation } from '../operations/useOpenOperation';
import { InstrumentModal } from './InstrumentModal';
import { PriceChart } from './PriceChart';

const quantity = (value: number) => formatQuantity(value, 8);

/**
 * One instrument (`/investments/instruments/:id?accountId=`): the position on the account with its lots, the
 * price chart, the operations and the dividends. Without `accountId` the first account holding it is shown.
 */
export function InstrumentPage() {
  const { t } = useTranslation();
  const openOperation = useOpenOperation();
  const { id } = useParams();
  const [params] = useSearchParams();
  const instrumentId = Number(id) || undefined;
  const instrument = useInstrument(instrumentId);
  const portfolio = usePortfolio();
  const holder = portfolio.data?.positions.find(
    (position) => position.instrument.id === instrumentId,
  )?.accountId;
  const accountId = intParam(params, 'accountId') ?? holder;
  const position = usePosition(accountId, instrumentId);
  const [editing, setEditing] = useState(false);

  if (instrument.isLoading) return <Skeleton height={400} radius="md" />;
  if (!instrument.data)
    return <QueryError error={instrument.error} onRetry={() => void instrument.refetch()} />;
  const data = instrument.data;
  const detail = position.data;
  const currency = data.currency;
  const money = (amount: number | null | undefined, signed = false) =>
    amount == null ? '—' : formatMoney(amount, currency, { signed });
  // The drawer opens here, so the instrument stays in view after saving
  const open = (type: 'BUY' | 'SELL') => openOperation({ type, instrumentId: data.id, accountId });
  const dayChange =
    portfolio.data?.positions.find(
      (row) => row.instrument.id === data.id && (accountId === undefined || row.accountId === accountId),
    )?.dayChange ?? null;

  return (
    <Stack gap="lg" maw={1200}>
      <Anchor component={Link} to="/investments?tab=positions" size="sm">
        ← {t('invInstrument.back')}
      </Anchor>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Stack gap={2}>
          <Group gap="xs">
            <Badge variant="light" size="lg" ff="monospace" style={{ textTransform: 'none' }}>
              {data.symbol}
            </Badge>
            <Title order={1} size="h2">
              {data.name}
            </Title>
          </Group>
          <Text size="sm" c="dimmed">
            {[data.exchange, data.isin, t(`investments.types.${data.type}`)].filter(Boolean).join(' · ')}
          </Text>
        </Stack>
        <Stack gap={4} align="flex-end">
          <Text className="num" fz={24} fw={600}>
            {money(data.price)}
          </Text>
          <Text size="sm" c="dimmed">
            {dayChange != null && (
              <span className={`num ${dayChange < 0 ? 'expense' : 'income'}`}>
                {money(dayChange, true)}
                {' · '}
              </span>
            )}
            {data.priceDate
              ? t('invInstrument.priceOn', { date: formatDay(data.priceDate) })
              : t('invInstrument.noPrice')}
          </Text>
          <Group gap="xs">
            {data.own && (
              <Button variant="default" onClick={() => setEditing(true)}>
                {t(
                  data.valuation === 'MANUAL' ? 'invInstrument.changePrice' : 'invInstrument.editInstrument',
                )}
              </Button>
            )}
            <Button variant="default" onClick={() => open('SELL')} disabled={!detail || detail.quantity <= 0}>
              {t('invInstrument.sell')}
            </Button>
            <Button onClick={() => open('BUY')}>{t('invInstrument.buy')}</Button>
          </Group>
        </Stack>
      </Group>

      {data.own && (
        <Text size="sm" c="dimmed">
          {data.valuation === 'NOMINAL'
            ? t('invInstrument.valuedByNominal')
            : t('invInstrument.valuedByHand')}
        </Text>
      )}

      {detail && <Summary detail={detail} money={money} />}
      {detail && (
        <Alert variant="light" color="blue" icon={<Info size={16} />}>
          {t('invInstrument.fifoNote')}
        </Alert>
      )}

      {data.valuation === 'MARKET' && (
        <Card withBorder radius="md" padding="lg">
          <PriceChart
            instrumentId={data.id}
            currency={currency}
            operations={detail?.operations ?? []}
            averagePrice={detail?.averagePrice ?? null}
          />
        </Card>
      )}

      {detail ? (
        <Tabs defaultValue="lots">
          <Tabs.List>
            <Tabs.Tab value="lots">{t('invInstrument.tabs.lots')}</Tabs.Tab>
            <Tabs.Tab value="operations">{t('invInstrument.tabs.operations')}</Tabs.Tab>
            <Tabs.Tab value="dividends">{t('invInstrument.tabs.dividends')}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="lots" pt="md">
            <Lots detail={detail} money={money} />
          </Tabs.Panel>
          <Tabs.Panel value="operations" pt="md">
            <Operations
              operations={detail.operations}
              money={money}
              onEdit={(operation) => openOperation({ operationId: operation.id })}
            />
          </Tabs.Panel>
          <Tabs.Panel value="dividends" pt="md">
            <Dividends operations={detail.operations} money={money} />
          </Tabs.Panel>
        </Tabs>
      ) : (
        !position.isLoading && (
          <Text c="dimmed" size="sm">
            {t('invInstrument.noPosition')}
          </Text>
        )
      )}
      {editing && <InstrumentModal instrument={data} onClose={() => setEditing(false)} />}
      <OperationDrawerFromUrl defaultAccountId={accountId} />
    </Stack>
  );
}

type Money = (amount: number | null | undefined, signed?: boolean) => string;

function Summary({ detail, money }: { detail: PositionDetail; money: Money }) {
  const { t } = useTranslation();
  const share = detail.cost > 0 ? detail.unrealized / detail.cost : null;
  return (
    <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
      <Figure label={t('invInstrument.quantity')} value={quantity(detail.quantity)} />
      <Figure label={t('invInstrument.averagePrice')} value={money(detail.averagePrice)} />
      <Figure
        label={t('invInstrument.value')}
        value={money(detail.value)}
        note={t('invInstrument.cost', { cost: money(detail.cost) })}
      />
      <Figure
        label={t('invInstrument.unrealized')}
        value={money(detail.unrealized, true)}
        note={share != null ? formatPercent(share) : undefined}
        className={detail.unrealized < 0 ? 'expense' : 'income'}
      />
      <Figure
        label={t('invInstrument.realized')}
        value={money(detail.realized, true)}
        note={t('invInstrument.realizedNote')}
        className={detail.realized < 0 ? 'expense' : detail.realized > 0 ? 'income' : ''}
      />
    </SimpleGrid>
  );
}

function Lots({ detail, money }: { detail: PositionDetail; money: Money }) {
  const { t } = useTranslation();
  if (detail.lots.length === 0) return <Text c="dimmed">{t('invInstrument.noLots')}</Text>;
  return (
    <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
      <Table verticalSpacing="sm" horizontalSpacing="md" miw={640}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('invInstrument.lots.date')}</Table.Th>
            <Table.Th ta="right">{t('invInstrument.lots.quantity')}</Table.Th>
            <Table.Th ta="right">{t('invInstrument.lots.unitCost')}</Table.Th>
            <Table.Th>{t('invInstrument.lots.remaining')}</Table.Th>
            <Table.Th ta="right">{t('invInstrument.lots.unrealized')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.lots.map((lot) => {
            const closed = lot.remaining <= 0;
            return (
              <Table.Tr
                key={lot.operationId}
                c={closed ? 'dimmed' : undefined}
                data-testid={`lot-${lot.operationId}`}
              >
                <Table.Td>{formatDay(lot.date)}</Table.Td>
                <Table.Td ta="right" className="num">
                  {quantity(lot.quantity)}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {money(lot.unitCost)}
                </Table.Td>
                <Table.Td>
                  {closed ? (
                    <Text size="sm">{t('invInstrument.lots.closed')}</Text>
                  ) : (
                    <Stack gap={4}>
                      <Text size="sm" className="num">
                        {t('invInstrument.lots.left', {
                          remaining: quantity(lot.remaining),
                          quantity: quantity(lot.quantity),
                        })}
                      </Text>
                      <ShareBar share={lot.remaining / lot.quantity} />
                    </Stack>
                  )}
                </Table.Td>
                <Table.Td
                  ta="right"
                  className={`num ${lot.unrealized == null ? '' : lot.unrealized < 0 ? 'expense' : 'income'}`}
                >
                  {lot.unrealized == null ? '—' : money(lot.unrealized, true)}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function Operations({
  operations,
  money,
  onEdit,
}: {
  operations: Operation[];
  money: Money;
  onEdit(operation: Operation): void;
}) {
  const { t } = useTranslation();
  return (
    <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
      <Table verticalSpacing="sm" horizontalSpacing="md" miw={640} highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('invInstrument.operations.date')}</Table.Th>
            <Table.Th>{t('invInstrument.operations.type')}</Table.Th>
            <Table.Th ta="right">{t('invInstrument.operations.quantity')}</Table.Th>
            <Table.Th ta="right">{t('invInstrument.operations.price')}</Table.Th>
            <Table.Th ta="right">{t('invInstrument.operations.cash')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {operations.map((operation) => (
            <Table.Tr key={operation.id}>
              <Table.Td>
                <Anchor component="button" type="button" size="sm" onClick={() => onEdit(operation)}>
                  {formatDay(operation.date)}
                </Anchor>
              </Table.Td>
              <Table.Td>{t(`investments.operationTypes.${operation.type}`)}</Table.Td>
              <Table.Td ta="right" className="num">
                {operation.quantity != null
                  ? quantity(operation.quantity)
                  : operation.type === 'SPLIT'
                    ? `${operation.splitFrom} → ${operation.splitTo}`
                    : ''}
              </Table.Td>
              <Table.Td ta="right" className="num">
                {operation.price != null ? money(operation.price) : ''}
              </Table.Td>
              <Table.Td
                ta="right"
                className={`num ${operation.cash < 0 ? 'expense' : operation.cash > 0 ? 'income' : ''}`}
              >
                {operation.cash !== 0
                  ? formatMoney(operation.cash, operation.currency, { signed: true })
                  : ''}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function Dividends({ operations, money }: { operations: Operation[]; money: Money }) {
  const { t } = useTranslation();
  const incomes = operations.filter(
    (operation) => operation.type === 'DIVIDEND' || operation.type === 'COUPON',
  );
  if (incomes.length === 0) return <Text c="dimmed">{t('invInstrument.dividends.none')}</Text>;
  const yearAgo = kyivToday().subtract(1, 'year').format('YYYY-MM-DD');
  const total = incomes
    .filter((operation) => operation.date > yearAgo)
    .reduce((sum, operation) => sum + operation.amount - operation.tax, 0);
  return (
    <Stack gap="sm">
      <Text size="sm">
        {t('invInstrument.dividends.total')}{' '}
        <Text component="span" fw={600} className="num">
          {money(total)}
        </Text>
      </Text>
      <Card withBorder radius="md" p={0} style={{ overflowX: 'auto' }}>
        <Table verticalSpacing="sm" horizontalSpacing="md" miw={560}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('invInstrument.dividends.date')}</Table.Th>
              <Table.Th ta="right">{t('invInstrument.dividends.gross')}</Table.Th>
              <Table.Th ta="right">{t('invInstrument.dividends.tax')}</Table.Th>
              <Table.Th ta="right">{t('invInstrument.dividends.net')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {incomes.map((operation) => (
              <Table.Tr key={operation.id}>
                <Table.Td>{formatDay(operation.date)}</Table.Td>
                <Table.Td ta="right" className="num">
                  {formatMoney(operation.amount, operation.currency)}
                </Table.Td>
                <Table.Td ta="right" className="num">
                  {formatMoney(operation.tax, operation.currency)}
                </Table.Td>
                <Table.Td ta="right" className="num income">
                  {formatMoney(operation.amount - operation.tax, operation.currency)}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
