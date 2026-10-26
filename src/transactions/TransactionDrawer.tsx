import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Button,
  Center,
  Collapse,
  Drawer,
  Group,
  Loader,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  TagsInput,
  Text,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm, type UseFormReturnType } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Info, Unlink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { toProblem } from '../api/errors';
import { check } from '../api/http';
import {
  invalidateLedger,
  useAccounts,
  useBaseCurrency,
  useCategories,
  usePayees,
  useTags,
} from '../api/queries';
import { ensureTagIds } from '../api/tags';
import { confirmDelete } from '../components/confirm';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { AmountInput } from '../components/AmountInput';
import { MoneyInput } from '../components/MoneyInput';
import { categorySelectData } from '../lib/categories';
import { currencyOptions } from '../lib/currencies';
import { selectableAccounts } from '../lib/accounts';
import { formatMoney } from '../lib/money';
import {
  categorized,
  formErrors,
  initialTransactionValues,
  splitRemainder,
  swapAccounts,
  switchType,
  toNumber,
  toTransactionBody,
  type FormType,
  type TransactionValues,
} from './form';
import { debtAccountIds, ensureDebtAccount } from './debts';
import type { Transaction } from './model';
import { FopIncomeSwitch } from '../taxes/FopIncomeSwitch';
import { SplitEditor } from './SplitEditor';
import { useSplitTransfer } from './transferPairs';

/** Fields the form renders; a backend error on any other field is shown in the alert. */
const FORM_FIELDS = [
  'type',
  'amount',
  'date',
  'accountId',
  'toAccountId',
  'toAmount',
  'payeeName',
  'categoryId',
  'splits',
  'tagIds',
  'comment',
  'originalAmount',
  'originalCurrency',
];

interface Props {
  transaction: Transaction | null;
  defaultAccountId?: number;
  /** Values a new transaction starts with, e.g. a transfer to a goal's account. */
  defaults?: Partial<TransactionValues>;
  onClose: () => void;
}

