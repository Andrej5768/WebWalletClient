import { Checkbox, Modal, Stack, Text } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { check } from '../api/http';
import { queryKeys } from '../api/queries';
import { ProblemAlert } from '../components/feedback';
import { FormFooter } from '../components/FormFooter';
import { MoneyInput } from '../components/MoneyInput';
import { formatMoney } from '../lib/money';
import type { Goal } from './api';

/** Adds money to (or takes it out of) a goal tracked by hand. */
export function ContributionModal({ goal, onClose }: { goal: Goal; onClose(): void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number | ''>('');
  const [withdraw, setWithdraw] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      check(
        api.POST('/api/v1/goals/{id}/contributions', {
          params: { path: { id: goal.id } },
          body: { amount: withdraw ? -Number(amount) : Number(amount) },
        }),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.goals });
      onClose();
    },
    meta: { errorShown: true },
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={<Text fw={600}>{t('goals.contribution.title', { name: goal.name })}</Text>}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Stack gap="md">
          <MoneyInput
            label={t('goals.contribution.amount')}
            description={t('goals.contribution.hint', { saved: formatMoney(goal.saved, goal.currency) })}
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            currency={goal.currency}
            data-autofocus
            value={amount}
            onChange={(value) => setAmount(typeof value === 'number' ? value : '')}
          />
          <Checkbox
            label={t('goals.contribution.withdraw')}
            checked={withdraw}
            onChange={(event) => setWithdraw(event.currentTarget.checked)}
          />
          <ProblemAlert error={save.error} />
          <FormFooter onCancel={onClose} saving={save.isPending} submitDisabled={!amount} />
        </Stack>
      </form>
    </Modal>
  );
}
