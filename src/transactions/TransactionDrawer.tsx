import {
  ActionIcon,
  Alert,
  Anchor,
  Autocomplete,
  Button,
  Collapse,
  Drawer,
  Group,
  NumberInput,
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
import { useForm, type FormRulesRecord, type UseFormReturnType } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Info, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { fieldErrors, problemMessage, toProblem, type ApiProblem } from '../api/errors';
import { queryKeys, useAccounts, useCategories, usePayees, useTags } from '../api/queries';
import { categorySelectData } from '../lib/categories';
import { currencyOptions } from '../lib/currencies';
import { formatMoney } from '../lib/money';
import { isSplit, singleCategoryId, type Transaction, type TransactionRequest } from './model';

type Type = TransactionRequest['type'];

interface SplitValue {
  categoryId: string | null;
  amount: number | string;
  comment: string;
}

interface Values {
  type: Type;
  amount: number | string;
  date: string | null;
  accountId: string | null;
  toAccountId: string | null;
  toAmount: number | string;
  payee: string;
  categoryId: string | null;
  split: boolean;
  splits: SplitValue[];
  tags: string[];
  comment: string;
  originalAmount: number | string;
  originalCurrency: string | null;
}

const num = (value: number | string): number => (value === '' ? 0 : Number(value));
const round2 = (value: number) => Math.round(value * 100) / 100;

function initialValues(
  transaction: Transaction | null,
  tagNames: Map<number, string>,
  accountId?: number,
): Values {
  const split = transaction ? isSplit(transaction) : false;
  return {
    type: transaction?.type ?? 'EXPENSE',
    amount: transaction?.amount ?? '',
    date: transaction?.date ?? dayjs().format('YYYY-MM-DD'),
    accountId: transaction?.accountId ? String(transaction.accountId) : accountId ? String(accountId) : null,
    toAccountId: transaction?.toAccountId ? String(transaction.toAccountId) : null,
    toAmount: transaction?.toAmount ?? '',
    payee: transaction?.payee?.name ?? '',
    categoryId: transaction && !split ? (singleCategoryId(transaction)?.toString() ?? null) : null,
    split,
    splits: split
      ? (transaction?.splits ?? []).map((item) => ({
          categoryId: item.categoryId ? String(item.categoryId) : null,
          amount: item.amount ?? '',
          comment: item.comment ?? '',
        }))
      : [
          { categoryId: null, amount: '', comment: '' },
          { categoryId: null, amount: '', comment: '' },
        ],
    tags: (transaction?.tagIds ?? []).map((id) => tagNames.get(id)).filter((name): name is string => !!name),
    comment: transaction?.comment ?? '',
    originalAmount: transaction?.originalAmount ?? '',
    originalCurrency: transaction?.originalCurrency ?? null,
  };
}

/** Side panel to add or edit an expense, income or transfer. */
export function TransactionDrawer({
  transaction,
  defaultAccountId,
  onClose,
}: {
  transaction: Transaction | null;
  defaultAccountId?: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const tags = useTags();
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const tagNames = new Map((tags.data ?? []).map((tag) => [tag.id!, tag.name ?? '']));
  const editing = transaction !== null;
  const imported = editing && transaction.source !== undefined && transaction.source !== 'MANUAL';

  const form = useForm<Values>({
    initialValues: initialValues(transaction, tagNames, defaultAccountId),
    validate: {
      amount: (value) => (num(value) > 0 ? null : t('transactions.form.amountRequired')),
      date: (value) => (value ? null : t('validation.required')),
      accountId: (value) => (value ? null : t('validation.required')),
      toAccountId: (value, values) =>
        values.type !== 'TRANSFER' || (value && value !== values.accountId)
          ? null
          : t('transactions.form.toAccountRequired'),
    },
  });
  const values = form.values;

  const accountList = (accounts.data ?? []).filter(
    (account) => !account.archived || account.id === transaction?.accountId,
  );
  const account = accountList.find((item) => String(item.id) === values.accountId);
  const toAccount = accountList.find((item) => String(item.id) === values.toAccountId);
  const differentCurrencies = !!toAccount && !!account && toAccount.currency !== account.currency;
  const splitSum = round2(values.splits.reduce((sum, item) => sum + num(item.amount), 0));
  const remainder = round2(num(values.amount) - splitSum);
  const kind = values.type === 'INCOME' ? 'INCOME' : 'EXPENSE';

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.payees }),
    ]);

  /** Tags are picked by name; new names are created first. */
  const tagIds = async (names: string[]): Promise<number[]> => {
    const byName = new Map((tags.data ?? []).map((tag) => [tag.name?.toLowerCase(), tag.id!]));
    const ids: number[] = [];
    for (const name of names) {
      const existing = byName.get(name.toLowerCase());
      if (existing) {
        ids.push(existing);
        continue;
      }
      const { data, error } = await api.POST('/api/v1/tags', { body: { name } });
      if (error || !data?.id) throw error ?? new Error('Tag not created');
      ids.push(data.id);
    }
    if (ids.length > byName.size) await queryClient.invalidateQueries({ queryKey: queryKeys.tags });
    return ids;
  };

  const save = useMutation({
    mutationFn: async (input: Values) => {
      const transfer = input.type === 'TRANSFER';
      const body: TransactionRequest = {
        type: input.type,
        date: input.date!,
        accountId: Number(input.accountId),
        amount: num(input.amount),
        toAccountId: transfer ? Number(input.toAccountId) : undefined,
        toAmount: transfer && differentCurrencies ? num(input.toAmount) : undefined,
        payeeName: transfer ? undefined : input.payee.trim() || undefined,
        categoryId: !transfer && !input.split && input.categoryId ? Number(input.categoryId) : undefined,
        splits:
          !transfer && input.split
            ? input.splits.map((item) => ({
                categoryId: item.categoryId ? Number(item.categoryId) : undefined,
                amount: num(item.amount),
                comment: item.comment.trim() || undefined,
              }))
            : undefined,
        tagIds: await tagIds(input.tags),
        comment: input.comment.trim() || undefined,
        originalAmount: input.originalAmount === '' ? undefined : num(input.originalAmount),
        originalCurrency: input.originalAmount === '' ? undefined : (input.originalCurrency ?? undefined),
      };
      const { error } = editing
        ? await api.PUT('/api/v1/transactions/{id}', { params: { path: { id: transaction.id! } }, body })
        : await api.POST('/api/v1/transactions', { body });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError: (error) => {
      const result = toProblem(error);
      form.setErrors(fieldErrors(result));
      setProblem(result);
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/api/v1/transactions/{id}', {
        params: { path: { id: transaction!.id! } },
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
    onError: (error) => setProblem(toProblem(error)),
  });

  const accountData = accountList.map((item) => ({
    value: String(item.id),
    label: `${item.name} · ${formatMoney(item.balance ?? 0, item.currency ?? 'UAH')}`,
  }));
  const amountClass = values.type === 'TRANSFER' ? '' : values.type === 'INCOME' ? 'income' : 'expense';

  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={520}
      title={
        <Text fw={600}>{t(editing ? 'transactions.form.editTitle' : 'transactions.form.newTitle')}</Text>
      }
    >
      <form
        onSubmit={form.onSubmit((input) => {
          if (input.split && input.type !== 'TRANSFER' && remainder !== 0) {
            setProblem({ detail: t('transactions.form.splitMismatch') });
            return;
          }
          setProblem(null);
          save.mutate(input);
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
            data={(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((value) => ({
              value,
              label: t(`transactions.form.types.${value}`),
            }))}
            {...form.getInputProps('type')}
          />
          <SimpleGrid cols={2} spacing="md">
            <NumberInput
              label={t('transactions.form.amount')}
              min={0}
              decimalScale={2}
              thousandSeparator=" "
              decimalSeparator=","
              size="md"
              data-autofocus
              classNames={{ input: `num ${amountClass}` }}
              rightSection={
                <Text size="xs" ff="monospace" c="dimmed">
                  {account?.currency ?? ''}
                </Text>
              }
              rightSectionWidth={48}
              {...form.getInputProps('amount')}
            />
            <DateInput
              label={t('transactions.form.date')}
              valueFormat="DD.MM.YYYY"
              size="md"
              {...form.getInputProps('date')}
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
              <Select
                label={t('transactions.form.toAccount')}
                searchable
                data={accountData.filter((item) => item.value !== values.accountId)}
                {...form.getInputProps('toAccountId')}
              />
            ) : (
              <Autocomplete
                label={t('transactions.form.payee')}
                placeholder={t('transactions.form.payeePlaceholder')}
                data={[...new Set((payees.data ?? []).map((payee) => payee.name ?? ''))]}
                limit={8}
                {...form.getInputProps('payee')}
              />
            )}
            {values.type === 'TRANSFER' && differentCurrencies && (
              <NumberInput
                style={{ gridColumn: '1 / -1' }}
                label={t('transactions.form.toAmount')}
                description={t('transactions.form.toAmountHint')}
                inputWrapperOrder={['label', 'input', 'description', 'error']}
                min={0}
                decimalScale={2}
                thousandSeparator=" "
                decimalSeparator=","
                classNames={{ input: 'num' }}
                rightSection={
                  <Text size="xs" ff="monospace" c="dimmed">
                    {toAccount?.currency}
                  </Text>
                }
                rightSectionWidth={48}
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
              {!values.split ? (
                <Select
                  aria-label={t('transactions.form.category')}
                  searchable
                  clearable
                  placeholder={t('transactions.uncategorized')}
                  data={categorySelectData(categories.data ?? [], kind)}
                  {...form.getInputProps('categoryId')}
                />
              ) : (
                <Stack gap="xs">
                  {values.splits.map((_, index) => (
                    <Group key={index} gap="xs" wrap="nowrap" align="flex-start">
                      <Select
                        style={{ flex: 1 }}
                        aria-label={t('transactions.form.splitCategory')}
                        searchable
                        placeholder={t('transactions.uncategorized')}
                        data={categorySelectData(categories.data ?? [], kind)}
                        {...form.getInputProps(`splits.${index}.categoryId`)}
                      />
                      <NumberInput
                        w={130}
                        aria-label={t('transactions.form.splitAmount')}
                        min={0}
                        decimalScale={2}
                        thousandSeparator=" "
                        decimalSeparator=","
                        classNames={{ input: 'num' }}
                        {...form.getInputProps(`splits.${index}.amount`)}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        mt={4}
                        aria-label={t('transactions.form.removeSplit')}
                        disabled={values.splits.length <= 2}
                        onClick={() => form.removeListItem('splits', index)}
                      >
                        <X size={16} />
                      </ActionIcon>
                    </Group>
                  ))}
                  <Group justify="space-between">
                    <Anchor
                      component="button"
                      type="button"
                      size="sm"
                      onClick={() =>
                        form.insertListItem('splits', { categoryId: null, amount: '', comment: '' })
                      }
                    >
                      <Group gap={4}>
                        <Plus size={14} />
                        {t('transactions.form.addSplit')}
                      </Group>
                    </Anchor>
                    <Text size="xs" className={`num ${remainder === 0 ? 'muted' : 'expense'}`}>
                      {t('transactions.form.splitRemainder', {
                        amount: formatMoney(remainder, account?.currency ?? 'UAH'),
                      })}
                    </Text>
                  </Group>
                </Stack>
              )}
            </Stack>
          )}

          <TagsInput
            label={t('transactions.form.tags')}
            placeholder={t('transactions.form.tagsPlaceholder')}
            data={(tags.data ?? []).map((tag) => tag.name ?? '')}
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

          {problem && !problem.errors?.length && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              <Text size="sm">{problemMessage(problem)}</Text>
            </Alert>
          )}
          <Group justify="space-between" pt="xs">
            {editing ? (
              <Button
                variant="outline"
                color="red"
                loading={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {t('common.delete')}
              </Button>
            ) : (
              <span />
            )}
            <Group gap="xs">
              <Button variant="default" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={save.isPending}>
                {t('common.save')}
              </Button>
            </Group>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}

function ForeignAmount({ form }: { form: UseFormReturnType<Values, Values, FormRulesRecord<Values>> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(form.values.originalAmount !== '');
  return (
    <div>
      <Anchor component="button" type="button" size="sm" c="dimmed" onClick={() => setOpen(!open)}>
        {t('transactions.form.foreign')}
      </Anchor>
      <Collapse expanded={open}>
        <SimpleGrid cols={2} spacing="md" mt="xs">
          <NumberInput
            label={t('transactions.form.originalAmount')}
            min={0}
            decimalScale={2}
            thousandSeparator=" "
            decimalSeparator=","
            classNames={{ input: 'num' }}
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
