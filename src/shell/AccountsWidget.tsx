import { Anchor, Group, Skeleton, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Schemas } from '../api/client';
import { useAccounts, useBaseCurrency } from '../api/queries';
import { ShareBar } from '../components/Figure';
import { useGoals } from '../goals/api';
import { accountColor, sumInBase } from '../lib/accounts';
import { formatPercent } from '../lib/format';
import { formatMoney } from '../lib/money';
import classes from './shell.module.css';

type Account = Schemas['AccountResponse'];

const SAVINGS: Account['type'][] = ['SAVINGS', 'DEPOSIT'];
const SHOWN = 6;

/** Everyday accounts under the menu, the savings total and the progress of the first open goal. */
export function AccountsWidget() {
  const { t } = useTranslation();
  const { data, isLoading } = useAccounts();
  const baseCurrency = useBaseCurrency();
  const goals = useGoals();
  const goal = goals.data?.goals.find((item) => item.status !== 'ACHIEVED');

  if (isLoading) return <Skeleton height={120} radius="md" />;
  const active = (data ?? []).filter((account) => !account.archived);
  if (!active.length) return null;

  const everyday = active.filter((account) => !SAVINGS.includes(account.type)).slice(0, SHOWN);
  const savings = active.filter((account) => SAVINGS.includes(account.type));
  // A savings account without an exchange rate is left out of the total; the total says so.
  const { total: savingsTotal, incomplete: savingsIncomplete } = sumInBase(savings);

  return (
    <div className={classes.widget}>
      <Group justify="space-between">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
          {t('nav.accounts')}
        </Text>
        <Anchor component={Link} to="/accounts" size="xs" fw={500}>
          {t('common.all')}
        </Anchor>
      </Group>
      {everyday.map((account) => (
        <div key={account.id} className={classes.accountRow}>
          <span className={classes.dot} style={{ background: accountColor(account.type) }} />
          <span className={classes.accountName}>{account.name}</span>
          <span className={`num ${(account.balance ?? 0) < 0 ? 'expense' : ''}`} style={{ fontWeight: 500 }}>
            {formatMoney(account.balance, account.currency)}
          </span>
        </div>
      ))}
      {savings.length > 0 && (
        <div
          className={classes.accountRow}
          style={{ borderTop: '1px solid var(--ww-border)', paddingTop: 8 }}
        >
          <span className={classes.dot} style={{ background: accountColor('SAVINGS') }} />
          <span className={classes.accountName}>{t('balance.savings')}</span>
          <span
            className="num"
            style={{ fontWeight: 500 }}
            title={savingsIncomplete ? t('accounts.withoutRate') : undefined}
          >
            {formatMoney(savingsTotal, baseCurrency)}
            {savingsIncomplete && '*'}
          </span>
        </div>
      )}
      {goal && (
        <Anchor component={Link} to="/goals" underline="never" c="inherit" className={classes.goal}>
          <ShareBar share={goal.progress} />
          <Text size="xs" c="dimmed" mt={4} truncate>
            {t('goals.sidebar', { name: goal.name, share: formatPercent(goal.progress) })}
          </Text>
        </Anchor>
      )}
    </div>
  );
}
