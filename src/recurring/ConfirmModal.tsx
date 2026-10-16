import { Modal, SimpleGrid, Stack, Text } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { MoneyInput } from '../components/MoneyInput';
import { isoDate, kyivToday } from '../lib/periods';
import { useConfirmOccurrence, type Occurrence } from './api';

/** For a payment whose amount varies: asks for the actual amount and date before saving it. */
export function ConfirmModal({ occurrence, onClose }: { occurrence: Occurrence; onClose(): void }) {
  const { t } = useTranslation();
  const confirm = useConfirmOccurrence(true);
  const today = isoDate(kyivToday());
  const [amount, setAmount] = useState<number | string>(occurrence.amount);
  const [date, setDate] = useState<string | null>(occurrence.date > today ? today : occurrence.date);

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={600}>{t('recurring.confirm.title', { name: occurrence.name })}</Text>}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          confirm.mutate(
            { occurrence, amount: Number(amount), date: date ?? undefined },
            { onSuccess: onClose },
          );
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('recurring.confirm.hint')}
          </Text>
          <SimpleGrid cols={2}>
            <MoneyInput
              label={t('recurring.form.amount')}
              currency={occurrence.currency}
              data-autofocus
              value={amount}
              onChange={setAmount}
            />
            <DateInput
              label={t('recurring.confirm.date')}
              valueFormat="DD.MM.YYYY"
              value={date}
              onChange={setDate}
            />
          </SimpleGrid>
          <ProblemAlert error={confirm.error} />
          <FormFooter
            onCancel={onClose}
            saving={confirm.isPending}
            submitDisabled={!amount || !date}
            submitLabel={t('recurring.actions.confirm')}
          />
        </Stack>
      </form>
    </Modal>
  );
}
