import { Card, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { UnconvertedAlert } from '../components/feedback';
import { formatDate } from '../lib/format';
import { formatMoney } from '../lib/money';
import { useDebts } from './debts';
import classes from './accounts.module.css';

/**
 * Debts with people, as in Zen Money: one row per person with what they owe (positive) or what the user owes them
 * (negative). The person is the payee of the debt operations; a row opens them in the feed.
 */
export function DebtsCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const debts = useDebts();
  const people = debts.data?.people ?? [];
  if (people.length === 0) return null;
  const currency = debts.data?.currency ?? 'UAH';

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="sm">
        <div>
          <Text fw={600}>{t('accounts.debts.title')}</Text>
          <Text size="sm" c="dimmed">
            {t('accounts.debts.hint')}
          </Text>
        </div>
        <UnconvertedAlert currencies={debts.data?.unconvertedCurrencies} />
        <div>
          {people.map((person) => (
            <UnstyledButton
              key={person.payeeId ?? 'none'}
              className={classes.person}
              onClick={() =>
                void navigate(
                  person.payeeId == null
                    ? '/transactions?type=TRANSFER'
                    : `/transactions?payeeId=${person.payeeId}`,
                )
              }
            >
              <Group justify="space-between" wrap="nowrap" gap="md">
                <div style={{ minWidth: 0 }}>
                  <Text fw={500} truncate>
                    {person.name ?? t('accounts.debts.noName')}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t('accounts.debts.operations', { count: person.operations })} ·{' '}
                    {t('accounts.debts.last', { date: formatDate(person.lastDate) })}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text className={`num ${person.balance < 0 ? 'expense' : 'income'}`} fw={500}>
                    {formatMoney(Math.abs(person.balance), currency)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t(person.balance < 0 ? 'accounts.debts.youOwe' : 'accounts.debts.owesYou')}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          ))}
        </div>
      </Stack>
    </Card>
  );
}
