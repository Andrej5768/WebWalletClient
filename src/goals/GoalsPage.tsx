import { ActionIcon, Badge, Button, Card, Group, Menu, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { EllipsisVertical, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { api } from '../api/client';
import { check } from '../api/http';
import { queryKeys, useAccounts } from '../api/queries';
import { CategoryIcon } from '../components/CategoryIcon';
import { confirmDelete } from '../components/confirm';
import { QueryError, UnconvertedAlert } from '../components/feedback';
import { Figure, ShareBar } from '../components/Figure';
import { locale } from '../i18n';
import { formatPercent } from '../lib/format';
import { formatMoney } from '../lib/money';
import { periodOf } from '../lib/periods';
import { useIncomeExpense } from '../reports/api';
import { requestOf, useGoals, type Goal } from './api';
import { ContributionModal } from './ContributionModal';
import { GoalModal } from './GoalModal';
import classes from './goals.module.css';

const STATUS_COLORS: Record<Goal['status'], string> = {
  ACHIEVED: 'green',
  NO_DATE: 'gray',
  ON_TRACK: 'green',
  BEHIND: 'yellow',
  OVERDUE: 'red',
};

/** "1 черв. 2027" / "1 Jun 2027". */
function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function GoalsPage() {
  const { t } = useTranslation();
  const goals = useGoals();
  const accounts = useAccounts();
  const year = useMemo(() => periodOf('twelveMonths'), []);
  const income = useIncomeExpense(year);
  const [editing, setEditing] = useState<Goal | null | undefined>(undefined);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const navigate = useNavigate();
  // A goal on an account grows by a transfer to it; one kept by hand by a contribution.
  const contribute = (goal: Goal) =>
    goal.accountId != null
      ? void navigate(`/transactions?new=1&newType=TRANSFER&toAccountId=${goal.accountId}`)
      : setContributing(goal);
  const accountNames = new Map((accounts.data ?? []).map((account) => [account.id, account.name]));

  const data = goals.data;
  const currency = data?.currency ?? 'UAH';
  const months = income.data?.months.length ?? 0;
  const average = income.data && months > 0 && income.data.income > 0 ? income.data.net / months : null;

  return (
    <Stack gap="lg" maw={1200}>
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Stack gap={4}>
          <Title order={1} size="h2">
            {t('nav.goals')}
          </Title>
          <Text c="dimmed">{t('goals.subtitle')}</Text>
        </Stack>
        <Button leftSection={<Plus size={16} />} onClick={() => setEditing(null)}>
          {t('goals.add')}
        </Button>
      </Group>

      <QueryError error={goals.error} onRetry={() => void goals.refetch()} />
      <UnconvertedAlert currencies={data?.unconvertedCurrencies} />

      {data && data.goals.length > 0 && (
        <div className={classes.figures}>
          <Figure
            label={t('goals.saved')}
            value={formatMoney(data.saved, currency)}
            note={t('goals.savedOf', { target: formatMoney(data.target, currency) })}
          />
          <Figure
            label={t('goals.monthly')}
            value={formatMoney(data.monthlyNeeded, currency)}
            note={t('goals.monthlyNote')}
          />
          <Figure
            label={t('goals.averageSavings')}
            value={average != null ? formatMoney(average, currency) : '—'}
            note={
              average != null
                ? t('goals.averageSavingsNote', { rate: formatPercent(income.data?.savingsRate) })
                : t('goals.averageSavingsEmpty')
            }
          />
        </div>
      )}

      {goals.isPending ? (
        <div className={classes.grid}>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} h={200} radius="md" />
          ))}
        </div>
      ) : data && data.goals.length === 0 ? (
        <Card withBorder radius="md" padding="xl">
          <Text c="dimmed" ta="center">
            {t('goals.empty')}
          </Text>
        </Card>
      ) : (
        <div className={classes.grid}>
          {(data?.goals ?? []).map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              accountName={goal.accountId != null ? accountNames.get(goal.accountId) : undefined}
              onEdit={() => setEditing(goal)}
              onContribute={() => contribute(goal)}
            />
          ))}
        </div>
      )}

      {editing !== undefined && (
        <GoalModal goal={editing} baseCurrency={currency} onClose={() => setEditing(undefined)} />
      )}
      {contributing && <ContributionModal goal={contributing} onClose={() => setContributing(null)} />}
    </Stack>
  );
}

