import { Alert, Button, Group, Modal, NumberInput, Select, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { problemMessage, toProblem } from '../api/errors';
import { formatMoney } from '../lib/money';
import { assign } from './api';
import type { Envelope } from './model';

/** Moves money between two envelopes: lowers one assignment and raises the other. */
export function MoveMoneyModal({
  month,
  envelopes,
  currency,
  initial,
  onClose,
  onMoved,
}: {
  month: string;
  envelopes: Envelope[];
  currency: string;
  initial: { from?: number; to?: number };
  onClose(): void;
  onMoved(): Promise<unknown>;
}) {
  const { t } = useTranslation();
  const byId = new Map(envelopes.map((row) => [String(row.categoryId), row]));
  const overspentTo = initial.to ? byId.get(String(initial.to)) : undefined;
  const form = useForm({
    initialValues: {
      from: initial.from ? String(initial.from) : null,
      to: initial.to ? String(initial.to) : null,
      amount:
        overspentTo && (overspentTo.available ?? 0) < 0
          ? -(overspentTo.available ?? 0)
          : ('' as number | string),
    },
    validate: {
      from: (value) => (value ? null : t('validation.required')),
      to: (value, values) => (value && value !== values.from ? null : t('budget.moveDifferent')),
      amount: (value) => (Number(value) > 0 ? null : t('transactions.form.amountRequired')),
    },
  });

  const move = useMutation({
    mutationFn: async ({ from, to, amount }: typeof form.values) => {
      const source = byId.get(from!)!;
      const target = byId.get(to!)!;
      const value = Number(amount);
      await assign(month, source.categoryId!, (source.assigned ?? 0) - value);
      await assign(month, target.categoryId!, (target.assigned ?? 0) + value);
    },
    onSuccess: async () => {
      await onMoved();
      onClose();
    },
  });

  const options = envelopes.map((row) => ({
    value: String(row.categoryId),
    label: `${row.name} · ${formatMoney(row.available ?? 0, currency)}`,
  }));

  return (
    <Modal opened onClose={onClose} title={<Text fw={600}>{t('budget.move')}</Text>}>
      <form onSubmit={form.onSubmit((values) => move.mutate(values))} noValidate>
        <Stack gap="md">
          <Select label={t('budget.moveFrom')} searchable data={options} {...form.getInputProps('from')} />
          <Select label={t('budget.moveTo')} searchable data={options} {...form.getInputProps('to')} />
          <NumberInput
            label={t('transactions.form.amount')}
            min={0}
            decimalScale={2}
            thousandSeparator=" "
            decimalSeparator=","
            classNames={{ input: 'num' }}
            rightSection={
              <Text size="xs" ff="monospace" c="dimmed">
                {currency}
              </Text>
            }
            rightSectionWidth={48}
            {...form.getInputProps('amount')}
          />
          {move.error && (
            <Alert color="yellow" variant="light" p="xs" role="alert">
              {problemMessage(toProblem(move.error))}
            </Alert>
          )}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={move.isPending}>
              {t('budget.moveSubmit')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
