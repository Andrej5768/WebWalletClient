import {
  ActionIcon,
  Autocomplete,
  Button,
  Center,
  Drawer,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { problemMessage, toProblem } from '../api/errors';
import { check } from '../api/http';
import { invalidateLedger, useAccounts, useCategories, usePayees } from '../api/queries';
import { AmountInput } from '../components/AmountInput';
import { selectableAccounts } from '../lib/accounts';
import { categorySelectData } from '../lib/categories';
import { isoDate, kyivToday } from '../lib/periods';
import { toNumber } from './form';

interface Row {
  key: number;
  date: string | null;
  type: 'EXPENSE' | 'INCOME';
  amount: number | string;
  accountId: string | null;
  categoryId: string | null;
  payee: string;
}

let nextKey = 1;
const emptyRow = (date: string, accountId: string | null): Row => ({
  key: nextKey++,
  date,
  type: 'EXPENSE',
  amount: '',
  accountId,
  categoryId: null,
  payee: '',
});

/** Whether the row has what a transaction needs; rows left empty are skipped. */
const complete = (row: Row) => toNumber(row.amount) > 0 && !!row.accountId && !!row.date;
const touched = (row: Row) => row.amount !== '' || row.payee !== '' || row.categoryId !== null;

/**
 * Side panel to enter several expenses and incomes at once: a table with the few fields they need. All rows are
 * saved together, either all of them or none.
 */
export function BulkDrawer({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const ready = accounts.isSuccess && categories.isSuccess && payees.isSuccess;
  return (
    <Drawer
      opened
      onClose={onClose}
      position="right"
      size={920}
      title={<Text fw={600}>{t('transactions.bulk.title')}</Text>}
    >
      {ready ? (
        <BulkForm onClose={onClose} />
      ) : (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      )}
    </Drawer>
  );
}

function BulkForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const categories = useCategories();
  const payees = usePayees();
  const accountList = selectableAccounts(accounts.data ?? []);
  const today = isoDate(kyivToday());
  const firstAccount = accountList[0] ? String(accountList[0].id) : null;
  const [rows, setRows] = useState<Row[]>(() => [
    emptyRow(today, firstAccount),
    emptyRow(today, firstAccount),
    emptyRow(today, firstAccount),
  ]);
  const [problem, setProblem] = useState<string | null>(null);

  const change = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: number) => setRows((list) => list.filter((row) => row.key !== key));
  const add = () =>
    setRows((list) => {
      const last = list[list.length - 1];
      return [...list, emptyRow(last?.date ?? today, last?.accountId ?? firstAccount)];
    });

  const filled = rows.filter(complete);
  const incomplete = rows.filter((row) => touched(row) && !complete(row));

  const save = useMutation({
    mutationFn: () =>
      check(
        api.POST('/api/v1/transactions/batch', {
          body: {
            transactions: filled.map((row) => ({
              type: row.type,
              date: row.date!,
              accountId: Number(row.accountId),
              amount: toNumber(row.amount),
              categoryId: row.categoryId ? Number(row.categoryId) : undefined,
              payeeName: row.payee.trim() || undefined,
            })),
          },
        }),
      ),
    onSuccess: async () => {
      await invalidateLedger(queryClient);
      onClose();
    },
    onError: (error) => setProblem(problemMessage(toProblem(error))),
  });

  const accountData = accountList.map((account) => ({ value: String(account.id), label: account.name }));
  const payeeNames = (payees.data ?? []).map((payee) => payee.name);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        {t('transactions.bulk.hint')}
      </Text>
      <Table verticalSpacing={4} horizontalSpacing={4} withRowBorders={false}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={130}>{t('transactions.form.date')}</Table.Th>
            <Table.Th w={120}>{t('transactions.filters.type')}</Table.Th>
            <Table.Th w={150}>{t('transactions.form.amount')}</Table.Th>
            <Table.Th>{t('transactions.form.account')}</Table.Th>
            <Table.Th>{t('transactions.form.category')}</Table.Th>
            <Table.Th>{t('transactions.form.payee')}</Table.Th>
            <Table.Th w={36} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, index) => {
            const account = accountList.find((item) => String(item.id) === row.accountId);
            const label = (field: string) => `${field} ${index + 1}`;
            return (
              <Table.Tr key={row.key}>
                <Table.Td>
                  <DateInput
                    size="xs"
                    aria-label={label(t('transactions.form.date'))}
                    valueFormat="DD.MM.YYYY"
                    value={row.date}
                    onChange={(date) => change(row.key, { date })}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    aria-label={label(t('transactions.filters.type'))}
                    allowDeselect={false}
                    data={(['EXPENSE', 'INCOME'] as const).map((type) => ({
                      value: type,
                      label: t(`transactions.form.types.${type}`),
                    }))}
                    value={row.type}
                    onChange={(type) => change(row.key, { type: type as Row['type'], categoryId: null })}
                  />
                </Table.Td>
                <Table.Td>
                  <AmountInput
                    size="xs"
                    aria-label={label(t('transactions.form.amount'))}
                    currency={account?.currency}
                    classNames={{ input: row.type === 'INCOME' ? 'income' : 'expense' }}
                    value={row.amount}
                    onChange={(amount) => change(row.key, { amount })}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    aria-label={label(t('transactions.form.account'))}
                    searchable
                    allowDeselect={false}
                    data={accountData}
                    value={row.accountId}
                    onChange={(accountId) => change(row.key, { accountId })}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    aria-label={label(t('transactions.form.category'))}
                    searchable
                    clearable
                    placeholder={t('transactions.uncategorized')}
                    data={categorySelectData(categories.data ?? [], row.type)}
                    value={row.categoryId}
                    onChange={(categoryId) => change(row.key, { categoryId })}
                  />
                </Table.Td>
                <Table.Td>
                  <Autocomplete
                    size="xs"
                    aria-label={label(t('transactions.form.payee'))}
                    data={payeeNames}
                    limit={8}
                    value={row.payee}
                    onChange={(payee) => change(row.key, { payee })}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    aria-label={label(t('transactions.bulk.removeRow'))}
                    onClick={() => remove(row.key)}
                  >
                    <X size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
      <Group justify="space-between">
        <Button variant="subtle" size="xs" leftSection={<Plus size={14} />} onClick={add}>
          {t('transactions.bulk.addRow')}
        </Button>
        {incomplete.length > 0 && (
          <Text size="xs" c="red">
            {t('transactions.bulk.incomplete', { count: incomplete.length })}
          </Text>
        )}
      </Group>
      {problem && (
        <Text size="sm" c="red" role="alert">
          {problem}
        </Text>
      )}
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          loading={save.isPending}
          disabled={filled.length === 0 || incomplete.length > 0}
          onClick={() => save.mutate()}
        >
          {t('transactions.bulk.save', { count: filled.length })}
        </Button>
      </Group>
    </Stack>
  );
}
