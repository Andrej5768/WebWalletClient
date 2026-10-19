import {
  Autocomplete,
  Badge,
  Button,
  Center,
  Checkbox,
  Drawer,
  Group,
  Loader,
  NumberInput,
  Radio,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { toProblem } from '../api/errors';
import { check } from '../api/http';
import {
  invalidateLedger,
  useAccounts,
  useBaseCurrency,
  useCategories,
  useCategoriesById,
  usePayees,
} from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { confirmDelete } from '../components/confirm';
import { Figure } from '../components/Figure';
import { ProblemAlert } from '../components/feedback';
import { MoneyInput } from '../components/MoneyInput';
import { categorySelectData } from '../lib/categories';
import { ratesFromAccounts } from '../lib/currencies';
import { formatDayShort } from '../lib/format';
import { formatMoney } from '../lib/money';
import { isoDate, kyivToday } from '../lib/periods';
import { locale } from '../i18n';
import { formErrors } from '../transactions/form';
import {
  requestOf,
  useRecurringPayments,
  type Frequency,
  type Recurring,
  type RecurringRequest,
} from './api';
import classes from './recurring.module.css';
import { alignedStart, endDateForCount, nextDates, perMonth, scheduleText } from './schedule';

const FREQUENCIES: Frequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const TOLERANCES = [0, 10, 25];
/** Weekdays from Monday, as dayjs numbers them (0 = Sunday). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
/** A Monday, to name the weekdays from. */
const A_MONDAY = '2024-01-01';

/** `list`, `new` or the id of a recurring payment to edit. */
export type RecurringView = 'list' | 'new' | number;

/** Side panel with the recurring payments and the editor of one. */
export function RecurringDrawer({
  view,
  onView,
  onClose,
}: {
  view: RecurringView;
  onView(view: RecurringView): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const recurring = useRecurringPayments();
  const accounts = useAccounts();
  const ready = recurring.isSuccess && accounts.isSuccess;
  const editing = typeof view === 'number' ? recurring.data?.find((item) => item.id === view) : undefined;
  const title =
    view === 'list'
      ? t('recurring.title')
      : view === 'new'
        ? t('recurring.form.newTitle')
        : t('recurring.form.editTitle');
  return (
    <Drawer opened onClose={onClose} position="right" size={560} title={<Text fw={600}>{title}</Text>}>
      {!ready ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : view === 'list' ? (
        <RecurringList payments={recurring.data} onView={onView} />
      ) : (
        <RecurringForm key={String(view)} recurring={editing ?? null} onDone={() => onView('list')} />
      )}
    </Drawer>
  );
}

function RecurringList({ payments, onView }: { payments: Recurring[]; onView(view: RecurringView): void }) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const baseCurrency = useBaseCurrency();
  const categoriesById = useCategoriesById();
  const accountName = (id: number) => accounts.data?.find((account) => account.id === id)?.name ?? '';
  const today = isoDate(kyivToday());
  const active = payments.filter((item) => item.nextDate !== null);
  const stopped = payments.filter((item) => item.nextDate === null);

  const rates = ratesFromAccounts(accounts.data ?? [], baseCurrency);
  /** One total in the base currency at today's rates, with the amounts per currency for the tooltip. */
  const monthly = (type: Recurring['type']) => {
    const byCurrency = new Map<string, number>();
    for (const item of active.filter((payment) => payment.type === type)) {
      byCurrency.set(item.currency, (byCurrency.get(item.currency) ?? 0) + item.amount * perMonth(item));
    }
    const breakdown = [...byCurrency].map(([currency, amount]) => formatMoney(amount, currency)).join(' · ');
    const unknown = [...byCurrency.keys()].some((currency) => !rates.has(currency));
    if (unknown) return { value: breakdown, breakdown: null };
    const total = [...byCurrency].reduce((sum, [currency, amount]) => sum + amount * rates.get(currency)!, 0);
    const mixed = byCurrency.size > 1 || (byCurrency.size === 1 && !byCurrency.has(baseCurrency));
    return { value: formatMoney(total, baseCurrency), breakdown: mixed ? breakdown : null };
  };
  const figure = (label: string, type: Recurring['type']) => {
    const { value, breakdown } = monthly(type);
    const card = <Figure label={label} value={value} note={breakdown ?? undefined} />;
    return breakdown ? (
      <Tooltip label={breakdown} withArrow>
        <div>{card}</div>
      </Tooltip>
    ) : (
      card
    );
  };

  const row = (item: Recurring) => {
    const category = item.categoryId ? categoriesById.get(item.categoryId) : undefined;
    const signed = item.type === 'EXPENSE' ? -item.amount : item.amount;
    return (
      <UnstyledButton key={item.id} className={classes.series} onClick={() => onView(item.id)}>
        <CategoryIcon icon={category?.icon} color={category?.color} transfer={item.type === 'TRANSFER'} />
        <div style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text fw={500} truncate>
              {item.name}
            </Text>
            {item.autoCreate && (
              <Badge size="xs" variant="light" color="gray" style={{ textTransform: 'none' }}>
                {t('recurring.list.auto')}
              </Badge>
            )}
            {item.nextDate !== null && item.nextDate < today && (
              <Badge size="xs" variant="light" color="yellow" style={{ textTransform: 'none' }}>
                {t('recurring.list.unconfirmed')}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" truncate>
            {scheduleText(item, t)} · {accountName(item.accountId)}
            {item.nextDate
              ? ` · ${t('recurring.list.next', { date: formatDayShort(item.nextDate) })}`
              : item.endDate
                ? ` · ${t('recurring.list.stoppedOn', { date: formatDayShort(item.endDate) })}`
                : ''}
          </Text>
        </div>
        <Text
          className={`num ${item.type === 'TRANSFER' ? 'muted' : signed < 0 ? 'expense' : 'income'}`}
          fw={500}
        >
          {item.variableAmount && '≈ '}
          {formatMoney(signed, item.currency, { signed: item.type !== 'TRANSFER' })}
        </Text>
      </UnstyledButton>
    );
  };

  return (
    <Stack gap="md">
      <SimpleGrid cols={3} spacing="sm">
        {figure(t('recurring.list.monthlyOut'), 'EXPENSE')}
        {figure(t('recurring.list.monthlyIn'), 'INCOME')}
        <Figure label={t('recurring.list.active')} value={String(active.length)} />
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {t('recurring.list.monthlyHint')}
      </Text>
      <Button
        leftSection={<Plus size={16} />}
        variant="light"
        onClick={() => onView('new')}
        style={{ alignSelf: 'flex-start' }}
      >
        {t('recurring.list.add')}
      </Button>
      {payments.length === 0 && (
        <Text size="sm" c="dimmed">
          {t('recurring.list.empty')}
        </Text>
      )}
      <Stack gap={0}>{active.map(row)}</Stack>
      {stopped.length > 0 && (
        <Stack gap={0}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" px={8} pb={4}>
            {t('recurring.list.stopped')}
          </Text>
          {stopped.map(row)}
        </Stack>
      )}
    </Stack>
  );
}

interface FormValues {
  type: Recurring['type'];
  name: string;
  amount: number | string;
  variableAmount: boolean;
  accountId: string | null;
  toAccountId: string | null;
  toAmount: number | string;
  categoryId: string | null;
  payee: string;
  frequency: Frequency;
  interval: number | string;
  /** The first payment, or for a weekly or yearly schedule the date from which it is looked for. */
  startDate: string | null;
  /** The day of a weekly schedule, 0 = Sunday. */
  weekday: string;
  /** The month (1-based) and the day of a yearly schedule. */
  month: string;
  day: number | string;
  end: 'never' | 'date' | 'count';
  endDate: string | null;
  count: number | string;
  autoCreate: boolean;
  tolerance: string;
}

function initialValues(recurring: Recurring | null): FormValues {
  const today = isoDate(kyivToday());
  const start = dayjs(recurring?.startDate ?? today);
  return {
    type: recurring?.type ?? 'EXPENSE',
    name: recurring?.name ?? '',
    amount: recurring?.amount ?? '',
    variableAmount: recurring?.variableAmount ?? false,
    accountId: recurring ? String(recurring.accountId) : null,
    toAccountId: recurring?.toAccountId ? String(recurring.toAccountId) : null,
    toAmount: recurring?.toAccountId ? (recurring.toAmount ?? '') : '',
    categoryId: recurring?.categoryId ? String(recurring.categoryId) : null,
    payee: recurring?.payee?.name ?? '',
    frequency: recurring?.frequency ?? 'MONTHLY',
    interval: recurring?.interval ?? 1,
    startDate: recurring?.startDate ?? today,
    weekday: String(start.day()),
    month: String(start.month() + 1),
    day: start.date(),
    end: recurring?.endDate ? 'date' : 'never',
    endDate: recurring?.endDate ?? null,
    count: 12,
    autoCreate: recurring?.autoCreate ?? false,
    tolerance: String(recurring?.tolerance ?? 10),
  };
}

/** The first payment: on the weekday or the date of the year on or after the chosen date. */
function firstDate(values: FormValues): string {
  return alignedStart(values.startDate!, values.frequency, {
    weekday: Number(values.weekday),
    month: Number(values.month),
    day: Number(values.day) || 1,
  });
}

/** Days of the month, the 29th of February included. */
function daysInMonth(month: string): number {
  return dayjs(`2024-${month.padStart(2, '0')}-01`).daysInMonth();
}

function toRequest(values: FormValues): RecurringRequest {
  const transfer = values.type === 'TRANSFER';
  const interval = Number(values.interval) || 1;
  const startDate = firstDate(values);
  const endDate =
    values.end === 'date'
      ? (values.endDate ?? undefined)
      : values.end === 'count'
        ? endDateForCount(startDate, values.frequency, interval, Number(values.count) || 1)
        : undefined;
  return {
    name: values.name.trim(),
    type: values.type,
    accountId: Number(values.accountId),
    amount: Number(values.amount),
    toAccountId: transfer ? Number(values.toAccountId) : undefined,
    toAmount: transfer && values.toAmount !== '' ? Number(values.toAmount) : undefined,
    categoryId: !transfer && values.categoryId ? Number(values.categoryId) : undefined,
    payeeName: transfer ? undefined : values.payee.trim() || undefined,
    frequency: values.frequency,
    interval,
    startDate,
    endDate,
    autoCreate: values.autoCreate,
    variableAmount: values.variableAmount,
    tolerance: Number(values.tolerance),
  };
}

function RecurringForm({ recurring, onDone }: { recurring: Recurring | null; onDone(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const today = isoDate(kyivToday());

  const form = useForm<FormValues>({
    initialValues: initialValues(recurring),
    validate: {
      name: (value) => (value.trim() ? null : t('validation.required')),
      amount: (value) => (Number(value) > 0 ? null : t('transactions.form.amountRequired')),
      accountId: (value) => (value ? null : t('validation.required')),
      toAccountId: (value, values) =>
        values.type !== 'TRANSFER' || (value && value !== values.accountId)
          ? null
          : t('transactions.form.toAccountRequired'),
      startDate: (value) => (value ? null : t('validation.required')),
      day: (value, values) =>
        values.frequency !== 'YEARLY' || (Number(value) >= 1 && Number(value) <= daysInMonth(values.month))
          ? null
          : t('recurring.form.badDay'),
      endDate: (value, values) =>
        values.end !== 'date' || (value && values.startDate && value >= firstDate(values))
          ? null
          : t('recurring.form.endBeforeStart'),
    },
  });
  const values = form.values;

  const done = async () => {
    await invalidateLedger(queryClient);
    onDone();
  };
  const save = useMutation({
    mutationFn: (input: FormValues) => {
      // PUT replaces every field: what the form does not show (the comment) is kept; the payee goes by the name
      const body = recurring
        ? { ...requestOf(recurring), payeeId: undefined, ...toRequest(input) }
        : toRequest(input);
      return check(
        recurring
          ? api.PUT('/api/v1/recurring/{id}', { params: { path: { id: recurring.id } }, body })
          : api.POST('/api/v1/recurring', { body }),
      );
    },
    onSuccess: done,
    onError: (error) => form.setErrors(formErrors(toProblem(error))),
  });
  // Stopping ends the schedule yesterday: future payments disappear, past operations stay.
  const stop = useMutation({
    mutationFn: () => {
      const yesterday = isoDate(kyivToday().subtract(1, 'day'));
      return check(
        api.PUT('/api/v1/recurring/{id}', {
          params: { path: { id: recurring!.id } },
          body: requestOf(recurring!, {
            endDate: yesterday < recurring!.startDate ? recurring!.startDate : yesterday,
          }),
        }),
      );
    },
    onSuccess: done,
    meta: { errorShown: true },
  });
  const remove = useMutation({
    mutationFn: () =>
      check(api.DELETE('/api/v1/recurring/{id}', { params: { path: { id: recurring!.id } } })),
    onSuccess: done,
    meta: { errorShown: true },
  });

  const accountData = (accounts.data ?? [])
    .filter((account) => !account.archived || String(account.id) === values.accountId)
    .map((account) => ({ value: String(account.id), label: account.name }));
  const account = accounts.data?.find((item) => String(item.id) === values.accountId);
  const toAccount = accounts.data?.find((item) => String(item.id) === values.toAccountId);
  const interval = Number(values.interval) || 1;
  const schedule = values.startDate ? toRequest({ ...values, accountId: values.accountId ?? '0' }) : null;
  const preview = schedule ? nextDates({ ...schedule, interval }, today, 4) : [];
  const anchored = values.frequency === 'WEEKLY' || values.frequency === 'YEARLY';
  const matchDays = Math.min(
    5,
    Math.floor(({ DAILY: 1, WEEKLY: 7, MONTHLY: 30, YEARLY: 365 }[values.frequency] * interval - 1) / 2),
  );
  const kind = values.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const running = recurring !== null && recurring.nextDate !== null && recurring.startDate < today;

  return (
    <form onSubmit={form.onSubmit((input) => save.mutate(input))} noValidate>
      <Stack gap="md">
        <SegmentedControl
          aria-label={t('transactions.filters.type')}
          style={{ alignSelf: 'flex-start' }}
          value={values.type}
          onChange={(value) => {
            form.setFieldValue('type', value as FormValues['type']);
            form.setFieldValue('categoryId', null);
          }}
          data={(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((value) => ({
            value,
            label: t(`transactions.form.types.${value}`),
          }))}
        />
        <TextInput label={t('recurring.form.name')} data-autofocus {...form.getInputProps('name')} />
        <SimpleGrid cols={2}>
          <MoneyInput
            label={t('recurring.form.amount')}
            currency={account?.currency}
            {...form.getInputProps('amount')}
          />
          <Select
            label={t(
              values.type === 'TRANSFER' ? 'transactions.form.fromAccount' : 'transactions.form.account',
            )}
            searchable
            data={accountData}
            {...form.getInputProps('accountId')}
          />
          {values.type === 'TRANSFER' ? (
            <>
              <Select
                label={t('transactions.form.toAccount')}
                searchable
                data={accountData.filter((item) => item.value !== values.accountId)}
                {...form.getInputProps('toAccountId')}
              />
              {toAccount && account && toAccount.currency !== account.currency && (
                <MoneyInput
                  label={t('transactions.form.toAmount')}
                  currency={toAccount.currency}
                  {...form.getInputProps('toAmount')}
                />
              )}
            </>
          ) : (
            <>
              <Select
                label={t('transactions.form.category')}
                searchable
                clearable
                placeholder={t('transactions.uncategorized')}
                data={categorySelectData(categories.data ?? [], kind)}
                {...form.getInputProps('categoryId')}
              />
              <Autocomplete
                label={t('transactions.form.payee')}
                data={[...new Set((payees.data ?? []).map((payee) => payee.name))]}
                limit={8}
                {...form.getInputProps('payee')}
              />
            </>
          )}
        </SimpleGrid>
        <Checkbox
          label={t('recurring.form.variableAmount')}
          {...form.getInputProps('variableAmount', { type: 'checkbox' })}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            form.setFieldValue('variableAmount', checked);
            form.setFieldValue('tolerance', checked ? '25' : '10');
          }}
        />

        <Stack gap="xs">
          <Text size="sm" fw={500}>
            {t('recurring.form.schedule')}
          </Text>
          <Group gap="sm" align="flex-end">
            <NumberInput
              label={t('recurring.form.every')}
              w={90}
              min={1}
              max={365}
              allowDecimal={false}
              {...form.getInputProps('interval')}
            />
            <SegmentedControl
              aria-label={t('recurring.form.unit')}
              value={values.frequency}
              onChange={(value) => form.setFieldValue('frequency', value as Frequency)}
              data={FREQUENCIES.map((value) => ({
                value,
                label: t(`recurring.form.units.${value}`, { count: interval }),
              }))}
            />
          </Group>
          {values.frequency === 'WEEKLY' && (
            <Stack gap={4}>
              <Text size="sm" fw={500} id="recurring-weekday">
                {t('recurring.form.weekday')}
              </Text>
              <SegmentedControl
                aria-labelledby="recurring-weekday"
                style={{ alignSelf: 'flex-start' }}
                value={values.weekday}
                onChange={(value) => form.setFieldValue('weekday', value)}
                data={WEEKDAYS.map((weekday, index) => ({
                  value: String(weekday),
                  label: dayjs(A_MONDAY)
                    .add(index, 'day')
                    .toDate()
                    .toLocaleDateString(locale(), { weekday: 'short' }),
                }))}
              />
            </Stack>
          )}
          {values.frequency === 'YEARLY' && (
            <Group gap="sm" align="flex-start">
              <NumberInput
                label={t('recurring.form.yearDay')}
                w={90}
                min={1}
                max={daysInMonth(values.month)}
                allowDecimal={false}
                {...form.getInputProps('day')}
              />
              <Select
                label={t('recurring.form.yearMonth')}
                w={160}
                allowDeselect={false}
                data={Array.from({ length: 12 }, (_, index) => ({
                  value: String(index + 1),
                  label: new Date(2024, index, 1).toLocaleDateString(locale(), { month: 'long' }),
                }))}
                {...form.getInputProps('month')}
              />
            </Group>
          )}
          <DateInput
            label={t(anchored ? 'recurring.form.startFrom' : 'recurring.form.startDate')}
            description={
              values.frequency === 'MONTHLY'
                ? t('recurring.form.shortMonths')
                : anchored && schedule && schedule.startDate !== values.startDate
                  ? t('recurring.form.firstPayment', { date: formatDayShort(schedule.startDate) })
                  : undefined
            }
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            valueFormat="DD.MM.YYYY"
            {...form.getInputProps('startDate')}
          />
          <Radio.Group
            label={t('recurring.form.end')}
            value={values.end}
            onChange={(value) => form.setFieldValue('end', value as FormValues['end'])}
          >
            <Group gap="md" mt={4}>
              <Radio value="never" label={t('recurring.form.endNever')} />
              <Radio value="date" label={t('recurring.form.endDate')} />
              <Radio value="count" label={t('recurring.form.endCount')} />
            </Group>
          </Radio.Group>
          {values.end === 'date' && (
            <DateInput
              aria-label={t('recurring.form.endDateLabel')}
              valueFormat="DD.MM.YYYY"
              w={200}
              {...form.getInputProps('endDate')}
            />
          )}
          {values.end === 'count' && (
            <NumberInput
              aria-label={t('recurring.form.countLabel')}
              w={120}
              min={1}
              allowDecimal={false}
              {...form.getInputProps('count')}
            />
          )}
          {preview.length > 0 && (
            <Text size="xs" c="dimmed">
              {t('recurring.form.preview', { dates: preview.map((date) => formatDayShort(date)).join(', ') })}
            </Text>
          )}
        </Stack>

        <Radio.Group
          label={t('recurring.form.mode')}
          value={values.autoCreate ? 'auto' : 'remind'}
          onChange={(value) => form.setFieldValue('autoCreate', value === 'auto')}
        >
          <Stack gap="xs" mt={4}>
            <Radio.Card value="remind" className={classes.candidate}>
              <Radio.Indicator />
              <div>
                <Text fw={500}>{t('recurring.form.remind')}</Text>
                <Text size="xs" c="dimmed">
                  {t('recurring.form.remindHint')}
                </Text>
              </div>
              <span />
            </Radio.Card>
            <Radio.Card value="auto" className={classes.candidate}>
              <Radio.Indicator />
              <div>
                <Text fw={500}>{t('recurring.form.auto')}</Text>
                <Text size="xs" c="dimmed">
                  {t('recurring.form.autoHint')}
                </Text>
              </div>
              <span />
            </Radio.Card>
          </Stack>
        </Radio.Group>
        <Group gap="xs" align="center">
          <Text size="sm">{t('recurring.form.match', { count: matchDays })}</Text>
          <Select
            size="xs"
            w={150}
            aria-label={t('recurring.form.tolerance')}
            allowDeselect={false}
            data={TOLERANCES.map((value) => ({
              value: String(value),
              label: t(value === 0 ? 'recurring.form.exact' : 'recurring.form.percent', { value }),
            }))}
            {...form.getInputProps('tolerance')}
          />
        </Group>

        <ProblemAlert
          error={save.error ?? stop.error ?? remove.error}
          fieldsShown={[
            'name',
            'amount',
            'accountId',
            'toAccountId',
            'toAmount',
            'categoryId',
            'startDate',
            'day',
            'endDate',
          ]}
        />
        <Group justify="space-between" pt="xs">
          <Group gap="xs">
            {recurring && (
              <Button
                variant="outline"
                color="red"
                loading={remove.isPending}
                onClick={() =>
                  confirmDelete({
                    title: t('recurring.form.deleteTitle', { name: recurring.name }),
                    text: t('recurring.form.deleteText'),
                    onConfirm: () => remove.mutate(),
                  })
                }
              >
                {t('common.delete')}
              </Button>
            )}
            {running && (
              <Button variant="default" loading={stop.isPending} onClick={() => stop.mutate()}>
                {t('recurring.form.stop')}
              </Button>
            )}
          </Group>
          <Group gap="xs">
            <Button variant="default" onClick={onDone}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {t('common.save')}
            </Button>
          </Group>
        </Group>
      </Stack>
    </form>
  );
}