function GoalCard({
  goal,
  accountName,
  onEdit,
  onContribute,
}: {
  goal: Goal;
  accountName?: string;
  onEdit(): void;
  onContribute(): void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const money = (amount: number) => formatMoney(amount, goal.currency);
  const achieved = goal.status === 'ACHIEVED';

  const done = () => queryClient.invalidateQueries({ queryKey: queryKeys.goals });
  const toggleAchieved = useMutation({
    mutationFn: () =>
      check(
        api.PUT('/api/v1/goals/{id}', {
          params: { path: { id: goal.id } },
          body: requestOf(goal, { achieved: !goal.achievedOn }),
        }),
      ),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => check(api.DELETE('/api/v1/goals/{id}', { params: { path: { id: goal.id } } })),
    onSuccess: done,
  });

  const subtitle = [
    accountName ?? (goal.accountId == null ? t('goals.manual') : undefined),
    goal.targetDate ? t('goals.until', { date: formatDay(goal.targetDate) }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
  const expectedShare = goal.expected != null ? goal.expected / goal.targetAmount : null;

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <CategoryIcon icon={goal.icon ?? 'piggy-bank'} color={goal.color ?? 'blue'} size={36} />
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} truncate>
              {goal.name}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {subtitle}
            </Text>
          </Stack>
          <Badge variant="light" color={STATUS_COLORS[goal.status]} style={{ textTransform: 'none' }}>
            {t(`goals.status.${goal.status}`)}
          </Badge>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label={t('goals.actions')}>
                <EllipsisVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={onEdit}>{t('goals.edit')}</Menu.Item>
              <Menu.Item onClick={onContribute}>{t('goals.contribute')}</Menu.Item>
              <Menu.Item onClick={() => toggleAchieved.mutate()}>
                {t(goal.achievedOn ? 'goals.markActive' : 'goals.markAchieved')}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                onClick={() =>
                  confirmDelete({
                    title: t('goals.deleteTitle', { name: goal.name }),
                    text: t('goals.deleteText'),
                    onConfirm: () => remove.mutate(),
                  })
                }
              >
                {t('goals.delete')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Stack gap={8}>
          <Group justify="space-between" align="baseline" wrap="nowrap">
            <Text className="num" fz={20} fw={600}>
              {money(goal.saved)}
            </Text>
            <Text className="num" size="sm" c="dimmed">
              {t('goals.progress', { target: money(goal.targetAmount), share: formatPercent(goal.progress) })}
            </Text>
          </Group>
          <div className={classes.pace}>
            <ShareBar
              share={goal.progress}
              color={
                goal.status === 'BEHIND' || goal.status === 'OVERDUE'
                  ? 'var(--mantine-color-yellow-filled)'
                  : achieved
                    ? 'var(--ww-income)'
                    : undefined
              }
            />
            {expectedShare != null && (
              <i style={{ left: `${Math.min(1, expectedShare) * 100}%` }} title={t('goals.paceMarker')} />
            )}
          </div>
          <Text size="xs" c="dimmed">
            {paceText(goal, money, t)}
          </Text>
        </Stack>

        {goal.monthlyNeeded != null && !achieved && (
          <Group justify="space-between" className={classes.footer}>
            <Text size="sm" c="dimmed">
              {goal.monthsLeft ? t('goals.monthlyLabel', { count: goal.monthsLeft }) : t('goals.monthlyNow')}
            </Text>
            <Text className="num" size="sm" fw={600}>
              {money(goal.monthlyNeeded)}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

function paceText(goal: Goal, money: (amount: number) => string, t: TFunction) {
  switch (goal.status) {
    case 'ACHIEVED':
      return goal.achievedOn
        ? t('goals.pace.achievedOn', { date: formatDay(goal.achievedOn) })
        : t('goals.pace.achieved');
    case 'NO_DATE':
      return t('goals.pace.noDate', { remaining: money(goal.remaining) });
    case 'OVERDUE':
      return t('goals.pace.overdue', { remaining: money(goal.remaining) });
    default: {
      const expected = goal.expected ?? 0;
      const ahead = goal.saved - expected;
      if (goal.status === 'BEHIND') {
        return t('goals.pace.behind', { expected: money(expected), missing: money(-ahead) });
      }
      return ahead > 0 ? t('goals.pace.ahead', { amount: money(ahead) }) : t('goals.pace.onPace');
    }
  }
}
