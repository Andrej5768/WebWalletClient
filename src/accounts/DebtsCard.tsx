import { Button, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { UnconvertedAlert } from '../components/feedback';
import { formatDate } from '../lib/format';
import { formatMoney } from '../lib/money';
import { useDebts } from './debts';
import classes from './accounts.module.css';

/**
 * Debts with people, as in Zen Money: one row per person with what they owe (positive) or what the user owes them
 * (negative). The person is the payee of the debt operations; a row opens them in the feed. People whose debt is
 * settled are hidden until asked for.
 */
export function DebtsCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const debts = useDebts();
  const [showSettled, setShowSettled] = useState(false);
  const people = debts.data?.people ?? [];
  if (people.length === 0) return null;
  const currency = debts.data?.currency ?? 'UAH';
  const settled = people.filter((person) => person.balance === 0).length;
  const shown = showSettled ? people : people.filter((person) => person.balance !== 0);

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
          {shown.map((person) => (
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
                  {/* What the user owes is a red negative amount; what others owe them is plain and grey */}
                  <Text
                    className={`num ${person.balance < 0 ? 'expense' : ''}`}
                    c={person.balance < 0 ? undefined : 'dimmed'}
                    fw={500}
                  >
                    {formatMoney(person.balance, currency)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {t(
                      person.balance < 0
                        ? 'accounts.debts.youOwe'
                        : person.balance > 0
                          ? 'accounts.debts.owesYou'
                          : 'accounts.debts.settled',
                    )}
                  </Text>
                </div>
              </Group>
            </UnstyledButton>
          ))}
        </div>
        {settled > 0 && (
          <Button variant="subtle" size="compact-sm" onClick={() => setShowSettled((value) => !value)}>
            {showSettled
              ? t('accounts.debts.hideSettled')
              : t('accounts.debts.showSettled', { count: settled })}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
