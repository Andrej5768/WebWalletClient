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
import { invalidateLedger, useAccounts, useCategories, usePayees, useTags } from '../api/queries';
import { ensureTagIds } from '../api/tags';
import { confirmDelete } from '../components/confirm';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { MoneyInput } from '../components/MoneyInput';
import { categorySelectData } from '../lib/categories';
import { currencyOptions } from '../lib/currencies';
import { formatMoney } from '../lib/money';
import {
  formErrors,
  initialTransactionValues,
  splitRemainder,
  swapAccounts,
  switchType,
  toNumber,
  toTransactionBody,
  type TransactionType,
  type TransactionValues,
} from './form';
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

/** Side panel to add or edit an expense, income or transfer. It waits for the lists the form needs. */
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
  const [mismatch, setMismatch] = useState(false);
  const editing = transaction !== null;
  const imported = editing && transaction.source !== 'MANUAL';

  const form = useForm<TransactionValues>({
    initialValues: {
      ...initialTransactionValues(
        transaction,
        new Map((tags.data ?? []).map((tag) => [tag.id, tag.name])),
        defaultAccountId,
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
      splits: {
        amount: (value, values) =>
          !values.split || values.type === 'TRANSFER' || toNumber(value) > 0
            ? null
            : t('transactions.form.amountRequired'),
      },
    },
  });
  const values = form.values;

  const accountList = (accounts.data ?? []).filter(
    (account) =>
      !account.archived || account.id === transaction?.accountId || account.id === transaction?.toAccountId,
  );
  const account = accountList.find((item) => String(item.id) === values.accountId);
  const toAccount = accountList.find((item) => String(item.id) === values.toAccountId);
  const currency = account?.currency ?? 'UAH';
  const kind = values.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

  const changeType = (type: TransactionType) => form.setValues(switchType(values, type));

  const done = async () => {
    await invalidateLedger(queryClient);
    onClose();
  };

  const save = useMutation({
    mutationFn: async (input: TransactionValues) => {
      const body = toTransactionBody(input, await ensureTagIds(input.tags, tags.data ?? [], queryClient));
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
  const amountClass = values.type === 'TRANSFER' ? '' : values.type === 'INCOME' ? 'income' : 'expense';

  return (
    <form
      onSubmit={form.onSubmit((input) => {
        const unbalanced = input.split && input.type !== 'TRANSFER' && splitRemainder(input) !== 0;
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
          onChange={(value) => changeType(value as TransactionType)}
          data={(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((value) => ({
            value,
            label: t(`transactions.form.types.${value}`),
          }))}
        />
        <SimpleGrid cols={2} spacing="md">
          <MoneyInput
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

        {values.type !== 'TRANSFER' && (
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
        {values.type !== 'TRANSFER' && <ForeignAmount form={form} />}
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