/** Side panel to add or edit an expense, income, transfer or debt. It waits for the lists the form needs. */
export function TransactionDrawer(props: Props) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const tags = useTags();
  const ready = accounts.isSuccess && tags.isSuccess;
  return (
    <Drawer
      opened
      onClose={props.onClose}
      position="right"
      size={520}
      title={
        <Text fw={600}>
          {t(props.transaction ? 'transactions.form.editTitle' : 'transactions.form.newTitle')}
        </Text>
      }
    >
      {ready ? (
        <TransactionForm {...props} />
      ) : (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
    </Drawer>
  );
}

function TransactionForm({ transaction, defaultAccountId, defaults, onClose }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const tags = useTags();
  const baseCurrency = useBaseCurrency();
  const [mismatch, setMismatch] = useState(false);
  const editing = transaction !== null;
  const imported = editing && transaction.source !== 'MANUAL';

  const form = useForm<TransactionValues>({
    initialValues: {
      ...initialTransactionValues(
        transaction,
        new Map((tags.data ?? []).map((tag) => [tag.id, tag.name])),
        defaultAccountId,
        debtAccountIds(accounts.data ?? []),
      ),
      ...(transaction ? {} : defaults),
    },
    validate: {
      amount: (value) => (toNumber(value) > 0 ? null : t('transactions.form.amountRequired')),
      date: (value) => (value ? null : t('validation.required')),
      accountId: (value) => (value ? null : t('validation.required')),
      toAccountId: (value, values) =>
        values.type !== 'TRANSFER' || (value && value !== values.accountId)
          ? null
          : t('transactions.form.toAccountRequired'),
      payee: (value, values) => (values.type === 'DEBT' && !value.trim() ? t('validation.required') : null),
      toAmount: (value, values) =>
        values.type === 'DEBT' && debtNeedsOwnAmount(values.accountId) && value === ''
          ? t('validation.required')
          : null,
      splits: {
        amount: (value, values) =>
          !values.split || !categorized(values.type) || toNumber(value) > 0
            ? null
            : t('transactions.form.amountRequired'),
      },
    },
  });
  const values = form.values;

  const accountList = selectableAccounts(accounts.data ?? [], [
    transaction?.accountId,
    transaction?.toAccountId,
  ]);
  const account = accountList.find((item) => String(item.id) === values.accountId);
  const toAccount = accountList.find((item) => String(item.id) === values.toAccountId);
  const currency = account?.currency ?? 'UAH';
  const kind = values.type === 'INCOME' ? 'INCOME' : 'EXPENSE';
  // Debts go to the first debt account, created on first use in the base currency
  const debtAccounts = debtAccountIds(accounts.data ?? []);
  const debtCurrency =
    accountList.find((item) => item.type === 'DEBT' && !item.archived)?.currency ?? baseCurrency;
  /** A debt from an account in another currency needs the amount in the debt account's currency too. */
  function debtNeedsOwnAmount(ownAccountId: string | null): boolean {
    const own = accountList.find((item) => String(item.id) === ownAccountId);
    return !!own && own.currency !== debtCurrency;
  }

  const changeType = (type: FormType) => form.setValues(switchType(values, type));

  const done = async () => {
    await invalidateLedger(queryClient);
    onClose();
  };

  const save = useMutation({
    mutationFn: async (input: TransactionValues) => {
      const debtAccountId =
        input.type === 'DEBT'
          ? await ensureDebtAccount(
              accounts.data ?? [],
              t('transactions.form.debtAccountName'),
              baseCurrency,
              queryClient,
            )
          : undefined;
      const body = toTransactionBody(
        input,
        await ensureTagIds(input.tags, tags.data ?? [], queryClient),
        debtAccountId,
      );
      await check(
        editing
          ? api.PUT('/api/v1/transactions/{id}', { params: { path: { id: transaction.id } }, body })
          : api.POST('/api/v1/transactions', { body }),
      );
    },
    onSuccess: done,
    onError: (error) => form.setErrors(formErrors(toProblem(error))),
  });

  const split = useSplitTransfer();

  const remove = useMutation({
    mutationFn: () =>
      check(api.DELETE('/api/v1/transactions/{id}', { params: { path: { id: transaction!.id } } })),
    onSuccess: done,
    meta: { errorShown: true },
  });

  const accountData = accountList.map((item) => ({
    value: String(item.id),
    label: `${item.name} · ${formatMoney(item.balance, item.currency)}`,
  }));
  const incoming =
    values.type === 'INCOME' || (values.type === 'DEBT' && values.debtDirection === 'RECEIVED');
  const amountClass = values.type === 'TRANSFER' ? '' : incoming ? 'income' : 'expense';

  return (
    <form
      onSubmit={form.onSubmit((input) => {
        const unbalanced = input.split && categorized(input.type) && splitRemainder(input) !== 0;
        setMismatch(unbalanced);
        if (!unbalanced) save.mutate(input);
      })}
      noValidate
    >
      <Stack gap="md">
        {imported && (
          <Alert color="blue" variant="light" p="xs" icon={<Info size={16} />}>
            <Text size="sm">
              {t('transactions.form.imported', { source: t(`transactions.sources.${transaction.source}`) })}
            </Text>
          </Alert>
        )}
        <SegmentedControl
          aria-label={t('transactions.filters.type')}
          style={{ alignSelf: 'flex-start' }}
          value={values.type}
          onChange={(value) => changeType(value as FormType)}
          data={(['EXPENSE', 'INCOME', 'TRANSFER', 'DEBT'] as const).map((value) => ({
            value,
            label: t(`transactions.form.types.${value}`),
          }))}
        />
        <SimpleGrid cols={2} spacing="md">
          <AmountInput
            label={t('transactions.form.amount')}
            size="md"
            data-autofocus
            currency={account?.currency}
            classNames={{ input: amountClass }}
            {...form.getInputProps('amount')}
          />
          <DateInput
            label={t('transactions.form.date')}
            valueFormat="DD.MM.YYYY"
            size="md"
            {...form.getInputProps('date')}
          />
          {values.type === 'TRANSFER' ? (
            <Group style={{ gridColumn: '1 / -1' }} gap="xs" wrap="nowrap" align="flex-end">
              <Select
                style={{ flex: 1 }}
                label={t('transactions.form.fromAccount')}
                searchable
                data={accountData}
                {...form.getInputProps('accountId')}
              />
              <ActionIcon
                variant="default"
                size="input-sm"
                aria-label={t('transactions.form.swapAccounts')}
                title={t('transactions.form.swapAccounts')}
                onClick={() =>
                  form.setValues(swapAccounts(values, account?.currency !== toAccount?.currency))
                }
              >
                <ArrowLeftRight size={16} />
              </ActionIcon>
              <Select
                style={{ flex: 1 }}
                label={t('transactions.form.toAccount')}
                searchable
                data={accountData.filter((item) => item.value !== values.accountId)}
                {...form.getInputProps('toAccountId')}
              />
            </Group>
          ) : values.type === 'DEBT' ? (
            <>
              <Stack gap={6}>
                <Text size="sm" fw={500}>
                  {t('transactions.form.debtDirection')}
                </Text>
                <SegmentedControl
                  data={(['GAVE', 'RECEIVED'] as const).map((value) => ({
                    value,
                    label: t(`transactions.form.debtDirections.${value}`),
                  }))}
                  {...form.getInputProps('debtDirection')}
                />
              </Stack>
              <Select
                label={t('transactions.form.account')}
                searchable
                data={accountData.filter((item) => !debtAccounts.has(Number(item.value)))}
                {...form.getInputProps('accountId')}
              />
              <Autocomplete
                style={{ gridColumn: '1 / -1' }}
                label={t('transactions.form.debtPerson')}
                placeholder={t('transactions.form.debtPersonPlaceholder')}
                description={t('transactions.form.debtDirectionHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                data={[...new Set((payees.data ?? []).map((payee) => payee.name))]}
                limit={8}
                {...form.getInputProps('payee')}
              />
              {debtNeedsOwnAmount(values.accountId) && (
                <MoneyInput
                  style={{ gridColumn: '1 / -1' }}
                  label={t('transactions.form.debtAmount', { currency: debtCurrency })}
                  currency={debtCurrency}
                  {...form.getInputProps('toAmount')}
                />
              )}
            </>
          ) : (
            <>
              <Select
                label={t('transactions.form.account')}
                searchable
                data={accountData}
                {...form.getInputProps('accountId')}
              />
              <Autocomplete
                label={t('transactions.form.payee')}
                placeholder={t('transactions.form.payeePlaceholder')}
                data={[...new Set((payees.data ?? []).map((payee) => payee.name))]}
                limit={8}
                {...form.getInputProps('payee')}
              />
            </>
          )}
          {values.type === 'TRANSFER' && (
            <MoneyInput
              style={{ gridColumn: '1 / -1' }}
              label={t('transactions.form.toAmount')}
              description={t(
                toAccount && account && toAccount.currency !== account.currency
                  ? 'transactions.form.toAmountHint'
                  : 'transactions.form.toAmountFeeHint',
              )}
              placeholder={values.amount === '' ? undefined : String(values.amount)}
              currency={toAccount?.currency}
              {...form.getInputProps('toAmount')}
            />
          )}
        </SimpleGrid>

        {values.adjustment && (
          <Alert color="gray" variant="light" p="xs">
            {t('transactions.form.adjustmentHint')}
          </Alert>
        )}
        {categorized(values.type) && !values.adjustment && (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                {t('transactions.form.category')}
              </Text>
              <Switch
                size="xs"
                label={t('transactions.form.split')}
                {...form.getInputProps('split', { type: 'checkbox' })}
              />
            </Group>
            {values.split ? (
              <SplitEditor form={form} categories={categories.data ?? []} currency={currency} />
            ) : (
              <Select
                aria-label={t('transactions.form.category')}
                searchable
                clearable
                placeholder={t('transactions.uncategorized')}
                data={categorySelectData(categories.data ?? [], kind)}
                {...form.getInputProps('categoryId')}
              />
            )}
          </Stack>
        )}

        <TagsInput
          label={t('transactions.form.tags')}
          placeholder={t('transactions.form.tagsPlaceholder')}
          data={(tags.data ?? []).map((tag) => tag.name)}
          clearable
          {...form.getInputProps('tags')}
        />
        <Textarea
          label={t('transactions.form.comment')}
          autosize
          minRows={2}
          {...form.getInputProps('comment')}
        />
        {categorized(values.type) && <ForeignAmount form={form} />}
        {editing && transaction.type === 'INCOME' && <FopIncomeSwitch transactionId={transaction.id} />}

        {mismatch && (
          <Alert color="yellow" variant="light" p="xs" role="alert">
            {t('transactions.form.splitMismatch')}
          </Alert>
        )}
        {editing && transaction.type === 'TRANSFER' && (
          <Group gap="sm" wrap="nowrap" align="center">
            <Button
              variant="default"
              size="xs"
              leftSection={<Unlink size={14} />}
              loading={split.isPending}
              onClick={() => split.mutate(transaction.id, { onSuccess: onClose })}
            >
              {t('transactions.splitTransfer')}
            </Button>
            <Text size="xs" c="dimmed">
              {t('transactions.splitTransferHint')}
            </Text>
          </Group>
        )}
        <ProblemAlert error={save.error ?? remove.error ?? split.error} fieldsShown={FORM_FIELDS} />
        <FormFooter
          onCancel={onClose}
          saving={save.isPending}
          deleting={remove.isPending}
          onDelete={
            editing
              ? () =>
                  confirmDelete({
                    title: t('transactions.form.deleteTitle'),
                    onConfirm: () => remove.mutate(),
                  })
              : undefined
          }
        />
      </Stack>
    </form>
  );
}

function ForeignAmount({ form }: { form: UseFormReturnType<TransactionValues> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(form.values.originalAmount !== '');
  return (
    <div>
      <Anchor
        component="button"
        type="button"
        size="sm"
        c="dimmed"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {t('transactions.form.foreign')}
      </Anchor>
      <Collapse expanded={open}>
        <SimpleGrid cols={2} spacing="md" mt="xs">
          <MoneyInput
            label={t('transactions.form.originalAmount')}
            {...form.getInputProps('originalAmount')}
          />
          <Select
            label={t('accounts.form.currency')}
            searchable
            data={currencyOptions(form.values.originalCurrency ?? undefined)}
            {...form.getInputProps('originalCurrency')}
          />
        </SimpleGrid>
      </Collapse>
    </div>
  );
}
