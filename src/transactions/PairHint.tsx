import { Button, Group, Text } from '@mantine/core';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPercent } from '../lib/format';
import { useDismissPair, useMergePair, type TransferPair } from './transferPairs';
import classes from './transactions.module.css';

/** An expense and an income of the day that look like one transfer: merge them or say they are not. */
export function PairHint({ pair, names }: { pair: TransferPair; names: [string, string] }) {
  const { t } = useTranslation();
  const merge = useMergePair();
  const dismiss = useDismissPair();
  const difference = pair.exact
    ? t('transactions.pair.exact')
    : t(pair.difference < 0 ? 'transactions.pair.less' : 'transactions.pair.more', {
        percent: formatPercent(Math.abs(pair.difference)),
      });
  const busy = merge.isPending || dismiss.isPending;
  return (
    <div className={classes.pair} data-testid={`pair-${pair.expenseId}-${pair.incomeId}`}>
      <ArrowLeftRight size={16} aria-hidden />
      <Text size="sm">
        {t('transactions.pair.text', { from: names[0], to: names[1] })} {difference}
      </Text>
      <Group gap="xs" wrap="nowrap">
        <Button size="xs" loading={merge.isPending} disabled={busy} onClick={() => merge.mutate(pair)}>
          {t('transactions.pair.merge')}
        </Button>
        <Button
          size="xs"
          variant="default"
          loading={dismiss.isPending}
          disabled={busy}
          onClick={() => dismiss.mutate(pair)}
        >
          {t('transactions.pair.dismiss')}
        </Button>
      </Group>
    </div>
  );
}
