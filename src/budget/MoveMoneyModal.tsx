import { Modal, Select, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fieldErrors, toProblem } from '../api/errors';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { MoneyInput } from '../components/MoneyInput';
import { formatMoney } from '../lib/money';
import { budgetChanged, moveMoney } from './api';
import type { Envelope } from './model';

/** Moves money between the own envelopes of two categories in one request. */
export function MoveMoneyModal({
  month,
  envelopes,
  currency,
  initial,
  onClose,
}: {
  month: string;
  envelopes: Envelope[];
  currency: string;
  initial: { from?: number; to?: number };
  onClose(): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const overspentTo = envelopes.find((row) => row.categoryId === initial.to);
  const form = useForm({
    initialValues: {
      from: initial.from ? String(initial.from) : null,
      to: initial.to ? String(initial.to) : null,
      amount: overspentTo && overspentTo.available < 0 ? -overspentTo.available : ('' as number | string),
    },
    validate: {
      from: (value) => (value ? null : t('validation.required')),
      to: (value, values) => (value && value !== values.from ? null : t('budget.moveDifferent')),
      amount: (value) => (Number(value) > 0 ? null : t('transactions.form.amountRequired')),
    },
  });

  const move = useMutation({
    mutationFn: ({ from, to, amount }: typeof form.values) =>
      moveMoney(month, Number(from), Number(to), Number(amount)),
    onSuccess: async (updated) => {
      await budgetChanged(queryClient, updated);
      onClose();
    },
    onError: (error) =>
      form.setErrors(
        Object.fromEntries(
          Object.entries(fieldErrors(toProblem(error))).map(([field, message]) => [
            field === 'fromCategoryId' ? 'from' : field === 'toCategoryId' ? 'to' : field,
            message,
          ]),
        ),
      ),
  });

  const options = envelopes.map((row) => ({
    value: String(row.categoryId),
    label: `${row.name} · ${formatMoney(row.available, currency)}`,
  }));

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('budget.move')}</Text>}>
      <form onSubmit={form.onSubmit((values) => move.mutate(values))} noValidate>
        <Stack gap="md">
          <Select label={t('budget.moveFrom')} searchable data={options} {...form.getInputProps('from')} />
          <Select label={t('budget.moveTo')} searchable data={options} {...form.getInputProps('to')} />
          <MoneyInput
            label={t('transactions.form.amount')}
            currency={currency}
            {...form.getInputProps('amount')}
          />
          <ProblemAlert error={move.error} fieldsShown={['fromCategoryId', 'toCategoryId', 'amount']} />
          <FormFooter onCancel={onClose} saving={move.isPending} submitLabel={t('budget.moveSubmit')} />
        </Stack>
      </form>
    </Modal>
  );
}
