import { Switch } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { invalidateTaxes, markTransaction, useTransactionTax } from './api';
import { markFor } from './model';

/**
 * Whether a saved income is income of the sole proprietor for the taxes, and a switch to add it or take it out: the
 * rules (an FOP account, a chosen category) count it by themselves, the switch overrides them.
 */
export function FopIncomeSwitch({ transactionId }: { transactionId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const state = useTransactionTax(transactionId);
  const mark = useMutation({
    mutationFn: (include: boolean) =>
      markTransaction(transactionId, markFor(include, state.data?.ruleReason)),
    onSuccess: () => invalidateTaxes(queryClient),
  });
  if (!state.data) return null;
  const data = state.data;
  const description = data.counted
    ? t(`taxes.transaction.counted.${data.reason ?? 'MANUAL'}`)
    : data.ruleReason
      ? t('taxes.transaction.excluded')
      : t('taxes.transaction.notCounted');
  return (
    <Switch
      label={t('taxes.transaction.label')}
      description={description}
      checked={data.counted}
      disabled={mark.isPending}
      onChange={(event) => mark.mutate(event.currentTarget.checked)}
    />
  );
}
