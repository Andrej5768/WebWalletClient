import {
  ActionIcon,
  Center,
  Drawer,
  Group,
  Loader,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { toProblem } from '../../api/errors';
import { check, unwrap } from '../../api/http';
import { invalidateLedger, useAccounts } from '../../api/queries';
import { confirmDelete } from '../../components/confirm';
import { ProblemAlert } from '../../components/feedback';
import { FormFooter } from '../../components/FormFooter';
import { MoneyInput } from '../../components/MoneyInput';
import { formatDay } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import {
  investmentKeys,
  isBrokerage,
  useInstrument,
  usePortfolio,
  usePosition,
  type Operation,
  type OperationType,
} from '../api';
import { InstrumentModal } from '../instrument/InstrumentModal';
import {
  cashChange,
  fifoPreview,
  formErrors,
  INCOMES,
  initialOperationValues,
  toNumber,
  toOperationBody,
  tradeAmount,
  TRADES,
  type OperationValues,
} from './form';
import { InstrumentPicker } from './InstrumentPicker';
import classes from './operations.module.css';

const TYPES: OperationType[] = ['BUY', 'SELL', 'DIVIDEND', 'COUPON', 'FEE', 'SPLIT'];
const FIELDS = [
  'type',
  'accountId',
  'instrumentId',
  'date',
  'quantity',
  'price',
  'fee',
  'amount',
  'tax',
  'currency',
  'splitFrom',
  'splitTo',
  'comment',
];

interface Props {
  operationId: number | null;
  accountId?: number;
  instrumentId?: number;
  /** The type a new operation starts with. */
  type?: OperationType;
  onClose(): void;
}

/** Side panel to record or edit an operation of a brokerage account; see {@link OperationDrawerFromUrl}. */
export function OperationDrawer({ operationId, accountId, instrumentId, type, onClose }: Props) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const operation = useQuery({
    queryKey: [...investmentKeys.all, 'operation', operationId],
    queryFn: () =>
      unwrap(api.GET('/api/v1/investments/operations/{id}', { params: { path: { id: operationId! } } })),
    enabled: operationId !== null,
  });
  const ready = accounts.isSuccess && (operationId === null || operation.isSuccess);
  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={560}
      title={<Text fw={600}>{t(operationId ? 'invOperations.editTitle' : 'invOperations.newTitle')}</Text>}
    >
      {ready ? (
        <OperationForm
          operation={operation.data ?? null}
          defaults={{
            accountId,
            instrumentId,
            type,
          }}
          onClose={onClose}
        />
      ) : (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
    </Drawer>
  );
}

function OperationForm({
  operation,
  defaults,
  onClose,
}: {
  operation: Operation | null;
  defaults: { accountId?: number; instrumentId?: number; type?: OperationType };
  onClose(): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const portfolio = usePortfolio();
  const [manual, setManual] = useState(false);
  const form = useForm<OperationValues>({
    initialValues: initialOperationValues(operation, defaults),
    validate: {
      accountId: (value) => (value ? null : t('validation.required')),
      instrumentId: (value, values) => (value || values.type === 'FEE' ? null : t('validation.required')),
      date: (value) => (value ? null : t('validation.required')),
      quantity: (value, values) =>
        TRADES.includes(values.type) && !(toNumber(value) > 0) ? t('invOperations.positive') : null,
      price: (value, values) =>
        TRADES.includes(values.type) && value === '' ? t('validation.required') : null,
      amount: (value, values) =>
        !TRADES.includes(values.type) && values.type !== 'SPLIT' && !(toNumber(value) > 0)
          ? t('invOperations.positive')
          : null,
      splitTo: (value, values) =>
        values.type === 'SPLIT' && !(toNumber(value) > 0) ? t('invOperations.positive') : null,
    },
  });
  const values = form.values;
  const accountNumber = values.accountId ? Number(values.accountId) : undefined;
  const instrumentNumber = values.instrumentId ? Number(values.instrumentId) : undefined;
  const instrument = useInstrument(instrumentNumber);
  const position = usePosition(
    values.type === 'SELL' ? accountNumber : undefined,
    values.type === 'SELL' ? instrumentNumber : undefined,
  );

  const brokerage = (accounts.data ?? []).filter(
    (account) => isBrokerage(account) && (!account.archived || account.id === operation?.accountId),
  );
  const cashLabel = (accountId: number) =>
    (portfolio.data?.cash ?? [])
      .filter((row) => row.accountId === accountId && row.amount !== 0)
      .map((row) => formatMoney(row.amount, row.currency))
      .join(' · ');
  const held = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of portfolio.data?.positions ?? []) {
      if (!accountNumber || row.accountId === accountNumber) {
        map.set(row.instrument.id, (map.get(row.instrument.id) ?? 0) + row.quantity);
      }
    }
    return map;
  }, [portfolio.data, accountNumber]);

  const accountCurrency = brokerage.find((account) => String(account.id) === values.accountId)?.currency;
  const currency =
    values.currency ??
    (values.type === 'FEE' ? accountCurrency : instrument.data?.currency) ??
    accountCurrency ??
    'USD';
  const government = instrument.data?.type === 'GOVERNMENT_BOND';

  const save = useMutation({
    mutationFn: (input: OperationValues) => {
      const body = toOperationBody(input);
      return check(
        operation
          ? api.PUT('/api/v1/investments/operations/{id}', { params: { path: { id: operation.id } }, body })
          : api.POST('/api/v1/investments/operations', { body }),
      );
    },
    onSuccess: async () => {
      await invalidateLedger(queryClient);
      onClose();
    },
    onError: (error) => form.setErrors(formErrors(toProblem(error))),
  });
  const remove = useMutation({
    mutationFn: () =>
      check(api.DELETE('/api/v1/investments/operations/{id}', { params: { path: { id: operation!.id } } })),
    onSuccess: async () => {
      await invalidateLedger(queryClient);
      onClose();
    },
    meta: { errorShown: true },
  });

  const trade = TRADES.includes(values.type);
  const income = INCOMES.includes(values.type);
  const preview =
    values.type === 'SELL' && position.data && toNumber(values.quantity) > 0
      ? fifoPreview(
          position.data,
          toNumber(values.quantity),
          toNumber(values.price),
          toNumber(values.fee),
          operation ? position.data.sales.find((sale) => sale.operationId === operation.id) : undefined,
        )
      : null;
  // A sale picks one of the positions of the account: only what is held can be sold
  const sellable = (portfolio.data?.positions ?? []).filter(
    (row) => row.quantity > 0 && (!accountNumber || row.accountId === accountNumber),
  );
  // A new quantity or price makes the amount quantity × price again
  const tradeInput = (field: 'quantity' | 'price') => ({
    ...form.getInputProps(field),
    onChange: (value: number | string) => {
      form.setFieldValue(field, value);
      form.setFieldValue('amount', '');
    },
  });

  return (
    <>
      <form onSubmit={form.onSubmit((input) => save.mutate(input))} noValidate>
        <Stack gap="md">
          <SegmentedControl
            aria-label={t('invOperations.type')}
            value={values.type}
            onChange={(value) => {
              form.setFieldValue('type', value as OperationType);
              form.clearErrors();
            }}
            data={TYPES.map((value) => ({ value, label: t(`investments.operationTypes.${value}`) }))}
            fullWidth
          />
          <Select
            label={t('invOperations.account')}
            allowDeselect={false}
            data={brokerage.map((account) => ({
              value: String(account.id),
              label: [account.name, cashLabel(account.id)].filter(Boolean).join(' · '),
            }))}
            {...form.getInputProps('accountId')}
          />
          {values.type !== 'FEE' &&
            (values.instrumentId ? (
              <div className={classes.chosen}>
                <span className={classes.ticker}>{instrument.data?.symbol ?? '…'}</span>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={500} truncate>
                    {instrument.data?.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {[
                      instrument.data?.exchange,
                      instrument.data?.currency,
                      instrumentNumber && held.get(instrumentNumber)
                        ? t('invOperations.held', { count: held.get(instrumentNumber) })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </div>
                {!operation ? (
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label={t('invOperations.changeInstrument')}
                    onClick={() => {
                      form.setFieldValue('instrumentId', null);
                      form.setFieldValue('currency', null);
                    }}
                  >
                    <X size={16} />
                  </ActionIcon>
                ) : (
                  <span />
                )}
              </div>
            ) : values.type === 'SELL' ? (
              <Select
                label={t('invOperations.position')}
                placeholder={t('invOperations.positionPlaceholder')}
                nothingFoundMessage={t('invOperations.noPositions')}
                searchable
                data={sellable.map((row) => ({
                  value: String(row.instrument.id),
                  label: `${row.instrument.symbol} · ${row.instrument.name} · ${t('invOperations.held', {
                    count: row.quantity,
                  })}`,
                }))}
                error={form.errors.instrumentId}
                onChange={(value) => {
                  const picked = sellable.find((row) => String(row.instrument.id) === value);
                  form.setFieldValue('instrumentId', value);
                  form.setFieldValue('currency', picked?.instrument.currency ?? null);
                }}
              />
            ) : (
              <InstrumentPicker
                held={held}
                error={form.errors.instrumentId as string | undefined}
                onPick={(picked) => {
                  form.setFieldValue('instrumentId', String(picked.id));
                  form.setFieldValue('currency', picked.currency);
                }}
                onManual={() => setManual(true)}
              />
            ))}

          <SimpleGrid cols={2}>
            <DateInput
              label={t('invOperations.date')}
              valueFormat="DD.MM.YYYY"
              {...form.getInputProps('date')}
            />
            {trade && (
              <NumberInput
                label={t('invOperations.quantity')}
                min={0}
                decimalScale={8}
                {...tradeInput('quantity')}
              />
            )}
            {trade && (
              <MoneyInput
                label={t('invOperations.price')}
                decimalScale={6}
                currency={currency}
                {...tradeInput('price')}
              />
            )}
            {trade && (
              <MoneyInput label={t('invOperations.fee')} currency={currency} {...form.getInputProps('fee')} />
            )}
            {income && (
              <MoneyInput
                label={t('invOperations.gross')}
                currency={currency}
                {...form.getInputProps('amount')}
              />
            )}
            {income && (
              <MoneyInput
                label={t('invOperations.tax')}
                description={t(government ? 'invOperations.taxGovernment' : 'invOperations.taxHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                currency={currency}
                {...form.getInputProps('tax')}
              />
            )}
            {values.type === 'FEE' && (
              <MoneyInput
                label={t('invOperations.feeAmount')}
                currency={currency}
                {...form.getInputProps('amount')}
              />
            )}
            {values.type === 'SPLIT' && (
              <NumberInput
                label={t('invOperations.splitFrom')}
                min={1}
                allowDecimal={false}
                {...form.getInputProps('splitFrom')}
              />
            )}
            {values.type === 'SPLIT' && (
              <NumberInput
                label={t('invOperations.splitTo')}
                min={1}
                allowDecimal={false}
                {...form.getInputProps('splitTo')}
              />
            )}
          </SimpleGrid>
          {values.type === 'SPLIT' && (
            <Text size="sm" c="dimmed">
              {t('invOperations.splitHint')}
            </Text>
          )}
          {values.type === 'FEE' && (
            <Text size="sm" c="dimmed">
              {t('invOperations.feeHint')}
            </Text>
          )}

          {preview && (
            <div className={classes.preview}>
              <Text size="sm" fw={600} mb={6}>
                {t('invOperations.fifoTitle')}
              </Text>
              <Stack gap={4}>
                {preview.parts.map((part) => (
                  <div key={part.operationId} className={classes.previewRow}>
                    <span>{t('invOperations.lotOf', { date: formatDay(part.date) })}</span>
                    <span className="num">
                      {t('invOperations.lotTaken', {
                        quantity: part.quantity,
                        cost: formatMoney(part.unitCost, currency),
                      })}
                    </span>
                    <span className="num">{formatMoney(part.quantity * part.unitCost, currency)}</span>
                  </div>
                ))}
              </Stack>
              {preview.missing > 0 ? (
                <Text size="sm" c="red" mt={6} role="alert">
                  {t('invOperations.notEnough', { count: preview.missing })}
                </Text>
              ) : (
                <Stack gap={2} mt={8}>
                  <Group justify="space-between">
                    <Text size="sm">{t('invOperations.realized')}</Text>
                    <Text size="sm" fw={600} className={`num ${preview.realized < 0 ? 'expense' : 'income'}`}>
                      {formatMoney(preview.realized, currency, { signed: true })}
                    </Text>
                  </Group>
                  {preview.realizedByAverage != null && (
                    <Group justify="space-between">
                      <Text size="xs" c="dimmed">
                        {t('invOperations.byAverage')}
                      </Text>
                      <Text size="xs" c="dimmed" className="num">
                        {formatMoney(preview.realizedByAverage, currency, { signed: true })}
                      </Text>
                    </Group>
                  )}
                </Stack>
              )}
            </div>
          )}

          {values.type !== 'SPLIT' && (
            <div className={classes.total}>
              <Stack gap={0}>
                <Text size="sm" fw={500}>
                  {trade ? t('invOperations.total') : t('invOperations.credited')}
                </Text>
                <Text size="xs" c="dimmed">
                  {t('invOperations.cashChange')}
                </Text>
              </Stack>
              <Stack gap={0} align="flex-end">
                <Text className="num" fw={600} data-testid="operation-total">
                  {formatMoney(
                    trade
                      ? tradeAmount(values)
                      : toNumber(values.amount) - (income ? toNumber(values.tax) : 0),
                    currency,
                  )}
                </Text>
                <Text
                  size="xs"
                  className={`num ${cashChange(values) < 0 ? 'expense' : cashChange(values) > 0 ? 'income' : 'muted'}`}
                >
                  {formatMoney(cashChange(values), currency, { signed: true })}
                </Text>
              </Stack>
            </div>
          )}
          <Textarea
            label={t('invOperations.comment')}
            autosize
            minRows={1}
            {...form.getInputProps('comment')}
          />
          <ProblemAlert error={save.error ?? remove.error} fieldsShown={FIELDS} />
          <FormFooter
            onCancel={onClose}
            saving={save.isPending}
            deleting={remove.isPending}
            onDelete={
              operation
                ? () =>
                    confirmDelete({
                      title: t('invOperations.deleteTitle'),
                      onConfirm: () => remove.mutate(),
                    })
                : undefined
            }
          />
        </Stack>
      </form>
      {manual && (
        <InstrumentModal
          instrument={null}
          onClose={() => setManual(false)}
          onSaved={(saved) => {
            form.setFieldValue('instrumentId', String(saved.id));
            form.setFieldValue('currency', saved.currency);
          }}
        />
      )}
    </>
  );
}
