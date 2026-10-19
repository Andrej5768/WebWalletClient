import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { Info, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { invalidateLedger } from '../api/queries';
import { FormFooter } from '../components/FormFooter';
import { ProblemAlert } from '../components/feedback';
import { investmentKeys } from '../investments/api';
import { OPERATION_COLORS } from '../investments/operationColors';
import { InstrumentPicker } from '../investments/operations/InstrumentPicker';
import { formatDate } from '../lib/format';
import { formatMoney, formatQuantity } from '../lib/money';
import {
  confirmFreedom,
  discardPreview,
  type BrokerImportResult,
  type BrokerOperation,
  type BrokerPreview,
  type BrokerTicker,
  type InstrumentChoice,
} from './api';
import {
  cashAfter,
  choiceRequest,
  filterOf,
  FILTERS,
  isManual,
  quantityAfter,
  type Choice,
  type Filter,
} from './broker';

/** The reports of a broker before the import: what each ticker becomes and every row of the reports. */
export function BrokerPreviewModal({ preview, onClose }: { preview: BrokerPreview; onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Map<string, Choice>>(new Map());
  const [result, setResult] = useState<BrokerImportResult | null>(null);

  const operations = preview.operations;
  const fresh = operations.filter((operation) => operation.status === 'NEW');
  const importing = fresh.filter((operation) => !excluded.has(operation.key));
  const counts = new Map<string, number>();
  importing.forEach((operation) => counts.set(operation.type!, (counts.get(operation.type!) ?? 0) + 1));
  const duplicates = operations.filter((operation) => operation.status === 'DUPLICATE').length;
  const skipped = operations.filter((operation) => operation.status === 'SKIPPED').length;
  const shortfalls = preview.instruments.filter((ticker) => ticker.shortfall);
  const manual = preview.instruments.filter((ticker) => isManual(ticker, choices.get(ticker.ticker)));
  const unchosen = preview.instruments.filter((ticker) => {
    const choice = choices.get(ticker.ticker);
    return choice?.kind === 'other' && !choice.instrument;
  });
  const visible = operations.filter((operation) => filter === 'all' || filterOf(operation) === filter);

  const confirm = useMutation({
    mutationFn: () => confirmFreedom(preview.id, choiceRequest(choices), [...excluded]),
    onSuccess: async (imported) => {
      setResult(imported);
      await Promise.all([
        invalidateLedger(queryClient),
        queryClient.invalidateQueries({ queryKey: investmentKeys.all }),
      ]);
    },
    meta: { errorShown: true },
  });

  const cancel = () => {
    if (!result) discardPreview(preview.id).catch(() => undefined);
    onClose();
  };

  const toggle = (key: string, include: boolean) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (include) next.delete(key);
      else next.add(key);
      return next;
    });

  const held = preview.instruments
    .map((ticker) => ({ ticker, quantity: quantityAfter(ticker, operations, excluded) }))
    .filter((item) => item.quantity > 0);
  const cash = cashAfter(preview.cash, operations, excluded);
  const account = preview.account;

  return (
    <Modal
      opened
      onClose={cancel}
      size={1100}
      title={
        <Stack gap={0}>
          <Text fw={600}>{t(result ? 'imports.result.title' : 'imports.preview.title')}</Text>
          <Text size="xs" c="dimmed">
            {[
              'Freedom Finance',
              account.id == null
                ? t('imports.broker.newAccount', { name: account.name })
                : t('imports.broker.account', { name: account.name }),
              preview.from && preview.to ? `${formatDate(preview.from)} – ${formatDate(preview.to)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </Stack>
      }
    >
      {result ? (
        <ResultView result={result} onClose={onClose} />
      ) : (
        <Stack gap="md">
          <Group gap={6} wrap="wrap">
            <Text fw={600} size="sm" mr={4}>
              {t('imports.broker.operations', { count: importing.length })}
            </Text>
            {(['BUY_SELL', 'EXCHANGE', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL'] as const).map((kind) => {
              const count =
                kind === 'BUY_SELL'
                  ? (counts.get('BUY') ?? 0) + (counts.get('SELL') ?? 0)
                  : kind === 'DIVIDEND'
                    ? (counts.get('DIVIDEND') ?? 0) + (counts.get('COUPON') ?? 0)
                    : (counts.get(kind) ?? 0);
              return count > 0 ? (
                <Badge key={kind} variant="default" style={{ textTransform: 'none' }}>
                  {t(`imports.broker.kinds.${kind}`, { count })}
                </Badge>
              ) : null;
            })}
            {duplicates > 0 && (
              <Badge variant="light" color="gray" style={{ textTransform: 'none' }}>
                {t('imports.broker.duplicates', { count: duplicates })}
              </Badge>
            )}
            {manual.length > 0 && (
              <Badge variant="light" color="yellow" style={{ textTransform: 'none' }}>
                {t('imports.broker.manualCount', { count: manual.length })}
              </Badge>
            )}
          </Group>

          {preview.providerUnavailable && (
            <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />} p="xs">
              {t('imports.broker.providerUnavailable')}
            </Alert>
          )}

          {preview.instruments.length > 0 && (
            <Stack gap={6}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase">
                {t('imports.broker.instruments')}
              </Text>
              <div style={{ overflowX: 'auto' }}>
                <Table verticalSpacing={6} miw={760}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={110}>{t('imports.broker.columns.ticker')}</Table.Th>
                      <Table.Th>{t('imports.broker.columns.instrument')}</Table.Th>
                      <Table.Th w={170}>{t('imports.broker.columns.state')}</Table.Th>
                      <Table.Th w={140} ta="right">
                        {t('imports.broker.columns.after')}
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {preview.instruments.map((ticker) => (
                      <TickerRow
                        key={ticker.ticker}
                        ticker={ticker}
                        quantity={quantityAfter(ticker, operations, excluded)}
                        choice={choices.get(ticker.ticker) ?? { kind: 'suggested' }}
                        onChoice={(choice) =>
                          setChoices((current) => new Map(current).set(ticker.ticker, choice))
                        }
                      />
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            </Stack>
          )}

          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="xs" fw={600} c="dimmed" tt="uppercase">
              {t('imports.broker.rows')}
            </Text>
            <SegmentedControl
              size="xs"
              aria-label={t('imports.preview.filter')}
              value={filter}
              onChange={(value) => setFilter(value as Filter)}
              data={FILTERS.map((value) => ({ value, label: t(`imports.broker.filters.${value}`) }))}
            />
          </Group>
          <ScrollArea.Autosize mah={440} type="auto">
            <Table verticalSpacing={6} miw={960} stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={32}>
                    <Checkbox
                      aria-label={t('imports.preview.selectAll')}
                      checked={fresh.length > 0 && excluded.size === 0}
                      indeterminate={excluded.size > 0 && excluded.size < fresh.length}
                      onChange={(event) =>
                        setExcluded(
                          event.currentTarget.checked
                            ? new Set()
                            : new Set(fresh.map((operation) => operation.key)),
                        )
                      }
                    />
                  </Table.Th>
                  <Table.Th w={100}>{t('imports.broker.columns.date')}</Table.Th>
                  <Table.Th w={150}>{t('imports.broker.columns.type')}</Table.Th>
                  <Table.Th>{t('imports.broker.columns.what')}</Table.Th>
                  <Table.Th w={170} ta="right">
                    {t('imports.broker.columns.quantity')}
                  </Table.Th>
                  <Table.Th w={130} ta="right">
                    {t('imports.broker.columns.cash')}
                  </Table.Th>
                  <Table.Th w={130}>{t('imports.broker.columns.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((operation) => (
                  <OperationRow
                    key={operation.key}
                    operation={operation}
                    included={!excluded.has(operation.key)}
                    onInclude={(include) => toggle(operation.key, include)}
                  />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>

          <Alert color="blue" variant="light" icon={<Info size={16} />} p="xs">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                {t('imports.broker.after', {
                  positions: held.length
                    ? held
                        .map(
                          (item) =>
                            `${item.ticker.ticker} — ${t('imports.broker.units', { count: item.quantity, quantity: formatQuantity(item.quantity) })}`,
                        )
                        .join(', ')
                    : t('imports.broker.noPositions'),
                  cash: cash.map((item) => formatMoney(item.amount, item.currency)).join(', '),
                })}
              </Text>
              <Text size="sm">{t('imports.broker.afterHint')}</Text>
            </Stack>
          </Alert>

          {shortfalls.length > 0 && (
            <Alert color="yellow" variant="light" icon={<TriangleAlert size={16} />} p="xs" role="alert">
              {t('imports.broker.shortfall', {
                tickers: shortfalls.map((ticker) => ticker.ticker).join(', '),
              })}
            </Alert>
          )}
          <ProblemAlert error={confirm.error} />
          <Group justify="space-between" wrap="wrap">
            <Text size="sm" c="dimmed">
              {t('imports.broker.skipped', { count: skipped })}
            </Text>
            <FormFooter
              onCancel={cancel}
              saving={confirm.isPending}
              submitDisabled={importing.length === 0 || unchosen.length > 0}
              submitLabel={t('imports.preview.submit', { count: importing.length })}
              onSubmit={() => confirm.mutate()}
            />
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

function suggestionLabel(suggestion: InstrumentChoice, t: TFunction): string {
  return suggestion.manual
    ? t('imports.broker.createManual', { symbol: suggestion.symbol, currency: suggestion.currency })
    : [suggestion.symbol, suggestion.name, suggestion.exchange, suggestion.currency]
        .filter(Boolean)
        .join(' · ');
}

function TickerRow({
  ticker,
  quantity,
  choice,
  onChoice,
}: {
  ticker: BrokerTicker;
  quantity: number;
  choice: Choice;
  onChoice(choice: Choice): void;
}) {
  const { t } = useTranslation();
  const [currencyError, setCurrencyError] = useState(false);
  const suggestion = ticker.suggestion;
  const data = [
    { value: 'suggested', label: suggestionLabel(suggestion, t) },
    ...(suggestion.manual
      ? []
      : [
          {
            value: 'manual',
            label: t('imports.broker.createManual', { symbol: suggestion.symbol, currency: ticker.currency }),
          },
        ]),
    {
      value: 'other',
      label:
        choice.kind === 'other' && choice.instrument
          ? choice.instrument.label
          : t('imports.broker.otherInstrument'),
    },
  ];
  const manual = isManual(ticker, choice);
  return (
    <>
      <Table.Tr>
        <Table.Td>
          <Text ff="monospace" fw={500} size="sm">
            {ticker.ticker}
          </Text>
        </Table.Td>
        <Table.Td>
          <Select
            size="xs"
            allowDeselect={false}
            aria-label={t('imports.broker.instrumentFor', { ticker: ticker.ticker })}
            data={data}
            value={choice.kind}
            onChange={(value) => onChoice({ kind: (value ?? 'suggested') as Choice['kind'] })}
          />
        </Table.Td>
        <Table.Td>
          {ticker.shortfall ? (
            <Badge color="red" variant="light" style={{ textTransform: 'none' }}>
              {t('imports.broker.state.shortfall')}
            </Badge>
          ) : manual ? (
            <Badge color="yellow" variant="light" style={{ textTransform: 'none' }}>
              {t('imports.broker.state.manual')}
            </Badge>
          ) : (
            <Badge color="green" variant="light" style={{ textTransform: 'none' }}>
              {t(
                choice.kind === 'suggested' && suggestion.instrumentId == null
                  ? 'imports.broker.state.found'
                  : 'imports.broker.state.known',
              )}
            </Badge>
          )}
        </Table.Td>
        <Table.Td ta="right">
          <Text size="sm" className="num" c={quantity > 0 ? undefined : 'dimmed'}>
            {quantity > 0
              ? t('imports.broker.units', { count: quantity, quantity: formatQuantity(quantity) })
              : t('imports.broker.closed')}
          </Text>
        </Table.Td>
      </Table.Tr>
      {choice.kind === 'other' && !choice.instrument && (
        <Table.Tr>
          <Table.Td />
          <Table.Td colSpan={3}>
            <InstrumentPicker
              held={new Map()}
              error={
                currencyError ? t('imports.broker.wrongCurrency', { currency: ticker.currency }) : undefined
              }
              onPick={(instrument) => {
                if (instrument.currency !== ticker.currency) {
                  setCurrencyError(true);
                  return;
                }
                setCurrencyError(false);
                onChoice({
                  kind: 'other',
                  instrument: {
                    id: instrument.id,
                    label: [instrument.symbol, instrument.name, instrument.currency]
                      .filter(Boolean)
                      .join(' · '),
                  },
                });
              }}
              onManual={() => onChoice({ kind: 'manual' })}
            />
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

function OperationRow({
  operation,
  included,
  onInclude,
}: {
  operation: BrokerOperation;
  included: boolean;
  onInclude(include: boolean): void;
}) {
  const { t } = useTranslation();
  const money = (amount: number, currency: string, signed = false) =>
    formatMoney(amount, currency, { signed, decimals: amount !== 0 && Math.abs(amount) < 0.01 ? 4 : 2 });
  const fresh = operation.status === 'NEW';
  const type = operation.type;
  const number = operation.key.split(':')[1];
  let title: string;
  let note: string;
  let quantity = '—';
  let cash = money(operation.cash, operation.currency, true);
  switch (type) {
    case 'BUY':
    case 'SELL':
      title = operation.ticker ?? '';
      note = [
        operation.fee > 0
          ? t('imports.broker.notes.fee', { fee: money(operation.fee, operation.currency) })
          : null,
        t('imports.broker.notes.trade', { number }),
      ]
        .filter(Boolean)
        .join(' · ');
      quantity = `${formatQuantity(operation.quantity ?? 0)} × ${money(operation.price ?? 0, operation.currency)}`;
      break;
    case 'DIVIDEND':
    case 'COUPON':
      title = operation.ticker ?? '';
      note =
        operation.tax > 0
          ? t('imports.broker.notes.tax', { tax: money(operation.tax, operation.currency) })
          : '';
      break;
    case 'EXCHANGE':
      title = `${operation.currency} → ${operation.toCurrency}`;
      note = t('imports.broker.notes.rate', {
        rate: new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(
          operation.toAmount! / operation.amount,
        ),
      });
      quantity = money(operation.amount + operation.fee, operation.currency);
      cash = money(operation.toAmount!, operation.toCurrency!, true);
      break;
    case null:
    case undefined:
      title = t(`imports.broker.skip.${operation.skip ?? 'UNKNOWN'}`);
      note = operation.description;
      cash = operation.currency ? money(operation.amount, operation.currency, true) : '';
      break;
    default:
      title = t(`investments.operationTypes.${type}`);
      note = operation.description;
  }
  const amount = type === 'EXCHANGE' ? operation.toAmount! : operation.cash;
  return (
    <Table.Tr style={{ opacity: fresh && included ? 1 : 0.55 }}>
      <Table.Td>
        <Checkbox
          aria-label={t('imports.broker.include', { what: title, date: formatDate(operation.date) })}
          checked={fresh && included}
          disabled={!fresh}
          onChange={(event) => onInclude(event.currentTarget.checked)}
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm" c="dimmed" className="num">
          {formatDate(operation.date)}
        </Text>
      </Table.Td>
      <Table.Td>
        {type ? (
          <Badge variant="light" color={OPERATION_COLORS[type]} style={{ textTransform: 'none' }}>
            {t(`investments.operationTypes.${type}`)}
          </Badge>
        ) : (
          <Badge variant="outline" color="gray" style={{ textTransform: 'none' }}>
            {t('imports.broker.skip.badge')}
          </Badge>
        )}
      </Table.Td>
      <Table.Td style={{ maxWidth: 0 }}>
        <Text size="sm" fw={500} truncate>
          {title}
        </Text>
        {note && (
          <Text size="xs" c="dimmed" truncate title={note}>
            {note}
          </Text>
        )}
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" c="dimmed" className="num">
          {quantity}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Text size="sm" fw={500} className={`num ${!type ? 'muted' : amount < 0 ? 'expense' : 'income'}`}>
          {cash}
        </Text>
      </Table.Td>
      <Table.Td>
        <Badge
          variant="light"
          color={operation.status === 'NEW' ? 'blue' : 'gray'}
          style={{ textTransform: 'none' }}
        >
          {t(`imports.broker.status.${operation.status}`)}
        </Badge>
      </Table.Td>
    </Table.Tr>
  );
}

function ResultView({ result, onClose }: { result: BrokerImportResult; onClose(): void }) {
  const { t } = useTranslation();
  const stats = [
    ['operationsImported', result.operationsImported],
    ['duplicates', result.duplicates],
    ['instrumentsCreated', result.instrumentsCreated],
    ['accountsCreated', result.accountCreated ? 1 : 0],
  ] as const;
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {stats.map(([key, value]) => (
          <Stack key={key} gap={2} p="sm" style={{ border: '1px solid var(--ww-border)', borderRadius: 8 }}>
            <Text className="num" fz={22} fw={600}>
              {value}
            </Text>
            <Text size="xs" c="dimmed">
              {t(`imports.broker.result.${key}`)}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t('imports.result.close')}
        </Button>
        <Button component={Link} to={`/investments?accountId=${result.accountId}`} onClick={onClose}>
          {t('imports.broker.result.toInvestments')}
        </Button>
      </Group>
    </Stack>
  );
}
