import { Button, Group, Tooltip } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { api, type Schemas } from '../api/client';
import { check } from '../api/http';
import { invalidateLedger } from '../api/queries';
import { isoDate, kyivToday } from '../lib/periods';

type Link = Schemas['LinkResponse'];

/**
 * What to do about a difference between the bank balance and the balance in the ledger: add the missing income or
 * expense with the form (the amount and the account filled in), or a balance correction of the difference, an
 * operation without a category that the reports leave out.
 */
export function DifferenceActions({ link }: { link: Link }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const difference = link.difference ?? 0;
  const type = difference > 0 ? 'INCOME' : 'EXPENSE';
  const amount = Math.abs(difference);

  const adjust = useMutation({
    mutationFn: () =>
      check(
        api.POST('/api/v1/transactions', {
          body: {
            type,
            date: isoDate(kyivToday()),
            accountId: link.accountId!,
            amount,
            adjustment: true,
          },
        }),
      ),
    onSettled: () => invalidateLedger(queryClient),
  });

  if (difference === 0 || link.accountId == null) return null;
  return (
    <Group gap={6}>
      <Button
        size="compact-xs"
        variant="light"
        onClick={() =>
          void navigate(`/transactions?new=1&accountId=${link.accountId}&newType=${type}&amount=${amount}`)
        }
      >
        {t(difference > 0 ? 'imports.monobank.actions.addIncome' : 'imports.monobank.actions.addExpense')}
      </Button>
      <Tooltip label={t('imports.monobank.actions.adjustHint')} multiline w={280} withArrow>
        <Button size="compact-xs" variant="subtle" loading={adjust.isPending} onClick={() => adjust.mutate()}>
          {t('imports.monobank.actions.adjust')}
        </Button>
      </Tooltip>
    </Group>
  );
}
