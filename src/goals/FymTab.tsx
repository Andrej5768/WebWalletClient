import { Card, Checkbox, Group, SegmentedControl, Skeleton, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Schemas } from '../api/client';
import { useAccounts } from '../api/queries';
import { locale } from '../i18n';
import { ShareBar } from '../components/Figure';
import { sumInBase } from '../lib/accounts';
import { formatMoney } from '../lib/money';
import { loadStored, store } from '../lib/storage';
import { fym, FYM_MILESTONES, trackPosition } from './fire';
import classes from './goals.module.css';
import { ShortHistory } from './ShortHistory';
import { useAverages } from './useAverages';

type Account = Schemas['AccountResponse'];

const STORAGE_KEY = 'ww-fym';
const TARGETS = [6, 12, 24] as const;
/** Money that can be spent at once; deposits, investments and debts are not. */
const LIQUID_BY_DEFAULT: Account['type'][] = ['CASH', 'CARD', 'FOP', 'SAVINGS'];

interface Settings {
  /** Choices of the viewer by account id; other accounts follow their type. */
  accounts: Record<string, boolean>;
  target: number;
}

/** FYM — "freedom money": how many months the liquid money lasts at the usual expenses. */
export function FymTab() {
  const { t } = useTranslation();
  const accounts = useAccounts();
  const averages = useAverages();
  const [settings, setSettings] = useState<Settings>(() =>
    loadStored<Settings>(STORAGE_KEY, { accounts: {}, target: 12 }),
  );

  if (accounts.isPending || averages.query.isPending) return <Skeleton height={420} radius="md" />;

  const save = (next: Settings) => {
    setSettings(next);
    store(STORAGE_KEY, next);
  };
  const currency = averages.currency;
  const money = (amount: number) => formatMoney(amount, currency, { decimals: 0 });
  const list = (accounts.data ?? []).filter(
    (account) => !account.archived && account.type !== 'CREDIT_CARD' && account.type !== 'LOAN',
  );
  const liquidOf = (account: Account) =>
    settings.accounts[String(account.id)] ?? LIQUID_BY_DEFAULT.includes(account.type);
  // An account without an exchange rate is left out of the liquid money; the note says so
  const { total: liquid, incomplete } = sumInBase(list.filter(liquidOf), (balance) => Math.max(0, balance));
  const expenses = averages.monthlyExpenses ?? 0;
  const result = fym(liquid, expenses, settings.target, Math.max(0, averages.monthlySavings ?? 0));
  const months = result.months ?? 0;
  const oneDecimal = (value: number) =>
    new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

  return (
    <div className={classes.two}>
      <Card withBorder radius="md" padding="lg">
        <Stack gap="sm">
          <ShortHistory months={averages.months} />
          <Text fw={600}>{t('goals.fym.liquidTitle')}</Text>
          {list.map((account) => (
            <Group key={account.id} justify="space-between" wrap="nowrap">
              <Checkbox
                label={account.name}
                checked={liquidOf(account)}
                onChange={(event) =>
                  save({
                    ...settings,
                    accounts: { ...settings.accounts, [String(account.id)]: event.currentTarget.checked },
                  })
                }
              />
              <Text className="num" size="sm" c="dimmed">
                {formatMoney(account.balance, account.currency)}
              </Text>
            </Group>
          ))}
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="lg">
        <Stack gap="lg">
          <Stack gap={2}>
            <Text fw={600}>{t('goals.fym.title')}</Text>
            <Text size="sm" c="dimmed">
              {t('goals.fym.subtitle')}
            </Text>
          </Stack>
          {result.months === null ? (
            <Text c="dimmed">{t('goals.fym.noExpenses')}</Text>
          ) : (
            <>
              <Group gap="xs" align="baseline">
                <Text className="num" fz={40} fw={600} data-testid="fym-months">
                  {oneDecimal(months)}
                </Text>
                <Text c="dimmed">{t('goals.fym.monthsWithoutIncome')}</Text>
              </Group>
              <Text size="sm" c="dimmed">
                {t('goals.fym.liquidNote', { liquid: money(liquid), expenses: money(expenses) })}
              </Text>
              {incomplete && (
                <Text size="sm" c="dimmed">
                  {t('accounts.withoutRate')}
                </Text>
              )}
              <ShareBar
                share={trackPosition(months)}
                height={8}
                ticks={FYM_MILESTONES.map((milestone, index) => ({
                  position: index / (FYM_MILESTONES.length - 1),
                  label: t('goals.fym.milestone', { count: milestone }),
                }))}
              />
            </>
          )}
          <Group gap="sm" align="center">
            <Text size="sm">{t('goals.fym.target')}</Text>
            <SegmentedControl
              aria-label={t('goals.fym.target')}
              value={String(settings.target)}
              onChange={(value) => save({ ...settings, target: Number(value) })}
              data={TARGETS.map((target) => ({
                value: String(target),
                label: t('goals.fym.milestone', { count: target }),
              }))}
            />
          </Group>
          {result.months !== null && (
            <Stack gap={4}>
              <Text size="sm">{t('goals.fym.need', { amount: money(result.need) })}</Text>
              <Text size="sm" fw={500}>
                {result.left > 0
                  ? t('goals.fym.left', { amount: money(result.left) })
                  : t('goals.fym.reached')}
              </Text>
              {result.left > 0 && (
                <Text size="sm" c="dimmed">
                  {result.eta !== null
                    ? t('goals.fym.eta', {
                        savings: money(averages.monthlySavings ?? 0),
                        months: oneDecimal(result.eta),
                      })
                    : t('goals.fym.noSavings')}
                </Text>
              )}
            </Stack>
          )}
        </Stack>
      </Card>
    </div>
  );
}
